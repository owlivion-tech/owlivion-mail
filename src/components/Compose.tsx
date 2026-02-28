// ============================================================================
// Owlivion Mail - Compose Email Modal
// ============================================================================
// SECURITY HARDENED: Strict sanitization, no style/img in compose

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from '../i18n';
import { useShortcut } from '../hooks/useKeyboardShortcuts';
import { isMobile } from '../hooks/usePlatform';
import { RecipientInput } from './compose/RecipientInput';
import { AttachmentList } from './compose/AttachmentList';
import { RichTextEditor } from './compose/RichTextEditor';
import TemplateSelector from './compose/TemplateSelector';
import { useDraftAutoSave } from '../hooks/useDraftAutoSave';
import { deleteDraft } from '../services/draftService';
import { templateIncrementUsage } from '../services';
import { buildTemplateContext, replaceTemplateVariables } from '../utils/templateVariables';
import type { Email, EmailAddress, DraftEmail, Attachment, Account, EmailTemplate } from '../types';

// SECURITY: Logger wrapper to avoid exposing details in production
const log = {
  error: (message: string, _err?: unknown) => {
    if (import.meta.env.DEV) {
      console.error(message, _err);
    }
  },
};

// SECURITY: Sanitization for compose - allows img/style for signatures
const sanitizeForCompose = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'style', 'meta'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'align', 'valign', 'width', 'height', 'colspan', 'rowspan', 'src', 'alt', 'style', 'cellpadding', 'cellspacing', 'border', 'charset'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
};

// SECURITY: Additional text sanitizer for display
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

interface ComposeProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  originalEmail?: Email;
  draft?: DraftEmail; // Draft to edit
  onSend: (email: DraftEmail) => Promise<void>;
  onSaveDraft: (email: DraftEmail) => Promise<void>;
  defaultAccount?: Account;
}

