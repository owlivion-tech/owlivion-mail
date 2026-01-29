// ============================================================================
// Owlivion Mail - Compose Email Modal
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useShortcut } from '../hooks/useKeyboardShortcuts';
import { RecipientInput } from './compose/RecipientInput';
import { AttachmentList } from './compose/AttachmentList';
import type { Email, EmailAddress, DraftEmail, Attachment, Account } from '../types';

interface ComposeProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  originalEmail?: Email;
  onSend: (email: DraftEmail) => Promise<void>;
  onSaveDraft: (email: DraftEmail) => Promise<void>;
  defaultAccount?: Account;
}

export function Compose({
  isOpen,
  onClose,
  mode,
  originalEmail,
  onSend,
  onSaveDraft,
  defaultAccount,
}: ComposeProps) {
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

  // Refs
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form based on mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'new') {
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject('');
      setBodyHtml('');
      setAttachments([]);
      setShowCc(false);
      setShowBcc(false);
    } else if (originalEmail) {
      if (mode === 'reply') {
        setTo([{ email: originalEmail.from.email, name: originalEmail.from.name }]);
        setSubject(originalEmail.subject.startsWith('Re:') ? originalEmail.subject : `Re: ${originalEmail.subject}`);
        setBodyHtml(generateQuote(originalEmail));
      } else if (mode === 'replyAll') {
        setTo([{ email: originalEmail.from.email, name: originalEmail.from.name }]);
        setCc(originalEmail.to.filter((addr) => addr.email !== defaultAccount?.email));
        setShowCc(true);
        setSubject(originalEmail.subject.startsWith('Re:') ? originalEmail.subject : `Re: ${originalEmail.subject}`);
        setBodyHtml(generateQuote(originalEmail));
      } else if (mode === 'forward') {
        setTo([]);
        setSubject(originalEmail.subject.startsWith('Fwd:') ? originalEmail.subject : `Fwd: ${originalEmail.subject}`);
        setBodyHtml(generateForwardQuote(originalEmail));
      }
    }
  }, [isOpen, mode, originalEmail, defaultAccount]);

  // Keyboard shortcuts
  useShortcut('Escape', onClose, { enabled: isOpen && !isSending });
  useShortcut('Ctrl+Enter', handleSend, { enabled: isOpen && !isSending, allowInInput: true });
  useShortcut('Ctrl+s', handleSaveDraft, { enabled: isOpen && !isSending, allowInInput: true });

  // Generate quote for reply
  function generateQuote(email: Email): string {
    const dateStr = new Date(email.date).toLocaleString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
<br><br>
<div style="padding-left: 1em; border-left: 2px solid #8b5cf6; margin-left: 0.5em; color: #71717a;">
  <p style="margin: 0 0 1em 0; font-size: 0.875em;">
    ${dateStr} tarihinde ${email.from.name || email.from.email} yazdı:
  </p>
  ${email.bodyHtml || `<p>${email.bodyText}</p>`}
</div>
    `.trim();
  }

  // Generate quote for forward
  function generateForwardQuote(email: Email): string {
    const dateStr = new Date(email.date).toLocaleString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
<br><br>
<div style="border-top: 1px solid #2a2a3a; padding-top: 1em;">
  <p style="margin: 0; font-size: 0.875em; color: #71717a;">---------- İletilen İleti ----------</p>
  <p style="margin: 0.5em 0; font-size: 0.875em; color: #71717a;">
    <strong>Kimden:</strong> ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}<br>
    <strong>Tarih:</strong> ${dateStr}<br>
    <strong>Konu:</strong> ${email.subject}<br>
    <strong>Kime:</strong> ${email.to.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(', ')}
  </p>
  <br>
  ${email.bodyHtml || `<p>${email.bodyText}</p>`}
</div>
    `.trim();
  }

  // Handle send
  async function handleSend() {
    if (to.length === 0) {
      alert('Lütfen en az bir alıcı girin');
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
        bodyText: bodyRef.current?.innerText || '',
        bodyHtml: bodyRef.current?.innerHTML || '',
        attachments,
        replyToEmailId: mode === 'reply' || mode === 'replyAll' ? originalEmail?.id : undefined,
        forwardEmailId: mode === 'forward' ? originalEmail?.id : undefined,
        composeType: mode,
      };

      await onSend(draft);
      onClose();
    } catch (err) {
      console.error('Send failed:', err);
      alert('E-posta gönderilemedi');
    } finally {
      setIsSending(false);
    }
  }

  // Handle save draft
  async function handleSaveDraft() {
    setIsSaving(true);

    try {
      const draft: DraftEmail = {
        accountId: defaultAccount?.id || 0,
        to,
        cc,
        bcc,
        subject,
        bodyText: bodyRef.current?.innerText || '',
        bodyHtml: bodyRef.current?.innerHTML || '',
        attachments,
        replyToEmailId: mode === 'reply' || mode === 'replyAll' ? originalEmail?.id : undefined,
        forwardEmailId: mode === 'forward' ? originalEmail?.id : undefined,
        composeType: mode,
      };

      await onSaveDraft(draft);
    } catch (err) {
      console.error('Save draft failed:', err);
    } finally {
      setIsSaving(false);
    }
  }

  // Handle file attachment
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      localPath: URL.createObjectURL(file),
      isInline: false,
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

    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      localPath: URL.createObjectURL(file),
      isInline: false,
    }));

    setAttachments([...attachments, ...newAttachments]);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="bg-owl-surface border border-owl-border rounded-xl shadow-owl-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-owl-border">
          <h2 className="text-lg font-semibold text-owl-text">
            {mode === 'new' && 'Yeni E-posta'}
            {mode === 'reply' && 'Yanıtla'}
            {mode === 'replyAll' && 'Tümünü Yanıtla'}
            {mode === 'forward' && 'İlet'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
            >
              {isSaving ? 'Kaydediliyor...' : 'Taslak Kaydet'}
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
        <div className="px-6 py-3 space-y-2 border-b border-owl-border">
          {/* To */}
          <div className="flex items-start gap-3">
            <label className="text-sm text-owl-text-secondary w-12 pt-2">Kime:</label>
            <div className="flex-1">
              <RecipientInput
                recipients={to}
                onChange={setTo}
                placeholder="Alıcı ekle..."
              />
            </div>
            {!showCc && !showBcc && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCc(true)}
                  className="text-xs text-owl-text-secondary hover:text-owl-accent"
                >
                  CC
                </button>
                <button
                  onClick={() => setShowBcc(true)}
                  className="text-xs text-owl-text-secondary hover:text-owl-accent"
                >
                  BCC
                </button>
              </div>
            )}
          </div>

          {/* CC */}
          {showCc && (
            <div className="flex items-start gap-3">
              <label className="text-sm text-owl-text-secondary w-12 pt-2">CC:</label>
              <div className="flex-1">
                <RecipientInput
                  recipients={cc}
                  onChange={setCc}
                  placeholder="CC ekle..."
                />
              </div>
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div className="flex items-start gap-3">
              <label className="text-sm text-owl-text-secondary w-12 pt-2">BCC:</label>
              <div className="flex-1">
                <RecipientInput
                  recipients={bcc}
                  onChange={setBcc}
                  placeholder="BCC ekle..."
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-owl-text-secondary w-12">Konu:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Konu..."
              className="flex-1 px-3 py-2 bg-transparent text-owl-text placeholder-owl-text-secondary focus:outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div
            ref={bodyRef}
            contentEditable
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            className="min-h-[300px] p-6 text-owl-text focus:outline-none email-content"
            data-placeholder="E-posta içeriği..."
            onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
          />
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-6 py-3 border-t border-owl-border">
            <AttachmentList
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-owl-border bg-owl-surface-2/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface rounded-lg transition-colors"
              title="Dosya ekle"
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
              className="p-2 text-owl-text-secondary hover:text-owl-accent hover:bg-owl-accent/10 rounded-lg transition-colors"
              title="AI ile yanıt oluştur"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

            {/* Formatting placeholder */}
            <div className="h-5 w-px bg-owl-border mx-1" />
            <span className="text-xs text-owl-text-secondary">
              Biçimlendirme: <kbd className="px-1 py-0.5 bg-owl-surface border border-owl-border rounded text-[10px]">Ctrl+B</kbd> kalın,{' '}
              <kbd className="px-1 py-0.5 bg-owl-surface border border-owl-border rounded text-[10px]">Ctrl+I</kbd> italik
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-owl-text-secondary">
              <kbd className="px-1.5 py-0.5 bg-owl-surface border border-owl-border rounded text-[10px]">Ctrl+Enter</kbd> gönder
            </span>
            <button
              onClick={handleSend}
              disabled={isSending || to.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-owl-accent hover:bg-owl-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Gönder
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Compose;
