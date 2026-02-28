import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { MobileEmail } from './types';
import type { Account } from '../../types';
import { useMobileNavigation } from '../../stores/mobileNavigationStore';
import { useTranslation } from '../../i18n';

interface MobileEmailViewProps {
  email: MobileEmail | null;
  accountId: string | null;
  folder: string;
  showImages: boolean;
  isTrustedSender: boolean;
  onLoadImages: () => void;
  onTrustSender: (email: string) => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onDownloadAttachment: (index: number, filename: string) => void;
  summary?: string | null;
  onSummarize?: () => void;
  isSummarizing?: boolean;
  selectedAccountId: number | null | 'all';
  accounts: Account[];
}

const purifyConfig = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'align', 'valign', 'width', 'height', 'colspan', 'rowspan'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'style', 'link', 'meta', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style', 'srcset', 'data-src'],
  RETURN_TRUSTED_TYPE: false,
};

function sanitizeEmailHtml(html: string, blockImages: boolean = true): string {
  let processed = html;
  if (blockImages) {
    processed = processed.replace(/<img[^>]*>/gi, '<div class="blocked-image" style="font-size: 13px;">[Image hidden]</div>');
  }

  const config = blockImages ? purifyConfig : {
    ...purifyConfig,
    ALLOWED_TAGS: [...purifyConfig.ALLOWED_TAGS, 'img'],
    ALLOWED_ATTR: [...purifyConfig.ALLOWED_ATTR, 'src', 'alt', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcset', 'data-src'],
  };

  let sanitized = DOMPurify.sanitize(processed, config) as string;
  sanitized = sanitized.replace(/<a\s+([^>]*href=)/gi, '<a target="_blank" rel="noopener noreferrer" $1');
  return sanitized;
}

function formatFullDate(date: Date, lang: string = 'en'): string {
  return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function MobileEmailView({
  email,
  showImages,
  onLoadImages,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onToggleRead,
  onDownloadAttachment,
  summary,
  onSummarize,
  isSummarizing,
  selectedAccountId,
  accounts,
}: MobileEmailViewProps) {
  const { t, lang } = useTranslation();
  const { pop } = useMobileNavigation();
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [processedHtml, setProcessedHtml] = useState<string | null>(null);

  // Process HTML content
  useEffect(() => {
    if (email?.bodyHtml) {
      setProcessedHtml(sanitizeEmailHtml(email.bodyHtml, !showImages));
    } else {
      setProcessedHtml(null);
    }
  }, [email?.bodyHtml, showImages]);

  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-owl-bg">
        <p className="text-owl-text-secondary text-sm">E-posta secilmedi</p>
      </div>
    );
  }

  const account = selectedAccountId !== 'all'
    ? accounts.find(a => a.id === selectedAccountId)
    : undefined;

  const attachments = email.attachments?.filter(a => !a.isInline) || [];

  return (
    <div className="flex flex-col h-full bg-owl-bg">
      {/* Top bar */}
      <div className="bg-owl-surface border-b border-owl-border safe-area-top" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            onClick={() => pop()}
            className="p-2 rounded-lg text-owl-text-secondary active:bg-owl-bg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* Star */}
          <button
            onClick={onToggleStar}
            className="p-2 rounded-lg active:bg-owl-bg"
          >
            {email.starred ? (
              <svg className="w-5 h-5 fill-yellow-500 text-yellow-500" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            )}
          </button>

          {/* More actions */}
          <div className="relative">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="p-2 rounded-lg text-owl-text-secondary active:bg-owl-bg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>

            {showMoreActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 max-w-[calc(100vw-2rem)] bg-owl-surface border border-owl-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <button onClick={() => { onToggleRead(); setShowMoreActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-owl-text hover:bg-owl-bg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19" /></svg>
                    {email.read ? t('mobile.markUnread') : t('mobile.markRead')}
                  </button>
                  <button onClick={() => { onArchive(); setShowMoreActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-owl-text hover:bg-owl-bg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    {t('mobile.archive')}
                  </button>
                  {onSummarize && (
                    <button onClick={() => { onSummarize(); setShowMoreActions(false); }} disabled={isSummarizing} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-owl-text hover:bg-owl-bg disabled:opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                      {isSummarizing ? t('mobile.summarizing') : t('mobile.aiSummarize')}
                    </button>
                  )}
                  {!showImages && email.hasImages && (
                    <button onClick={() => { onLoadImages(); setShowMoreActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-owl-text hover:bg-owl-bg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {t('mobile.showImages')}
                    </button>
                  )}
                  <div className="border-t border-owl-border" />
                  <button onClick={() => { onDelete(); setShowMoreActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-owl-bg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    {t('mobile.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Email content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Subject */}
          <h1 className="text-xl font-semibold text-owl-text mb-3 break-words">
            {email.subject || t('mobile.noSubject')}
          </h1>

          {/* Sender info */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-owl-accent/20 flex items-center justify-center text-sm font-bold text-owl-accent flex-shrink-0">
              {getInitials(email.from.name || email.from.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-owl-text truncate">
                  {email.from.name || email.from.email}
                </span>
              </div>
              <span className="text-xs text-owl-text-secondary">{email.from.email}</span>
              <div className="text-xs text-owl-text-secondary mt-0.5">
                {formatFullDate(email.date, lang)}
              </div>
              {email.to.length > 0 && (
                <div className="text-xs text-owl-text-secondary mt-0.5 truncate">
                  {t('mobile.to')}: {email.to.map(r => r.name || r.email).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Account badge */}
          {account && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-owl-text-secondary">
              <div className="w-4 h-4 rounded-full bg-owl-accent/20 flex items-center justify-center text-[10px] font-bold text-owl-accent">
                {account.displayName?.charAt(0) || account.email.charAt(0)}
              </div>
              <span>{account.email}</span>
            </div>
          )}

          {/* AI Summary */}
          {summary && (
            <div className="mb-4 p-3 bg-owl-accent/10 border border-owl-accent/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-owl-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-xs font-medium text-owl-accent">{t('mobile.aiSummaryLabel')}</span>
              </div>
              <p className="text-sm text-owl-text leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Email body */}
          <div className="email-content">
            {processedHtml ? (
              <div
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: processedHtml }}
              />
            ) : (
              <pre className="text-sm text-owl-text whitespace-pre-wrap font-sans leading-relaxed">
                {email.bodyText || email.body}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-4 border-t border-owl-border pt-4">
              <h3 className="text-xs font-semibold text-owl-text-secondary uppercase mb-2">
                {t('mobile.attachments').replace('{count}', String(attachments.length))}
              </h3>
              <div className="space-y-2">
                {attachments.map(attachment => (
                  <button
                    key={attachment.index}
                    onClick={() => onDownloadAttachment(attachment.index, attachment.filename)}
                    className="w-full flex items-center gap-3 p-3 bg-owl-surface rounded-lg border border-owl-border active:bg-owl-bg transition-colors"
                  >
                    <div className="w-11 h-11 bg-owl-accent/20 rounded-lg flex items-center justify-center text-owl-accent flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm text-owl-text truncate">{attachment.filename}</div>
                      <div className="text-xs text-owl-text-secondary">{formatFileSize(attachment.size)}</div>
                    </div>
                    <svg className="w-5 h-5 text-owl-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bg-owl-surface border-t border-owl-border safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around py-2">
          <button
            onClick={onReply}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-owl-text-secondary active:text-owl-accent transition-colors min-h-[48px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-xs">{t('mobile.reply')}</span>
          </button>
          <button
            onClick={onReplyAll}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-owl-text-secondary active:text-owl-accent transition-colors min-h-[48px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10h10a8 8 0 018 8v2" />
            </svg>
            <span className="text-xs">{t('mobile.replyAll')}</span>
          </button>
          <button
            onClick={onForward}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-owl-text-secondary active:text-owl-accent transition-colors min-h-[48px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
            <span className="text-xs">{t('mobile.forward')}</span>
          </button>
          <button
            onClick={onDelete}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-owl-text-secondary active:text-red-400 transition-colors min-h-[48px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs">{t('mobile.delete')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