export function Compose({
  isOpen,
  onClose,
  mode,
  originalEmail,
  draft,
  onSend,
  defaultAccount,
}: ComposeProps) {
  const { t, lang } = useTranslation();

  // Recipients
  const [to, setTo] = useState<EmailAddress[]>([]);
  const [cc, setCc] = useState<EmailAddress[]>([]);
  const [bcc, setBcc] = useState<EmailAddress[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // Content
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // State
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftId, setDraftId] = useState<number | undefined>();
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // SECURITY: Use state-based notifications instead of alert()
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'warning'; message: string } | null>(null);

  // Template selector
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear notification after timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // SECURITY: Show notification helper (replaces alert)
  const showNotification = (type: 'error' | 'success' | 'warning', message: string) => {
    setNotification({ type, message });
  };

  // Handle image paste from clipboard
  const handleImagePaste = useCallback((files: File[]) => {
    const MAX_ATTACHMENTS = 10;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      showNotification('warning', t('compose.maxAttachments').replace('{max}', String(MAX_ATTACHMENTS)));
      return;
    }

    const newAttachments: Attachment[] = files.map((file, idx) => ({
      index: attachments.length + idx,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      localPath: URL.createObjectURL(file),
      isInline: true,
      _file: file,
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    showNotification('success', `${files.length} ${t('compose.imageAdded')}`);
  }, [attachments]);

  // Auto-save draft
  const currentDraft = useMemo(() => ({
    id: draftId,
    accountId: defaultAccount?.id || 0,
    to,
    cc,
    bcc,
    subject,
    bodyText: bodyHtml.replace(/<[^>]*>/g, ''), // Strip HTML
    bodyHtml,
    attachments,
    replyToEmailId: mode === 'reply' || mode === 'replyAll' ? originalEmail?.id : undefined,
    forwardEmailId: mode === 'forward' ? originalEmail?.id : undefined,
    composeType: mode,
  }), [draftId, defaultAccount, to, cc, bcc, subject, bodyHtml, attachments, mode, originalEmail]);

  const { saveNow } = useDraftAutoSave(currentDraft, attachments, {
    enabled: isOpen && !isSending,
    debounceMs: 2000,
    onSaveStart: () => setAutoSaveStatus('saving'),
    onSaveSuccess: (id) => {
      setDraftId(id);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    },
    onSaveError: () => setAutoSaveStatus('error'),
  });

  // Initialize form from draft (if editing an existing draft)
  useEffect(() => {
    if (!isOpen || !draft) return;

    setTo(draft.to);
    setCc(draft.cc);
    setBcc(draft.bcc);
    setSubject(draft.subject);
    setBodyHtml(draft.bodyHtml);
    setAttachments(draft.attachments);
    setDraftId(draft.id);
    setShowCc(draft.cc.length > 0);
    setShowBcc(draft.bcc.length > 0);
  }, [isOpen, draft]);

  // Initialize form based on mode
  useEffect(() => {
    if (!isOpen) return;
    if (draft) return; // Skip if we're editing a draft

    if (mode === 'new') {
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject('');
      // Add signature if account has one
      const signature = defaultAccount?.signature;
      if (signature) {
        setBodyHtml(`<br><br><div class="email-signature">${signature}</div>`);
      } else {
        setBodyHtml('');
      }
      setAttachments([]);
      setShowCc(false);
      setShowBcc(false);
    } else if (originalEmail) {
      if (mode === 'reply') {
        setTo([{ email: originalEmail.from.email, name: originalEmail.from.name }]);
        setSubject(originalEmail.subject.startsWith('Re:') ? originalEmail.subject : `${t('compose.replyPrefix')} ${originalEmail.subject}`);
        setBodyHtml(generateQuote(originalEmail));
      } else if (mode === 'replyAll') {
        setTo([{ email: originalEmail.from.email, name: originalEmail.from.name }]);
        setCc(originalEmail.to.filter((addr) => addr.email !== defaultAccount?.email));
        setShowCc(true);
        setSubject(originalEmail.subject.startsWith('Re:') ? originalEmail.subject : `${t('compose.replyPrefix')} ${originalEmail.subject}`);
        setBodyHtml(generateQuote(originalEmail));
      } else if (mode === 'forward') {
        setTo([]);
        setSubject(originalEmail.subject.startsWith('Fwd:') ? originalEmail.subject : `${t('compose.forwardPrefix')} ${originalEmail.subject}`);
        setBodyHtml(generateForwardQuote(originalEmail));
      }
    }
  }, [isOpen, mode, originalEmail, defaultAccount, draft]);


  // Keyboard shortcuts
  useShortcut('Escape', onClose, { enabled: isOpen && !isSending });
  useShortcut('Ctrl+Enter', handleSend, { enabled: isOpen && !isSending, allowInInput: true });
  useShortcut('Ctrl+s', handleSaveDraft, { enabled: isOpen && !isSending, allowInInput: true });
  useShortcut('Ctrl+t', () => setShowTemplateSelector(true), { enabled: isOpen && !isSending, allowInInput: true });

  // SECURITY: Generate sanitized quote for reply
  function generateQuote(email: Email): string {
    const dateStr = new Date(email.date).toLocaleString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // SECURITY: Escape sender name and sanitize body content
    const safeName = escapeHtml(email.from.name || email.from.email);
    // SECURITY: Sanitize email body before including in quote
    const safeBody = sanitizeForCompose(email.bodyHtml || `<p>${escapeHtml(email.bodyText || '')}</p>`);

    const quoteHeader = t('compose.onDateWrote').replace('{date}', escapeHtml(dateStr)).replace('{name}', safeName);

    return `
<br><br>
<div class="email-quote">
  <p class="quote-header">
    ${quoteHeader}
  </p>
  ${safeBody}
</div>
    `.trim();
  }

  // SECURITY: Generate sanitized quote for forward
  function generateForwardQuote(email: Email): string {
    const dateStr = new Date(email.date).toLocaleString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // SECURITY: Escape all user-provided content
    const safeName = escapeHtml(email.from.name || '');
    const safeEmail = escapeHtml(email.from.email);
    const safeSubject = escapeHtml(email.subject);
    const safeRecipients = email.to.map((a) =>
      escapeHtml(a.name ? `${a.name} <${a.email}>` : a.email)
    ).join(', ');
    // SECURITY: Sanitize email body
    const safeBody = sanitizeForCompose(email.bodyHtml || `<p>${escapeHtml(email.bodyText || '')}</p>`);

    return `
<br><br>
<div class="email-forward">
  <p class="forward-header">${t('compose.forwardedMessage')}</p>
  <p class="forward-meta">
    <strong>${t('compose.forwardFrom')}</strong> ${safeName ? `${safeName} &lt;${safeEmail}&gt;` : safeEmail}<br>
    <strong>${t('compose.forwardDate')}</strong> ${escapeHtml(dateStr)}<br>
    <strong>${t('compose.forwardSubject')}</strong> ${safeSubject}<br>
    <strong>${t('compose.forwardTo')}</strong> ${safeRecipients}
  </p>
  <br>
  ${safeBody}
</div>
    `.trim();
  }

  // Handle send
  async function handleSend() {
    if (to.length === 0) {
      showNotification('warning', t('compose.noRecipientError'));
      return;
    }

    setIsSending(true);

    try {
      const draft: DraftEmail = {
        accountId: defaultAccount?.id || 0,
        to,
        cc,
        bcc,
        subject,
        bodyText: bodyHtml.replace(/<[^>]*>/g, ''),
        bodyHtml,
        attachments,
        replyToEmailId: mode === 'reply' || mode === 'replyAll' ? originalEmail?.id : undefined,
        forwardEmailId: mode === 'forward' ? originalEmail?.id : undefined,
        composeType: mode,
      };

      await onSend(draft);

      // Delete auto-saved draft
      if (draftId) {
        try {
          await deleteDraft(draftId);
        } catch (err) {
          log.error('Failed to delete draft:', err);
        }
      }

      onClose();
    } catch (err) {
      // SECURITY: Don't expose detailed error info to users
      log.error('Send failed:', err);
      showNotification('error', t('compose.sendFailed'));
    } finally {
      setIsSending(false);
    }
  }

  // Handle save draft (manual)
  async function handleSaveDraft() {
    setIsSaving(true);

    try {
      await saveNow();
      showNotification('success', t('compose.draftSaved'));
    } catch (err) {
      // SECURITY: Don't expose detailed error info
      log.error('Save draft failed:', err);
      showNotification('error', t('compose.draftSaveError'));
    } finally {
      setIsSaving(false);
    }
  }

  // Handle template selection
  async function handleTemplateSelect(template: EmailTemplate) {
    try {
      // Build context from account and first recipient
      const context = buildTemplateContext(defaultAccount, to[0], undefined, lang);

      // Replace variables in subject and body
      const processedSubject = replaceTemplateVariables(template.subjectTemplate, context);
      const processedBody = replaceTemplateVariables(template.bodyHtmlTemplate, context);

      // Set subject (only if empty)
      if (!subject.trim()) {
        setSubject(processedSubject);
      } else {
        // Ask user if they want to replace existing subject
        if (window.confirm(t('compose.confirmReplaceSubject'))) {
          setSubject(processedSubject);
        }
      }

      // Append body (before signature if exists)
      const signature = defaultAccount?.signature;
      if (signature && bodyHtml.includes('email-signature')) {
        // Insert before signature
        const signatureIndex = bodyHtml.indexOf('<div class="email-signature">');
        const before = bodyHtml.substring(0, signatureIndex);
        const after = bodyHtml.substring(signatureIndex);
        setBodyHtml(before + processedBody + '<br><br>' + after);
      } else {
        // Append at end
        setBodyHtml(bodyHtml + (bodyHtml ? '<br><br>' : '') + processedBody);
      }

      // Increment usage count
      await templateIncrementUsage(template.id);

      showNotification('success', t('compose.templateApplied').replace('{name}', template.name));
    } catch (err) {
      log.error('Failed to apply template:', err);
      showNotification('error', t('compose.templateApplyError'));
    }
  }

  // Handle file attachment
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    // SECURITY: Limit number of attachments
    const MAX_ATTACHMENTS = 10;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      showNotification('warning', t('compose.maxAttachments').replace('{max}', String(MAX_ATTACHMENTS)));
      return;
    }

    // Store files with blob URLs for preview, will upload on send
    const newAttachments: Attachment[] = Array.from(files).map((file, idx) => ({
      index: attachments.length + idx,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      localPath: URL.createObjectURL(file),
      isInline: false,
      _file: file, // Keep File object for upload on send
    }));

    setAttachments([...attachments, ...newAttachments]);
    e.target.value = '';
  }

  // Handle remove attachment
  function handleRemoveAttachment(index: number) {
    setAttachments(attachments.filter((_, i) => i !== index));
  }

  // Handle drag and drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files.length) return;

    // SECURITY: Limit number of attachments
    const MAX_ATTACHMENTS = 10;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      showNotification('warning', t('compose.maxAttachments').replace('{max}', String(MAX_ATTACHMENTS)));
      return;
    }

    const newAttachments: Attachment[] = Array.from(files).map((file, idx) => ({
      index: attachments.length + idx,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      localPath: URL.createObjectURL(file),
      isInline: false,
      _file: file,
    }));

    setAttachments([...attachments, ...newAttachments]);
  }

  const mobile = isMobile();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={`bg-owl-surface shadow-owl-lg flex flex-col overflow-hidden ${
        mobile
          ? 'w-full h-full'
          : 'border border-owl-border rounded-xl w-full max-w-3xl max-h-[90vh]'
      }`}>
        {/* SECURITY: Notification Toast (replaces alert) */}
        {notification && (
          <div
            className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-60 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
              notification.type === 'error'
                ? 'bg-red-900/90 border border-red-500/50 text-red-200'
                : notification.type === 'warning'
                ? 'bg-yellow-900/90 border border-yellow-500/50 text-yellow-200'
                : 'bg-green-900/90 border border-green-500/50 text-green-200'
            }`}
          >
            <span className="text-sm">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-current opacity-70 hover:opacity-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-owl-border ${mobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
          <div className="flex items-center gap-3">
            <h2 className={`font-semibold text-owl-text ${mobile ? 'text-base' : 'text-lg'}`}>
              {mode === 'new' && t('compose.newEmail')}
              {mode === 'reply' && t('compose.reply')}
              {mode === 'replyAll' && t('compose.replyAll')}
              {mode === 'forward' && t('compose.forward')}
            </h2>

            {/* Auto-save indicator */}
            {autoSaveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-xs text-owl-text-secondary">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('compose.saving')}
              </div>
            )}
            {autoSaveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-xs text-green-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('compose.saved')}
              </div>
            )}
            {autoSaveStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs text-red-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('compose.autoSaveError')}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
            >
              {isSaving ? t('compose.saving') : t('compose.saveDraft')}
            </button>
            <button
              onClick={onClose}
              disabled={isSending}
              className="p-2 text-owl-text-secondary hover:text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Recipients */}
        <div className={`py-3 space-y-2 border-b border-owl-border ${mobile ? 'px-4' : 'px-6'}`}>
          {/* To */}
          <div className="flex items-start gap-3">
            <label className="text-sm text-owl-text-secondary w-12 pt-2">{t('compose.toLabel')}</label>
            <div className="flex-1">
              <RecipientInput
                recipients={to}
                onChange={setTo}
                placeholder={t('compose.addRecipientPlaceholder')}
              />
            </div>
            {!showCc && !showBcc && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCc(true)}
                  className="text-sm px-3 py-2 text-owl-text-secondary hover:text-owl-accent"
                >
                  CC
                </button>
                <button
                  onClick={() => setShowBcc(true)}
                  className="text-sm px-3 py-2 text-owl-text-secondary hover:text-owl-accent"
                >
                  BCC
                </button>
              </div>
            )}
          </div>

          {/* CC */}
          {showCc && (
            <div className="flex items-start gap-3">
              <label className="text-sm text-owl-text-secondary w-12 pt-2">{t('compose.cc')}:</label>
              <div className="flex-1">
                <RecipientInput
                  recipients={cc}
                  onChange={setCc}
                  placeholder={t('compose.addCcPlaceholder')}
                />
              </div>
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div className="flex items-start gap-3">
              <label className="text-sm text-owl-text-secondary w-12 pt-2">{t('compose.bcc')}:</label>
              <div className="flex-1">
                <RecipientInput
                  recipients={bcc}
                  onChange={setBcc}
                  placeholder={t('compose.addBccPlaceholder')}
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-owl-text-secondary w-12">{t('compose.subjectLabel')}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('compose.subjectPlaceholder')}
              maxLength={500}
              className="flex-1 px-3 py-2 bg-transparent text-owl-text placeholder-owl-text-secondary focus:outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <RichTextEditor
            content={bodyHtml}
            onChange={(html) => setBodyHtml(html)}
            onPaste={handleImagePaste}
            placeholder={t('compose.bodyPlaceholder')}
            disabled={isSending}
          />
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className={`py-3 border-t border-owl-border ${mobile ? 'px-4' : 'px-6'}`}>
            <AttachmentList
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />
          </div>
        )}

        {/* Footer */}
        <div className={`border-t border-owl-border bg-owl-surface-2/50 flex items-center justify-between ${mobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
          <div className="flex items-center gap-2">
            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface rounded-lg transition-colors"
              title={t('compose.attachTooltip')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* AI Button */}
            <button
              className="p-2.5 text-owl-text-secondary hover:text-owl-accent hover:bg-owl-accent/10 rounded-lg transition-colors"
              title={t('compose.aiTooltip')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

            {/* Template Button */}
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="p-2.5 text-owl-text-secondary hover:text-owl-primary hover:bg-owl-primary/10 rounded-lg transition-colors"
              title={t('compose.templateTooltip')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {!mobile && (
              <span className="text-xs text-owl-text-secondary">
                <kbd className="px-1.5 py-0.5 bg-owl-surface border border-owl-border rounded text-[10px]">Ctrl+Enter</kbd> {t('compose.ctrlEnterSend')}
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={isSending || to.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-owl-accent hover:bg-owl-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('compose.sending')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {t('compose.send')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && defaultAccount && (
        <TemplateSelector
          accountId={defaultAccount.id}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}

export default Compose;
