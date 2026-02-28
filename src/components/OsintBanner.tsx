import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../i18n';
import type { OsintProfile, CompanyEmail, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import * as osintService from '../services/osintService';
import { CompanyEmailsPanel } from './CompanyEmailsPanel';

interface OsintBannerProps {
  senderEmail: string;
  rawHeaders?: string;
  settings: Settings;
}

export function OsintBanner({ senderEmail, rawHeaders, settings }: OsintBannerProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<OsintProfile | null>(null);
  const [companyEmails, setCompanyEmails] = useState<CompanyEmail[]>([]);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompanyPanel, setShowCompanyPanel] = useState(false);
  const [excluded, setExcluded] = useState(false);

  const domain = senderEmail.split('@')[1] || '';

  // Check cache on mount
  useEffect(() => {
    if (!senderEmail || !settings.osintEnabled) return;

    const loadCached = async () => {
      try {
        const cached = await osintService.getProfile(senderEmail);
        if (cached) {
          setProfile(cached);
          if (cached.harvestStatus === 'excluded') {
            setExcluded(true);
          }
        }
        if (domain) {
          const emails = await osintService.getCompanyEmails(domain);
          setCompanyEmails(emails);
        }
      } catch {
        // Silently fail for cache check
      }
    };

    loadCached();
  }, [senderEmail, domain, settings.osintEnabled]);

  // Auto-harvest
  useEffect(() => {
    if (!settings.osintEnabled || !settings.osintAutoHarvest || !senderEmail) return;
    if (profile && (profile.harvestStatus === 'completed' || profile.harvestStatus === 'excluded')) return;
    if (isHarvesting || excluded) return;

    handleHarvest();
  }, [senderEmail, settings.osintEnabled, settings.osintAutoHarvest, profile?.harvestStatus]);

  const handleHarvest = useCallback(async () => {
    if (isHarvesting || !senderEmail) return;
    setIsHarvesting(true);

    try {
      const apiKey = settings.osintClaudeApiKey || DEFAULT_SETTINGS.osintClaudeApiKey;
      const result = await osintService.harvestSender(
        senderEmail,
        rawHeaders,
        apiKey,
        settings.osintDockerContainer,
      );
      setProfile(result);
      if (result.harvestStatus === 'excluded') {
        setExcluded(true);
      }
    } catch (err) {
      console.error('OSINT harvest failed:', err);
    } finally {
      setIsHarvesting(false);
    }
  }, [senderEmail, rawHeaders, settings.osintClaudeApiKey, settings.osintDockerContainer, isHarvesting]);

  const handleHarvestCompany = useCallback(async () => {
    if (!domain) return;
    try {
      const apiKey = settings.osintClaudeApiKey || DEFAULT_SETTINGS.osintClaudeApiKey;
      const emails = await osintService.harvestCompany(
        domain,
        apiKey,
        settings.osintDockerContainer,
      );
      setCompanyEmails(emails);
      setShowCompanyPanel(true);
    } catch (err) {
      console.error('Company harvest failed:', err);
    }
  }, [domain, settings.osintClaudeApiKey, settings.osintDockerContainer]);

  if (!settings.osintEnabled || excluded) return null;

  // Not yet harvested and not auto
  if (!profile && !isHarvesting && !settings.osintAutoHarvest) {
    return (
      <div className="mx-4 mt-3 p-3 bg-owl-surface border border-owl-border rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm text-owl-text-secondary">OSINT</span>
          </div>
          <button
            onClick={handleHarvest}
            className="text-xs px-3 py-1 bg-owl-accent/20 text-owl-accent rounded-md hover:bg-owl-accent/30 transition-colors"
          >
            {t('osint.harvest')}
          </button>
        </div>
      </div>
    );
  }

  // Harvesting in progress
  if (isHarvesting) {
    return (
      <div className="mx-4 mt-3 p-3 bg-owl-surface border border-owl-border rounded-lg">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin text-owl-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-owl-text-secondary">{t('osint.harvesting')}</span>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  // Parse social profiles
  let socialProfiles: Record<string, string> = {};
  try {
    socialProfiles = typeof profile.socialProfiles === 'string'
      ? JSON.parse(profile.socialProfiles)
      : profile.socialProfiles || {};
  } catch {
    socialProfiles = {};
  }

  const hasSocialProfiles = Object.values(socialProfiles).some(v => v && v !== 'null');
  const topCompanyEmails = companyEmails.filter(e => e.importance === 'vip' || e.importance === 'high').slice(0, 3);

  const confidenceColor =
    profile.confidenceScore >= 70 ? 'text-green-400' :
    profile.confidenceScore >= 40 ? 'text-yellow-400' :
    'text-owl-text-secondary';

  return (
    <>
      <div className="mx-4 mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 transition-all">
        {/* Collapsed header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-indigo-400">OSINT</p>
              <p className="text-xs text-owl-text-secondary">
                {profile.personName || profile.company || domain}
                {' '}&bull;{' '}
                <span className={confidenceColor}>{t('osint.confidence')}: {profile.confidenceScore}/100</span>
              </p>
            </div>
          </div>
          <svg className={`w-4 h-4 text-owl-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-indigo-500/20">
            {/* Person info */}
            {(profile.personName || profile.jobTitle || profile.location) && (
              <div className="pt-3">
                <p className="text-xs font-medium text-owl-text-secondary uppercase mb-1">{t('osint.personInfo')}</p>
                <div className="space-y-1 text-sm text-owl-text">
                  {profile.personName && <p>{profile.personName}</p>}
                  {profile.jobTitle && <p className="text-owl-text-secondary">{profile.jobTitle}</p>}
                  {profile.location && (
                    <p className="text-owl-text-secondary flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {profile.location}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Company info */}
            {(profile.company || profile.companyIndustry || profile.companyWebsite) && (
              <div>
                <p className="text-xs font-medium text-owl-text-secondary uppercase mb-1">{t('osint.companyInfo')}</p>
                <div className="space-y-1 text-sm text-owl-text">
                  {profile.company && <p>{profile.company}</p>}
                  {profile.companyIndustry && (
                    <p className="text-owl-text-secondary">{profile.companyIndustry}</p>
                  )}
                  {profile.companySize && (
                    <span className="inline-block text-xs px-2 py-0.5 bg-owl-surface-2 rounded-full text-owl-text-secondary mr-1">
                      {profile.companySize}
                    </span>
                  )}
                  {profile.companyWebsite && (
                    <p className="text-indigo-400 text-xs">{profile.companyWebsite}</p>
                  )}
                </div>
              </div>
            )}

            {/* Social profiles */}
            {hasSocialProfiles && (
              <div>
                <p className="text-xs font-medium text-owl-text-secondary uppercase mb-1">{t('osint.socialProfiles')}</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(socialProfiles).map(([platform, url]) =>
                    url && url !== 'null' ? (
                      <span key={platform} className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full">
                        {platform}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Top company emails */}
            {topCompanyEmails.length > 0 && (
              <div>
                <p className="text-xs font-medium text-owl-text-secondary uppercase mb-1">{t('osint.keyPeople')}</p>
                <div className="space-y-1">
                  {topCompanyEmails.map((ce) => (
                    <div key={ce.email} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        ce.importance === 'vip' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {ce.importance.toUpperCase()}
                      </span>
                      <span className="text-owl-text">{ce.email}</span>
                      {ce.name && <span className="text-owl-text-secondary">({ce.name})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-indigo-500/20">
              <button
                onClick={handleHarvestCompany}
                className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-md hover:bg-indigo-500/30 transition-colors"
              >
                {t('osint.harvestCompanyEmails')}
              </button>
              <button
                onClick={handleHarvest}
                className="text-xs px-3 py-1.5 bg-owl-surface-2 text-owl-text-secondary rounded-md hover:bg-owl-surface hover:text-owl-text transition-colors"
              >
                {t('osint.refresh')}
              </button>
              {companyEmails.length > 0 && (
                <button
                  onClick={() => setShowCompanyPanel(true)}
                  className="text-xs px-3 py-1.5 bg-owl-surface-2 text-owl-text-secondary rounded-md hover:bg-owl-surface hover:text-owl-text transition-colors"
                >
                  {t('osint.viewAllEmails')} ({companyEmails.length})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Company emails modal */}
      {showCompanyPanel && (
        <CompanyEmailsPanel
          domain={domain}
          emails={companyEmails}
          onClose={() => setShowCompanyPanel(false)}
        />
      )}
    </>
  );
}
