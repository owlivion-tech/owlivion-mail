import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import type { Settings, OsintExclusion } from '../../types';
import * as osintService from '../../services/osintService';

interface OsintSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function OsintSettings({ settings, onSettingsChange }: OsintSettingsProps) {
  const { t } = useTranslation();
  const [exclusions, setExclusions] = useState<OsintExclusion[]>([]);
  const [dockerStatus, setDockerStatus] = useState<boolean | null>(null);
  const [claudeStatus, setClaudeStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');
  const [newPattern, setNewPattern] = useState('');
  const [newPatternType, setNewPatternType] = useState<'domain' | 'email' | 'regex'>('domain');
  const [newDescription, setNewDescription] = useState('');

  // Load exclusions
  useEffect(() => {
    const loadExclusions = async () => {
      try {
        const list = await osintService.listExclusions();
        setExclusions(list);
      } catch (err) {
        console.error('Failed to load exclusions:', err);
      }
    };
    loadExclusions();
  }, []);

  // Check Docker status
  const checkDocker = useCallback(async () => {
    try {
      const available = await osintService.checkDocker(settings.osintDockerContainer);
      setDockerStatus(available);
    } catch {
      setDockerStatus(false);
    }
  }, [settings.osintDockerContainer]);

  useEffect(() => {
    if (settings.osintEnabled) {
      checkDocker();
    }
  }, [settings.osintEnabled, checkDocker]);

  // Check Claude API key
  const checkClaude = useCallback(() => {
    if (settings.osintClaudeApiKey && settings.osintClaudeApiKey.startsWith('sk-ant-')) {
      setClaudeStatus('valid');
    } else if (settings.osintClaudeApiKey && settings.osintClaudeApiKey.length > 0) {
      setClaudeStatus('invalid');
    } else {
      setClaudeStatus('unchecked');
    }
  }, [settings.osintClaudeApiKey]);

  useEffect(() => {
    checkClaude();
  }, [checkClaude]);

  const handleToggle = (key: keyof Settings, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleChange = (key: keyof Settings, value: string) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleAddExclusion = async () => {
    if (!newPattern.trim()) return;
    try {
      await osintService.addExclusion(newPattern.trim(), newPatternType, newDescription.trim() || undefined);
      const list = await osintService.listExclusions();
      setExclusions(list);
      setNewPattern('');
      setNewDescription('');
    } catch (err) {
      console.error('Failed to add exclusion:', err);
    }
  };

  const handleRemoveExclusion = async (id: number) => {
    try {
      await osintService.removeExclusion(id);
      setExclusions(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to remove exclusion:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-owl-text">{t('osint.settingsTitle')}</h2>
        <p className="text-sm text-owl-text-secondary mt-1">{t('osint.settingsDesc')}</p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-owl-surface rounded-lg border border-owl-border">
        <div>
          <p className="text-sm font-medium text-owl-text">{t('osint.enableOsint')}</p>
          <p className="text-xs text-owl-text-secondary">{t('osint.enableOsintDesc')}</p>
        </div>
        <button
          onClick={() => handleToggle('osintEnabled', !settings.osintEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            settings.osintEnabled ? 'bg-owl-accent' : 'bg-owl-surface-2'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            settings.osintEnabled ? 'translate-x-5' : ''
          }`} />
        </button>
      </div>

      {settings.osintEnabled && (
        <>
          {/* Claude API Key */}
          <div className="p-4 bg-owl-surface rounded-lg border border-owl-border space-y-3">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('osint.claudeApiKey')}</label>
              <p className="text-xs text-owl-text-secondary">{t('osint.claudeApiKeyDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={settings.osintClaudeApiKey || ''}
                onChange={(e) => handleChange('osintClaudeApiKey', e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 px-3 py-2 bg-owl-bg border border-owl-border rounded-md text-sm text-owl-text placeholder-owl-text-secondary focus:border-owl-accent focus:outline-none"
              />
              <span className={`text-xs px-2 py-1 rounded ${
                claudeStatus === 'valid' ? 'bg-green-500/20 text-green-400' :
                claudeStatus === 'invalid' ? 'bg-red-500/20 text-red-400' :
                'bg-owl-surface-2 text-owl-text-secondary'
              }`}>
                {claudeStatus === 'valid' ? t('osint.keyValid') :
                 claudeStatus === 'invalid' ? t('osint.keyInvalid') :
                 t('osint.keyNotSet')}
              </span>
            </div>
          </div>

          {/* Docker Container */}
          <div className="p-4 bg-owl-surface rounded-lg border border-owl-border space-y-3">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('osint.dockerContainer')}</label>
              <p className="text-xs text-owl-text-secondary">{t('osint.dockerContainerDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.osintDockerContainer || 'mpc-kali'}
                onChange={(e) => handleChange('osintDockerContainer', e.target.value)}
                className="flex-1 px-3 py-2 bg-owl-bg border border-owl-border rounded-md text-sm text-owl-text focus:border-owl-accent focus:outline-none"
              />
              <button
                onClick={checkDocker}
                className="px-3 py-2 text-xs bg-owl-surface-2 text-owl-text-secondary rounded-md hover:bg-owl-surface hover:text-owl-text transition-colors"
              >
                {t('osint.checkStatus')}
              </button>
              <span className={`text-xs px-2 py-1 rounded ${
                dockerStatus === true ? 'bg-green-500/20 text-green-400' :
                dockerStatus === false ? 'bg-red-500/20 text-red-400' :
                'bg-owl-surface-2 text-owl-text-secondary'
              }`}>
                {dockerStatus === true ? t('osint.dockerRunning') :
                 dockerStatus === false ? t('osint.dockerStopped') :
                 t('osint.dockerUnknown')}
              </span>
            </div>
          </div>

          {/* Auto Harvest */}
          <div className="flex items-center justify-between p-4 bg-owl-surface rounded-lg border border-owl-border">
            <div>
              <p className="text-sm font-medium text-owl-text">{t('osint.autoHarvest')}</p>
              <p className="text-xs text-owl-text-secondary">{t('osint.autoHarvestDesc')}</p>
            </div>
            <button
              onClick={() => handleToggle('osintAutoHarvest', !settings.osintAutoHarvest)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.osintAutoHarvest ? 'bg-owl-accent' : 'bg-owl-surface-2'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.osintAutoHarvest ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {/* Exclusion List */}
          <div className="p-4 bg-owl-surface rounded-lg border border-owl-border space-y-4">
            <div>
              <p className="text-sm font-medium text-owl-text">{t('osint.exclusionList')}</p>
              <p className="text-xs text-owl-text-secondary">{t('osint.exclusionListDesc')}</p>
            </div>

            {/* Add new */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder={t('osint.patternPlaceholder')}
                  className="w-full px-3 py-2 bg-owl-bg border border-owl-border rounded-md text-sm text-owl-text placeholder-owl-text-secondary focus:border-owl-accent focus:outline-none"
                />
              </div>
              <select
                value={newPatternType}
                onChange={(e) => setNewPatternType(e.target.value as 'domain' | 'email' | 'regex')}
                className="px-3 py-2 bg-owl-bg border border-owl-border rounded-md text-sm text-owl-text focus:border-owl-accent focus:outline-none"
              >
                <option value="domain">Domain</option>
                <option value="email">Email</option>
                <option value="regex">Regex</option>
              </select>
              <button
                onClick={handleAddExclusion}
                disabled={!newPattern.trim()}
                className="px-4 py-2 bg-owl-accent text-white text-sm rounded-md hover:bg-owl-accent/80 transition-colors disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </div>

            {/* Existing exclusions */}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {exclusions.map((excl) => (
                <div key={excl.id} className="flex items-center justify-between px-3 py-2 bg-owl-bg rounded-md group">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 bg-owl-surface-2 rounded text-owl-text-secondary">
                      {excl.patternType}
                    </span>
                    <span className="text-sm text-owl-text">{excl.pattern}</span>
                    {excl.description && (
                      <span className="text-xs text-owl-text-secondary">({excl.description})</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveExclusion(excl.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy note */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">{t('osint.privacyNote')}</p>
                <p className="text-xs text-owl-text-secondary mt-1">{t('osint.privacyNoteDesc')}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
