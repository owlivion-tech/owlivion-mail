import { useTranslation } from '../i18n';
import type { CompanyEmail } from '../types';

interface CompanyEmailsPanelProps {
  domain: string;
  emails: CompanyEmail[];
  onClose: () => void;
}

export function CompanyEmailsPanel({ domain, emails, onClose }: CompanyEmailsPanelProps) {
  const { t } = useTranslation();

  const importanceBadge = (importance: string) => {
    switch (importance) {
      case 'vip':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'high':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'low':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-owl-surface-2 text-owl-text-secondary border-owl-border';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-owl-surface border border-owl-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-owl-border">
          <div>
            <h3 className="text-base font-semibold text-owl-text">{t('osint.companyEmails')}</h3>
            <p className="text-xs text-owl-text-secondary">{domain} &bull; {emails.length} {t('osint.emailsFound')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-owl-text-secondary hover:text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {emails.length === 0 ? (
            <div className="text-center py-8 text-owl-text-secondary text-sm">
              {t('osint.noEmailsFound')}
            </div>
          ) : (
            emails.map((ce) => (
              <div
                key={ce.email}
                className="flex items-center gap-3 p-3 rounded-lg bg-owl-bg hover:bg-owl-surface-2 transition-colors"
              >
                {/* Importance badge */}
                <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${importanceBadge(ce.importance)}`}>
                  {ce.importance.toUpperCase()}
                </span>

                {/* Email info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-owl-text truncate">{ce.email}</p>
                  <div className="flex items-center gap-2 text-xs text-owl-text-secondary">
                    {ce.name && <span>{ce.name}</span>}
                    {ce.name && ce.jobTitle && <span>&bull;</span>}
                    {ce.jobTitle && <span>{ce.jobTitle}</span>}
                  </div>
                  {ce.importanceReason && (
                    <p className="text-xs text-owl-text-secondary mt-0.5 italic">{ce.importanceReason}</p>
                  )}
                </div>

                {/* Source */}
                {ce.source && (
                  <span className="flex-shrink-0 text-xs text-owl-text-secondary bg-owl-surface px-2 py-0.5 rounded">
                    {ce.source}
                  </span>
                )}

                {/* Auto-starred indicator */}
                {ce.isAutoStarred && (
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
