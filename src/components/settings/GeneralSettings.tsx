// ============================================================================
// Owlivion Mail - General Settings Component
// ============================================================================

import { useState } from 'react';
import type { Settings } from '../../types';
import { playNotificationSound, getSoundName, getSoundDescription, type NotificationSoundType } from '../../utils/notificationSounds';
import { useTranslation } from '../../i18n';

interface GeneralSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function GeneralSettings({ settings, onSettingsChange }: GeneralSettingsProps) {
  const { t, lang } = useTranslation();
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handlePlaySound = (soundType: NotificationSoundType) => {
    setPlayingSound(soundType);
    playNotificationSound(soundType, 0.5);
    setTimeout(() => setPlayingSound(null), 1000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-owl-text">{t('settings.generalSettings.title')}</h2>
        <p className="text-owl-text-secondary mt-1">
          {t('settings.generalSettings.subtitle')}
        </p>
      </div>

      {/* Appearance */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">{t('settings.generalSettings.appearance')}</h3>

        <div className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.theme')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.themeDesc')}
              </p>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as Settings['theme'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="dark" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.dark')}</option>
              <option value="light" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.light')}</option>
              <option value="system" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.system')}</option>
            </select>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.language')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.languageDesc')}
              </p>
            </div>
            <select
              value={settings.language}
              onChange={(e) => {
                updateSetting('language', e.target.value as Settings['language']);
                window.dispatchEvent(new Event('owlivion-settings-updated'));
              }}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="tr" className="bg-owl-bg text-owl-text">Türkçe</option>
              <option value="en" className="bg-owl-bg text-owl-text">English</option>
            </select>
          </div>

