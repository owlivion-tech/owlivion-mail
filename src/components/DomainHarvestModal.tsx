import { useState, useCallback } from 'react';
import { useTranslation } from '../i18n';
import type { CompanyEmail, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import * as osintService from '../services/osintService';

interface DomainHarvestModalProps {
  settings: Settings;
  onClose: () => void;
}

export function DomainHarvestModal({ settings, onClose }: DomainHarvestModalProps) {
  const { t } = useTranslation();
  const [domain, setDomain] = useState('');
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [results, setResults] = useState<CompanyEmail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleHarvest = useCallback(async () => {
    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanDomain || !cleanDomain.includes('.')) return;

    setIsHarvesting(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const apiKey = settings.osintClaudeApiKey || DEFAULT_SETTINGS.osintClaudeApiKey;
      const emails = await osintService.harvestCompany(
        cleanDomain,
        apiKey,
        settings.osintDockerContainer,
      );
      setResults(emails);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsHarvesting(false);
    }
  }, [domain, settings]);

  const importanceBadge = (importance: string) => {
    switch (importance) {
      case 'vip': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'high': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-owl-surface-2 text-owl-text-secondary border-owl-border';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-owl-surface border border-owl-border rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-owl-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-owl-text">{t('osint.domainHarvest')}</h3>
              <p className="text-xs text-owl-text-secondary">{t('osint.domainHarvestDesc')}</p>
            </div>
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

        {/* Search */}
        <div className="px-5 py-4 border-b border-owl-border">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHarvest()}
              placeholder="example.com"
              autoFocus
              className="flex-1 px-4 py-2.5 bg-owl-bg border border-owl-border rounded-lg text-sm text-owl-text placeholder-owl-text-secondary focus:border-owl-accent focus:outline-none"
            />
            <button
              onClick={handleHarvest}
              disabled={isHarvesting || !domain.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white text-sm rounded-lg transition-colors"
            >
              {isHarvesting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t('osint.harvesting')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>{t('osint.harvest')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          {isHarvesting && (
            <div className="flex flex-col items-center justify-center py-12 text-owl-text-secondary">
              <svg className="w-8 h-8 animate-spin text-indigo-400 mb-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm">{t('osint.harvestingDomain')}</p>
              <p className="text-xs mt-1 text-owl-text-secondary">theHarvester + crt.sh + Claude AI</p>
            </div>
          )}

          {!isHarvesting && hasSearched && results.length === 0 && !error && (
            <div className="text-center py-12 text-owl-text-secondary text-sm">
              {t('osint.noEmailsFound')}
            </div>
          )}

          {results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-owl-text">
                  {results.length} {t('osint.emailsFound')}
                </p>
                <div className="flex items-center gap-2 text-xs text-owl-text-secondary">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">VIP: {results.filter(e => e.importance === 'vip').length}</span>
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">HIGH: {results.filter(e => e.importance === 'high').length}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {results.map((ce) => (
                  <div
                    key={ce.email}
                    className="flex items-center gap-3 p-3 rounded-lg bg-owl-bg hover:bg-owl-surface-2 transition-colors"
                  >
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${importanceBadge(ce.importance)}`}>
                      {ce.importance.toUpperCase()}
                    </span>
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
                    {ce.source && (
                      <span className="flex-shrink-0 text-xs text-owl-text-secondary bg-owl-surface px-2 py-0.5 rounded">
                        {ce.source}
                      </span>
                    )}
                    {ce.isAutoStarred && (
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isHarvesting && !hasSearched && (
            <div className="text-center py-12 text-owl-text-secondary">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <p className="text-sm">{t('osint.domainHarvestHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
