// ============================================================================
// EmailView — Progressive Disclosure Design
// Apple-inspired clarity + Owlivion identity
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from '../i18n';
import owlivionIcon from '../assets/owlivion-logo.svg';
import type { EmailAddress, Account, Settings as SettingsType } from '../types';
import type { PhishingAnalysis, TrackingAnalysis } from '../services/geminiService';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailAttachment {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId?: string;
}

export interface EmailViewEmail {
  id: string;
  from: { name: string; email: string };
  to: EmailAddress[];
  subject: string;
  preview: string;
  body: string;
  bodyHtml?: string;
  bodyText?: string;
  date: Date;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  hasImages: boolean;
  accountId?: string;
  attachments?: EmailAttachment[];
  archived?: boolean;
  deleted?: boolean;
  isDraft?: boolean;
}

export interface EmailViewProps {
  email: EmailViewEmail | null;
  accountId: string | null;
  folder: string;
  showImages: boolean;
  isTrustedSender: boolean;
  onLoadImages: () => void;
  onTrustSender: (email: string) => void;
  onAIReply: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  summary: string | null;
  onSummarize: () => void;
  isSummarizing: boolean;
  phishingAnalysis: PhishingAnalysis | null;
  isAnalyzingPhishing: boolean;
  phishingWarningCollapsed: boolean;
  onTogglePhishingCollapse: () => void;
  trackingAnalysis: TrackingAnalysis | null;
  onDownloadAttachment: (attachmentIndex: number, filename: string) => void;
  selectedAccountId: number | null | 'all';
  accounts: Account[];
  appSettings: SettingsType;
}

// ─── DOMPurify Config ───────────────────────────────────────────────────────

const purifyConfig = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'style', 'meta'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'align', 'valign', 'width', 'height', 'colspan', 'rowspan', 'cellpadding', 'cellspacing', 'border', 'charset'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcset', 'data-src'],
  RETURN_TRUSTED_TYPE: false,
};

function sanitizeEmailHtml(html: string, blockImages: boolean = true, imageHiddenText: string = '[Image hidden]'): string {
  let processed = html;
  if (blockImages) {
    processed = processed.replace(/<img[^>]*>/gi, `<div class="blocked-image">${imageHiddenText}</div>`);
  }
  const config = blockImages ? purifyConfig : {
    ...purifyConfig,
    ALLOWED_TAGS: [...purifyConfig.ALLOWED_TAGS, 'img'],
    ALLOWED_ATTR: [...purifyConfig.ALLOWED_ATTR, 'src', 'alt', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcset', 'data-src'],
  };
  let sanitized = DOMPurify.sanitize(processed, config) as string;
  // Force external links to open in new tab
  sanitized = sanitized.replace(/<a\s+([^>]*href=)/gi, '<a target="_blank" rel="noopener noreferrer" $1');
  // Convert img width/height attributes to inline styles (CSS can't read HTML attributes reliably)
  sanitized = sanitized.replace(/<img([^>]*)\bwidth=["'](\d+)["']([^>]*)>/gi, (match, before, w, after) => {
    const hasStyle = /style=/i.test(before + after);
    if (hasStyle) {
      // Append max-width to existing style
      return match.replace(/style=["']([^"']*)["']/i, `style="$1; max-width:${w}px; width:${w}px;"`);
    }
    return `<img${before} width="${w}"${after} style="max-width:${w}px; width:${w}px;">`;
  });
  return sanitized;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getEmailDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function getAccountColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

function formatFileSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getFileIcon(contentType: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (contentType === 'application/pdf' || ext === 'pdf') return '📄';
  if (['doc', 'docx', 'odt'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '🎵';
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return '🎬';
  return '📎';
}

// ─── Inline Icons ───────────────────────────────────────────────────────────

const Icon = {
  Lock: ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Shield: ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Eye: ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Image: ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Check: ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Warning: ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Sparkles: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  Star: ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  StarFilled: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Reply: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  ),
  ReplyAll: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6M7 10h10a8 8 0 018 8v2M7 10l6 6m-6-6l6-6" />
    </svg>
  ),
  Forward: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
    </svg>
  ),
  Archive: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  Trash: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Summarize: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Download: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Mail: ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  MailOpen: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
    </svg>
  ),
  MailUnread: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      <circle cx="18" cy="5" r="3" fill="currentColor" />
    </svg>
  ),
  ChevronDown: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  ChevronUp: ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
  Spinner: ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function SenderAvatar({ email, name, size = 'lg' }: { email: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const [logoError, setLogoError] = useState(false);
  const domain = getEmailDomain(email);
  const isOwlivion = domain === 'owlivion.com' || domain === 'owlcrypt.com';
  const personalDomains = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me', 'yandex.com', 'mail.ru'];
  const isPersonal = personalDomains.includes(domain);

  const logoUrl = isOwlivion ? owlivionIcon : (!isPersonal && domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);

  const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-11 h-11 text-base' };

  if (logoUrl && !logoError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center shrink-0 ${isOwlivion ? 'bg-owl-accent/10 p-1.5' : 'bg-owl-surface p-1'} border border-owl-border/50`}>
        <img src={logoUrl} alt={name} className={`w-full h-full object-contain ${isOwlivion ? '' : 'rounded-full'}`} onError={() => setLogoError(true)} />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium shrink-0 bg-owl-accent/10 text-owl-accent`}>
      {getInitials(name)}
    </div>
  );
}