          {/* Compact View */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.compactList')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.compactListDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.compactListView}
              onChange={(value) => updateSetting('compactListView', value)}
            />
          </div>

          {/* Show Avatars */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.showAvatars')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.showAvatarsDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.showAvatars}
              onChange={(value) => updateSetting('showAvatars', value)}
            />
          </div>

          {/* Conversation View */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.conversationView')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.conversationViewDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.conversationView}
              onChange={(value) => updateSetting('conversationView', value)}
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">{t('settings.generalSettings.notifications')}</h3>

        <div className="space-y-4">
          {/* Enable Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.enableNotifications')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.enableNotificationsDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.notificationsEnabled}
              onChange={(value) => updateSetting('notificationsEnabled', value)}
            />
          </div>

          {/* Notification Sound */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.notificationSound')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.notificationSoundDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.notificationSound}
              onChange={(value) => updateSetting('notificationSound', value)}
              disabled={!settings.notificationsEnabled}
            />
          </div>

          {/* Sound Type Selection */}
          {settings.notificationSound && settings.notificationsEnabled && (
            <div className="pl-4 border-l-2 border-owl-border space-y-3">
              <div>
                <label className="text-sm font-medium text-owl-text block mb-2">
                  {t('settings.generalSettings.soundType')}
                </label>
                <div className="space-y-2 mb-3">
                  <div className="text-xs font-medium text-owl-accent uppercase tracking-wide">{t('settings.generalSettings.owlivionSounds')}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['call', 'owlivion', 'whisper', 'moonlight'] as NotificationSoundType[]).map((soundType) => (
                      <button
                        key={soundType}
                        type="button"
                        onClick={() => updateSetting('notificationSoundType', soundType)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                          settings.notificationSoundType === soundType
                            ? 'bg-owl-accent/10 border-owl-accent text-owl-text ring-2 ring-owl-accent/30'
                            : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300 dark:border-amber-700 text-owl-text-secondary hover:border-amber-400 dark:hover:border-amber-600'
                        }`}
                      >
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{getSoundName(soundType, lang)}</div>
                          <div className="text-xs opacity-70">{getSoundDescription(soundType, lang)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySound(soundType);
                          }}
                          disabled={playingSound === soundType}
                          className={`ml-2 p-1.5 rounded-lg transition-colors ${
                            playingSound === soundType
                              ? 'bg-owl-accent text-white'
                              : 'hover:bg-owl-border text-owl-text-secondary hover:text-owl-text'
                          }`}
                          title={t('settings.generalSettings.listenSound')}
                        >
                          {playingSound === soundType ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs font-medium text-owl-text-secondary uppercase tracking-wide mb-2">{t('settings.generalSettings.classicSounds')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['gentle', 'pop', 'chime', 'ding', 'subtle', 'system'] as NotificationSoundType[]).map((soundType) => (
                    <button
                      key={soundType}
                      type="button"
                      onClick={() => updateSetting('notificationSoundType', soundType)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                        settings.notificationSoundType === soundType
                          ? 'bg-owl-accent/10 border-owl-accent text-owl-text'
                          : 'bg-owl-surface-2 border-owl-border text-owl-text-secondary hover:border-owl-text-secondary'
                      }`}
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{getSoundName(soundType, lang)}</div>
                        <div className="text-xs opacity-70">{getSoundDescription(soundType, lang)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySound(soundType);
                        }}
                        disabled={playingSound === soundType}
                        className={`ml-2 p-1.5 rounded-lg transition-colors ${
                          playingSound === soundType
                            ? 'bg-owl-accent text-white'
                            : 'hover:bg-owl-border text-owl-text-secondary hover:text-owl-text'
                        }`}
                        title={t('settings.generalSettings.listenSound')}
                      >
                        {playingSound === soundType ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-owl-text-secondary">
                {t('settings.generalSettings.soundTip')}
              </p>
            </div>
          )}


          {/* Badge Count */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.badgeCounter')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.badgeCounterDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.notificationBadge}
              onChange={(value) => updateSetting('notificationBadge', value)}
              disabled={!settings.notificationsEnabled}
            />
          </div>
        </div>
      </section>

      {/* Behavior */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">{t('settings.generalSettings.behavior')}</h3>

        <div className="space-y-4">
          {/* Auto Mark Read */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.autoMarkRead')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.autoMarkReadDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.autoMarkRead}
              onChange={(value) => updateSetting('autoMarkRead', value)}
            />
          </div>

          {/* Auto Mark Read Delay */}
          {settings.autoMarkRead && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-owl-border">
              <div>
                <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.readDelay')}</label>
                <p className="text-xs text-owl-text-secondary mt-0.5">
                  {t('settings.generalSettings.readDelayDesc')}
                </p>
              </div>
              <select
                value={settings.autoMarkReadDelay}
                onChange={(e) => updateSetting('autoMarkReadDelay', parseInt(e.target.value))}
                className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
              >
                <option value="0" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.immediately')}</option>
                <option value="1" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.second1')}</option>
                <option value="3" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.seconds3')}</option>
                <option value="5" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.seconds5')}</option>
                <option value="10" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.seconds10')}</option>
              </select>
            </div>
          )}

          {/* Confirm Delete */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.confirmDelete')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.confirmDeleteDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.confirmDelete}
              onChange={(value) => updateSetting('confirmDelete', value)}
            />
          </div>

          {/* Confirm Send */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.confirmSend')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.confirmSendDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.confirmSend}
              onChange={(value) => updateSetting('confirmSend', value)}
            />
          </div>

          {/* Close to Tray */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.closeToTray')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.closeToTrayDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.closeToTray}
              onChange={(value) => updateSetting('closeToTray', value)}
            />
          </div>
        </div>
      </section>

      {/* Auto-Sync */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">{t('settings.generalSettings.autoSync')}</h3>

        <div className="space-y-4">
          {/* Enable Auto-Sync */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.enableAutoSync')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.enableAutoSyncDesc')}
              </p>
            </div>
            <Toggle
              enabled={settings.autoSyncEnabled}
              onChange={(value) => updateSetting('autoSyncEnabled', value)}
            />
          </div>

          {/* Auto-Sync Interval */}
          {settings.autoSyncEnabled && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-owl-border">
              <div>
                <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.syncInterval')}</label>
                <p className="text-xs text-owl-text-secondary mt-0.5">
                  {t('settings.generalSettings.syncIntervalDesc')}
                </p>
              </div>
              <select
                value={settings.autoSyncInterval}
                onChange={(e) => updateSetting('autoSyncInterval', parseInt(e.target.value))}
                className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
              >
                <option value="1" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.everyMinute')}</option>
                <option value="2" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.minutes2')}</option>
                <option value="5" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.minutes5')}</option>
                <option value="10" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.minutes10')}</option>
                <option value="15" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.minutes15')}</option>
                <option value="30" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.minutes30')}</option>
                <option value="60" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.minutes60')}</option>
              </select>
            </div>
          )}

          {/* Info */}
          <div className="px-4 py-3 bg-blue-900/10 border border-blue-700/30 rounded-lg">
            <p className="text-xs text-blue-400">
              {t('settings.generalSettings.syncTip')}
            </p>
          </div>
        </div>
      </section>

      {/* Compose */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">{t('settings.generalSettings.writing')}</h3>

        <div className="space-y-4">
          {/* Signature Position */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.signaturePosition')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.signaturePositionDesc')}
              </p>
            </div>
            <select
              value={settings.signaturePosition}
              onChange={(e) => updateSetting('signaturePosition', e.target.value as Settings['signaturePosition'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="bottom" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.signatureBottom')}</option>
              <option value="top" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.signatureTop')}</option>
            </select>
          </div>

          {/* Reply Position */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">{t('settings.generalSettings.replyPosition')}</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                {t('settings.generalSettings.replyPositionDesc')}
              </p>
            </div>
            <select
              value={settings.replyPosition}
              onChange={(e) => updateSetting('replyPosition', e.target.value as Settings['replyPosition'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="top" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.signatureTop')}</option>
              <option value="bottom" className="bg-owl-bg text-owl-text">{t('settings.generalSettings.signatureBottom')}</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}

// Toggle switch component
function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-owl-accent' : 'bg-owl-surface-2 border border-owl-border'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
          enabled ? 'translate-x-6 bg-white' : 'translate-x-1 bg-owl-text-secondary'
        }`}
      />
    </button>
  );
}

export default GeneralSettings;
