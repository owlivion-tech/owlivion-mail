// ============================================================================
// Owlivion Mail - General Settings Component
// ============================================================================

import { useState } from 'react';
import type { Settings } from '../../types';
import { playNotificationSound, getSoundName, getSoundDescription, type NotificationSoundType } from '../../utils/notificationSounds';

interface GeneralSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function GeneralSettings({ settings, onSettingsChange }: GeneralSettingsProps) {
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
        <h2 className="text-2xl font-semibold text-owl-text">Genel Ayarlar</h2>
        <p className="text-owl-text-secondary mt-1">
          Uygulama görünümü ve davranış tercihlerinizi ayarlayın
        </p>
      </div>

      {/* Appearance */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Görünüm</h3>

        <div className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Tema</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Uygulama renk temasını seçin
              </p>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as Settings['theme'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="dark" className="bg-owl-bg text-owl-text">Koyu</option>
              <option value="light" className="bg-owl-bg text-owl-text">Açık</option>
              <option value="system" className="bg-owl-bg text-owl-text">Sistem</option>
            </select>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Dil</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Arayüz dilini seçin
              </p>
            </div>
            <select
              value={settings.language}
              onChange={(e) => updateSetting('language', e.target.value as Settings['language'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="tr" className="bg-owl-bg text-owl-text">Türkçe</option>
              <option value="en" className="bg-owl-bg text-owl-text">English</option>
            </select>
          </div>

          {/* Compact View */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Kompakt Liste</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                E-posta listesinde daha fazla öğe göster
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
              <label className="text-sm font-medium text-owl-text">Avatarları Göster</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Gönderici avatarlarını e-posta listesinde göster
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
              <label className="text-sm font-medium text-owl-text">Konuşma Görünümü</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                İlgili e-postaları grupla
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
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Bildirimler</h3>

        <div className="space-y-4">
          {/* Enable Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Bildirimleri Etkinleştir</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Yeni e-postalar için masaüstü bildirimi al
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
              <label className="text-sm font-medium text-owl-text">Bildirim Sesi</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Yeni e-postalar için ses çal
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
                  Ses Türü
                </label>
                <div className="space-y-2 mb-3">
                  <div className="text-xs font-medium text-owl-accent uppercase tracking-wide">🦉 Owlivion Özel Sesler</div>
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
                          <div className="text-sm font-medium">{getSoundName(soundType)}</div>
                          <div className="text-xs opacity-70">{getSoundDescription(soundType)}</div>
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
                          title="Sesi dinle"
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
                <div className="text-xs font-medium text-owl-text-secondary uppercase tracking-wide mb-2">Klasik Sesler</div>
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
                        <div className="text-sm font-medium">{getSoundName(soundType)}</div>
                        <div className="text-xs opacity-70">{getSoundDescription(soundType)}</div>
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
                        title="Sesi dinle"
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
                💡 Her ses türünü dinlemek için ▶️ butonuna tıklayın
              </p>
            </div>
          )}


          {/* Badge Count */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Sayaç Rozeti</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Dock/taskbar'da okunmamış sayısını göster
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
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Davranış</h3>

        <div className="space-y-4">
          {/* Auto Mark Read */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Otomatik Okundu İşaretle</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                E-postayı görüntülerken otomatik olarak okundu işaretle
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
                <label className="text-sm font-medium text-owl-text">Okundu Gecikmesi</label>
                <p className="text-xs text-owl-text-secondary mt-0.5">
                  E-posta okundu olarak işaretlenmeden önce bekleme süresi
                </p>
              </div>
              <select
                value={settings.autoMarkReadDelay}
                onChange={(e) => updateSetting('autoMarkReadDelay', parseInt(e.target.value))}
                className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
              >
                <option value="0" className="bg-owl-bg text-owl-text">Hemen</option>
                <option value="1" className="bg-owl-bg text-owl-text">1 saniye</option>
                <option value="3" className="bg-owl-bg text-owl-text">3 saniye</option>
                <option value="5" className="bg-owl-bg text-owl-text">5 saniye</option>
                <option value="10" className="bg-owl-bg text-owl-text">10 saniye</option>
              </select>
            </div>
          )}

          {/* Confirm Delete */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Silme Onayı</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                E-posta silmeden önce onay iste
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
              <label className="text-sm font-medium text-owl-text">Gönderme Onayı</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                E-posta göndermeden önce onay iste
              </p>
            </div>
            <Toggle
              enabled={settings.confirmSend}
              onChange={(value) => updateSetting('confirmSend', value)}
            />
          </div>
        </div>
      </section>

      {/* Compose */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Yazma</h3>

        <div className="space-y-4">
          {/* Signature Position */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">İmza Konumu</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                İmzanın yanıtlardaki konumu
              </p>
            </div>
            <select
              value={settings.signaturePosition}
              onChange={(e) => updateSetting('signaturePosition', e.target.value as Settings['signaturePosition'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="bottom" className="bg-owl-bg text-owl-text">Alt (Alıntının altında)</option>
              <option value="top" className="bg-owl-bg text-owl-text">Üst (Alıntının üstünde)</option>
            </select>
          </div>

          {/* Reply Position */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Yanıt Konumu</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Yanıt metninin başlangıç konumu
              </p>
            </div>
            <select
              value={settings.replyPosition}
              onChange={(e) => updateSetting('replyPosition', e.target.value as Settings['replyPosition'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="top" className="bg-owl-bg text-owl-text">Üst (Alıntının üstünde)</option>
              <option value="bottom" className="bg-owl-bg text-owl-text">Alt (Alıntının altında)</option>
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