function AccountBadge({ accountEmail, accountName: _name, size = 'sm' }: { accountEmail: string; accountName?: string; size?: 'xs' | 'sm' }) {
  const color = getAccountColor(accountEmail);
  const displayText = accountEmail.split('@')[1]?.split('.')[0] || accountEmail.split('@')[0];
  const sizeClasses = { xs: 'text-[10px] px-2 py-0.5 gap-1', sm: 'text-xs px-2.5 py-1 gap-1.5' };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeClasses[size]}`}
      style={{
        background: `${color}15`,
        color: color,
        boxShadow: `0 0 0 1px ${color}20 inset`
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate max-w-[80px]">{displayText}</span>
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EmailView({
  email,
  accountId,
  folder,
  showImages,
  isTrustedSender,
  onLoadImages,
  onTrustSender,
  onAIReply,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onToggleRead,
  summary,
  onSummarize,
  isSummarizing,
  phishingAnalysis,
  isAnalyzingPhishing,
  phishingWarningCollapsed,
  onTogglePhishingCollapse,
  trackingAnalysis,
  onDownloadAttachment,
  selectedAccountId,
  accounts,
  appSettings: _appSettings,
}: EmailViewProps) {
  const { t, lang } = useTranslation();
  const [showSummary, setShowSummary] = useState(true);
  const [processedHtml, setProcessedHtml] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!activePopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePopover]);

  // Process CID inline images
  useEffect(() => {
    if (!email?.bodyHtml || !email?.attachments || !accountId) {
      setProcessedHtml(null);
      return;
    }
    const processCidImages = async () => {
      let html = email.bodyHtml!;
      const cidRegex = /src=["']cid:([^"']+)["']/gi;
      const matches = Array.from(html.matchAll(cidRegex));
      if (matches.length === 0) { setProcessedHtml(html); return; }

      const { downloadAttachment } = await import('../services/mailService');
      for (const match of matches) {
        const fullMatch = match[0];
        const cid = match[1];
        const attachment = email.attachments?.find(att => {
          if (!att.contentId) return false;
          return att.contentId.replace(/^<|>$/g, '') === cid;
        });
        if (attachment && email.id) {
          try {
            const data = await downloadAttachment(accountId, folder, parseInt(email.id), attachment.index);
            html = html.replace(fullMatch, `src="data:${data.contentType};base64,${data.data}"`);
          } catch { /* skip failed inline images */ }
        }
      }
      setProcessedHtml(html);
    };
    processCidImages();
  }, [email?.bodyHtml, email?.attachments, email?.id, accountId, folder]);

  // ── Empty state ──
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-owl-bg">
        <div className="text-center">
          <div className="w-16 h-16 bg-owl-surface rounded-2xl flex items-center justify-center mx-auto mb-4 text-owl-text-secondary">
            <Icon.Mail className="w-7 h-7" />
          </div>
          <p className="text-owl-text-secondary">{t('app.selectEmailToRead')}</p>
          <p className="text-sm text-owl-text-secondary/60 mt-2">
            <kbd className="px-1.5 py-0.5 bg-owl-surface rounded text-xs">?</kbd> for shortcuts
          </p>
        </div>
      </div>
    );
  }

  // ── Computed values ──
  const shouldShowImages = showImages || isTrustedSender;
  const hasHtmlContent = !!email.bodyHtml;
  const htmlToSanitize = processedHtml || email.bodyHtml;
  const sanitizedHtml = hasHtmlContent && htmlToSanitize
    ? sanitizeEmailHtml(htmlToSanitize, !shouldShowImages, t('app.imageHidden'))
    : null;

  const trackerCount = (trackingAnalysis?.trackingPixels?.length || 0) + (trackingAnalysis?.trackingLinks?.length || 0);
  const isPhishingDangerous = phishingAnalysis && phishingAnalysis.score >= 60;

  const accountForBadge = (() => {
    if (selectedAccountId !== 'all' || !email.accountId) return null;
    return accounts.find(a => a.id.toString() === email.accountId) || null;
  })();

  const phishingColor = phishingAnalysis?.riskLevel === 'critical' ? 'red' :
    phishingAnalysis?.riskLevel === 'high' ? 'orange' : 'yellow';

  const nonInlineAttachments = email.attachments?.filter(a => !a.isInline) || [];

  return (
    <div className="flex-1 flex flex-col bg-owl-bg">
      {/* ─── HEADER ─── */}
      <div className="px-6 pt-5 pb-3">
        {/* Subject + Actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-[22px] font-semibold text-owl-text leading-snug tracking-tight flex-1">
            {email.subject}
          </h1>
          <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
            <button
              onClick={onToggleStar}
              className={`p-1.5 rounded-lg transition-all ${email.starred ? 'text-yellow-500 hover:text-yellow-400' : 'text-owl-text-secondary/40 hover:text-owl-text-secondary'}`}
              title={email.starred ? t('emailView.unstarAction') : t('emailView.starAction')}
            >
              {email.starred ? <Icon.StarFilled className="w-5 h-5" /> : <Icon.Star />}
            </button>
            <button
              onClick={onToggleRead}
              className="p-1.5 text-owl-text-secondary/40 hover:text-owl-text-secondary rounded-lg transition-all"
              title={email.read ? t('emailView.markUnread') : t('emailView.markRead')}
            >
              {email.read ? <Icon.MailUnread /> : <Icon.MailOpen />}
            </button>
          </div>
        </div>

        {/* Sender row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <SenderAvatar email={email.from.email} name={email.from.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-owl-text">{email.from.name}</span>
                {isTrustedSender && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    <Icon.Shield className="w-2.5 h-2.5" />
                    {t('emailView.trusted')}
                  </span>
                )}
                {accountForBadge && (
                  <AccountBadge accountEmail={accountForBadge.email} accountName={accountForBadge.displayName} size="xs" />
                )}
              </div>
              <p className="text-[13px] text-owl-text-secondary/70 truncate">
                {email.from.email}
                <span className="mx-1.5 text-owl-text-secondary/30">→</span>
                {email.to.map(r => r.name || r.email).join(', ')}
              </p>
            </div>
          </div>
          <span className="text-[13px] text-owl-text-secondary/60 flex-shrink-0 tabular-nums">
            {email.date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      {/* ─── SECURITY INDICATOR BAR ─── */}
      <div className="px-6 py-2 border-y border-owl-border/30" ref={popoverRef}>
        <div className="flex items-center gap-1.5 flex-wrap relative">
          {/* Encryption — always shown */}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full bg-emerald-500/10 text-emerald-500 select-none">
            <Icon.Lock className="w-3 h-3" />
            {t('emailView.encrypted')}
          </span>

          {/* Tracker shield */}
          {trackingAnalysis?.hasTracking ? (
            <button
              onClick={() => setActivePopover(activePopover === 'tracking' ? null : 'tracking')}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full transition-all ${
                activePopover === 'tracking'
                  ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40'
                  : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/15'
              }`}
            >
              <Icon.Eye className="w-3 h-3" />
              {trackerCount} {t('emailView.trackersBlocked')}
            </button>
          ) : trackingAnalysis ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full bg-emerald-500/10 text-emerald-500 select-none">
              <Icon.Shield className="w-3 h-3" />
              {t('emailView.noTrackers')}
            </span>
          ) : null}

          {/* Image control */}
          {email.hasImages && !shouldShowImages && (
            <button
              onClick={() => setActivePopover(activePopover === 'images' ? null : 'images')}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full transition-all ${
                activePopover === 'images'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
              }`}
            >
              <Icon.Image className="w-3 h-3" />
              {t('emailView.imagesBlockedPill')}
            </button>
          )}

          {/* Phishing status */}
          {isAnalyzingPhishing && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full bg-owl-surface-2 text-owl-text-secondary select-none">
              <Icon.Spinner className="w-3 h-3" />
              {t('emailView.securityAnalyzing')}
            </span>
          )}
          {phishingAnalysis && !isPhishingDangerous && !isAnalyzingPhishing && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full bg-emerald-500/10 text-emerald-500 select-none">
              <Icon.Check className="w-3 h-3" />
              {t('emailView.safe')}
            </span>
          )}

          {/* AI Summary toggle */}
          {(summary || isSummarizing) && (
            <button
              onClick={() => !isSummarizing && setShowSummary(!showSummary)}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-full transition-all ml-auto ${
                showSummary && summary
                  ? 'bg-owl-accent/20 text-owl-accent ring-1 ring-owl-accent/30'
                  : 'bg-owl-accent/10 text-owl-accent hover:bg-owl-accent/15'
              }`}
            >
              {isSummarizing ? <Icon.Spinner className="w-3 h-3" /> : <Icon.Sparkles className="w-3 h-3" />}
              {isSummarizing ? t('emailView.summarizing') : t('emailView.aiSummary')}
            </button>
          )}
        </div>

        {/* ── Popovers ── */}

        {/* Tracking details popover */}
        {activePopover === 'tracking' && trackingAnalysis && (
          <div className="mt-2 p-4 bg-owl-surface border border-owl-border/50 rounded-xl shadow-lg">
            <p className="text-sm font-medium text-owl-text mb-2">{t('emailView.trackingTitle')}</p>
            <p className="text-xs text-owl-text-secondary mb-3">
              {trackingAnalysis.trackingPixels.length > 0 && `${trackingAnalysis.trackingPixels.length} ${t('phishing.trackingPixels')}`}
              {trackingAnalysis.trackingPixels.length > 0 && trackingAnalysis.trackingLinks.length > 0 && ' · '}
              {trackingAnalysis.trackingLinks.length > 0 && `${trackingAnalysis.trackingLinks.length} ${t('phishing.trackingLinks')}`}
            </p>
            {trackingAnalysis.trackingServices.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {trackingAnalysis.trackingServices.map((service, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded-full">{service}</span>
                ))}
              </div>
            )}
            {!shouldShowImages && trackingAnalysis.trackingPixels.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg">
                <Icon.Shield className="w-3.5 h-3.5" />
                {t('emailView.imagesHiddenNoTracking')}
              </div>
            )}
          </div>
        )}

        {/* Image control popover */}
        {activePopover === 'images' && (
          <div className="mt-2 p-4 bg-owl-surface border border-owl-border/50 rounded-xl shadow-lg">
            <p className="text-sm font-medium text-owl-text mb-1">{t('emailView.imagesBlocked')}</p>
            <p className="text-xs text-owl-text-secondary mb-3">{t('emailView.imagesBlockedDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onLoadImages(); setActivePopover(null); }}
                className="text-xs font-medium px-3 py-1.5 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors"
              >
                {t('emailView.showImages')}
              </button>
              <button
                onClick={() => { onTrustSender(email.from.email); setActivePopover(null); }}
                className="text-xs font-medium px-3 py-1.5 bg-owl-surface-2 hover:bg-owl-border text-owl-text rounded-lg transition-colors"
              >
                {t('emailView.alwaysShow')}
              </button>
            </div>
          </div>
        )}

        {/* AI Summary inline panel */}
        {showSummary && summary && (
          <div className="mt-2 p-3.5 bg-owl-accent/5 border border-owl-accent/10 rounded-xl">
            <p className="text-[13px] text-owl-text leading-relaxed">{summary}</p>
          </div>
        )}
      </div>

      {/* ─── PHISHING ALERT BANNER — only for score >= 60 ─── */}
      {isPhishingDangerous && phishingAnalysis && (
        <div className={`mx-6 mt-3 rounded-xl border transition-all ${
          phishingColor === 'red' ? 'bg-red-500/8 border-red-500/25' :
          phishingColor === 'orange' ? 'bg-orange-500/8 border-orange-500/25' :
          'bg-yellow-500/8 border-yellow-500/25'
        }`}>
          {phishingWarningCollapsed ? (
            <button onClick={onTogglePhishingCollapse} className="w-full px-4 py-3 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Icon.Warning className={`w-5 h-5 ${
                  phishingColor === 'red' ? 'text-red-400' :
                  phishingColor === 'orange' ? 'text-orange-400' : 'text-yellow-400'
                }`} />
                <span className={`text-sm font-medium ${
                  phishingColor === 'red' ? 'text-red-400' :
                  phishingColor === 'orange' ? 'text-orange-400' : 'text-yellow-400'
                }`}>
                  {phishingAnalysis.riskLevel === 'critical' ? t('phishing.criticalRisk') :
                   phishingAnalysis.riskLevel === 'high' ? t('phishing.highRisk') : t('phishing.mediumRisk')}
                  <span className="font-normal text-owl-text-secondary ml-2">{phishingAnalysis.score}/100</span>
                </span>
              </div>
              <Icon.ChevronDown className="w-4 h-4 text-owl-text-secondary/40 group-hover:text-owl-text-secondary transition-colors" />
            </button>
          ) : (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Icon.Warning className={`w-5 h-5 ${
                    phishingColor === 'red' ? 'text-red-400' :
                    phishingColor === 'orange' ? 'text-orange-400' : 'text-yellow-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    phishingColor === 'red' ? 'text-red-400' :
                    phishingColor === 'orange' ? 'text-orange-400' : 'text-yellow-400'
                  }`}>
                    {phishingAnalysis.riskLevel === 'critical' ? t('phishing.criticalPhishing') :
                     phishingAnalysis.riskLevel === 'high' ? t('phishing.highPhishing') : t('phishing.mediumPhishingRisk')}
                    <span className="font-normal text-owl-text-secondary ml-2">{phishingAnalysis.score}/100</span>
                  </span>
                </div>
                <button onClick={onTogglePhishingCollapse} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                  <Icon.ChevronUp className="w-4 h-4 text-owl-text-secondary/60" />
                </button>
              </div>
              {phishingAnalysis.reasons.length > 0 && (
                <ul className="text-xs text-owl-text/80 space-y-0.5 ml-8 mb-2">
                  {phishingAnalysis.reasons.slice(0, 3).map((reason, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full bg-current opacity-40 flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                  {phishingAnalysis.reasons.length > 3 && (
                    <li className="text-owl-text-secondary/50">+{phishingAnalysis.reasons.length - 3} more</li>
                  )}
                </ul>
              )}
              {phishingAnalysis.recommendations.length > 0 && (
                <div className="ml-8 pt-2 border-t border-owl-border/20">
                  <ul className="text-xs text-owl-text/70 space-y-0.5">
                    {phishingAnalysis.recommendations.slice(0, 2).map((rec, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-owl-accent mt-0.5 flex-shrink-0">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── EMAIL BODY ─── */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        {hasHtmlContent ? (
          <div
            className="email-content text-owl-text leading-relaxed text-[15px]"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml! }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-owl-text leading-relaxed text-[15px]">
            {email.body}
          </div>
        )}

        {/* Attachments */}
        {nonInlineAttachments.length > 0 && (
          <div className="mt-8 pt-5 border-t border-owl-border/30">
            <p className="text-[11px] font-semibold text-owl-text-secondary/50 uppercase tracking-widest mb-3">
              {t('emailView.attachments')} ({nonInlineAttachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {nonInlineAttachments.map((att) => (
                <button
                  key={att.index}
                  onClick={() => onDownloadAttachment(att.index, att.filename)}
                  className="group flex items-center gap-2.5 px-3 py-2 bg-owl-surface/60 hover:bg-owl-surface border border-owl-border/40 hover:border-owl-accent/40 rounded-xl transition-all"
                  title={`${t('emailView.download')} ${att.filename}`}
                >
                  <span className="text-lg leading-none">{getFileIcon(att.contentType, att.filename)}</span>
                  <div className="text-left min-w-0">
                    <p className="text-[13px] font-medium text-owl-text truncate max-w-[180px] group-hover:text-owl-accent transition-colors">
                      {att.filename}
                    </p>
                    <p className="text-[11px] text-owl-text-secondary/50">{formatFileSize(att.size)}</p>
                  </div>
                  <Icon.Download className="w-3.5 h-3.5 text-owl-text-secondary/30 group-hover:text-owl-accent transition-colors ml-1" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── ACTION BAR ─── */}
      <div className="px-6 py-3 border-t border-owl-border/30">
        <div className="flex items-center gap-1.5">
          {/* Primary: AI Reply */}
          <button
            onClick={onAIReply}
            className="flex items-center gap-2 px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-xl text-sm font-medium transition-all hover:shadow-lg hover:shadow-owl-accent/20"
          >
            <Icon.Sparkles className="w-4 h-4" />
            AI Reply
            <kbd className="text-[10px] bg-white/20 px-1 py-0.5 rounded">G</kbd>
          </button>

          {/* Secondary: Reply */}
          <button
            onClick={onReply}
            className="flex items-center gap-2 px-3.5 py-2 bg-owl-surface hover:bg-owl-surface-2 text-owl-text rounded-xl text-sm transition-colors"
          >
            <Icon.Reply />
            {t('emailView.reply')}
            <kbd className="text-[10px] text-owl-text-secondary bg-owl-bg px-1 py-0.5 rounded">R</kbd>
          </button>

          {/* Icon-only: Reply All, Forward */}
          <button onClick={onReplyAll} className="p-2 text-owl-text-secondary/60 hover:text-owl-text hover:bg-owl-surface rounded-xl transition-all" title={`${t('emailView.replyAll')} (A)`}>
            <Icon.ReplyAll />
          </button>
          <button onClick={onForward} className="p-2 text-owl-text-secondary/60 hover:text-owl-text hover:bg-owl-surface rounded-xl transition-all" title={`${t('emailView.forward')} (F)`}>
            <Icon.Forward />
          </button>

          <div className="flex-1" />

          {/* Summarize */}
          {email.body.length > 500 && !summary && (
            <button
              onClick={onSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-1.5 px-3 py-2 text-owl-accent hover:bg-owl-accent/10 rounded-xl text-sm transition-colors disabled:opacity-50"
              title={t('emailView.summarizeWithAI')}
            >
              {isSummarizing ? <Icon.Spinner className="w-4 h-4" /> : <Icon.Summarize />}
              <span>{t('emailView.summarize')}</span>
            </button>
          )}

          {/* Archive & Delete */}
          <button onClick={onArchive} className="p-2 text-owl-text-secondary/40 hover:text-owl-text hover:bg-owl-surface rounded-xl transition-all" title={`${t('emailView.archiveAction')} (E)`}>
            <Icon.Archive />
          </button>
          <button onClick={onDelete} className="p-2 text-owl-text-secondary/40 hover:text-owl-error hover:bg-owl-error/10 rounded-xl transition-all" title={`${t('emailView.deleteAction')} (#)`}>
            <Icon.Trash />
          </button>
        </div>
      </div>
    </div>
  );
}
