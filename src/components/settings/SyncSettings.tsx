// ============================================================================
// Owlivion Mail - Sync Settings Component
// ============================================================================

import { useState } from 'react';
import { useSyncConfig, useSyncStatus } from '../../hooks/useSync';
import { formatLastSync, getPlatformIcon } from '../../services/syncService';
import { OwlivionAccountModal } from './OwlivionAccountModal';
import { DeviceManagerModal } from './DeviceManagerModal';
import { ManualSyncModal } from './ManualSyncModal';

export function SyncSettings() {
  const { config, loading, error, update, reload } = useSyncConfig();
  const { statuses, reload: reloadStatus } = useSyncStatus();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [showManualSync, setShowManualSync] = useState(false);

  const handleAccountSuccess = () => {
    reload();
    reloadStatus();
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!config) return;

    try {
      await update({ ...config, enabled });
    } catch (err) {
      console.error('Failed to toggle sync:', err);
    }
  };

  const handleToggleDataType = async (
    dataType: 'syncAccounts' | 'syncContacts' | 'syncPreferences' | 'syncSignatures',
    value: boolean
  ) => {
    if (!config) return;

    try {
      await update({ ...config, [dataType]: value });
    } catch (err) {
      console.error('Failed to update data type:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-owl-text-secondary">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-owl-error/10 border border-owl-error rounded-lg p-4 text-owl-error">
        Senkronizasyon ayarları yüklenemedi: {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-owl-surface border border-owl-border rounded-lg p-4 text-owl-text-secondary">
        Senkronizasyon ayarları bulunamadı
      </div>
    );
  }

  const isAccountConnected = !!(config.enabled && config.userId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-owl-text">Senkronizasyon</h2>
        <p className="text-owl-text-secondary mt-1">
          Verilerinizi cihazlar arası senkronize edin (şifreli ve güvenli)
        </p>
      </div>

      {/* Owlivion Account Status */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Owlivion Hesabı</h3>

        {isAccountConnected ? (
          <div className="space-y-4">
            {/* Account Info */}
            <div className="flex items-center gap-4 p-4 bg-owl-success/10 border border-owl-success rounded-lg">
              <div className="flex-shrink-0 w-12 h-12 bg-owl-success/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-owl-text">Senkronizasyon Aktif</div>
                <div className="text-sm text-owl-text-secondary">
                  Son senkronizasyon: {formatLastSync(config.lastSyncAt)}
                </div>
              </div>
            </div>

            {/* Device Info */}
            <div className="flex items-center justify-between p-4 border border-owl-border rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getPlatformIcon(config.platform)}</span>
                <div>
                  <div className="font-medium text-owl-text">{config.deviceName}</div>
                  <div className="text-sm text-owl-text-secondary">
                    Cihaz ID: {config.deviceId.slice(0, 8)}...
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDeviceManager(true)}
                className="px-3 py-1.5 text-sm text-owl-accent hover:bg-owl-accent/10 rounded-lg transition-colors"
              >
                Cihazları Yönet
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => setShowAccountModal(true)}
              className="w-full px-4 py-2 text-sm text-owl-text-secondary hover:text-owl-error hover:bg-owl-error/10 border border-owl-border rounded-lg transition-colors"
            >
              Hesaptan Çıkış Yap
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-owl-text-secondary">
              Verilerinizi cihazlar arasında senkronize etmek için bir Owlivion Hesabı oluşturun veya giriş yapın.
            </p>
            <button
              onClick={() => setShowAccountModal(true)}
              className="w-full px-4 py-3 bg-owl-accent text-white font-medium rounded-lg hover:bg-owl-accent-hover transition-colors"
            >
              Hesap Oluştur veya Giriş Yap
            </button>
          </div>
        )}
      </section>

      {/* Sync Settings (Only if account connected) */}
      {isAccountConnected && (
        <>
          {/* Enable/Disable Sync */}
          <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-owl-text">Otomatik Senkronizasyon</h3>
                <p className="text-sm text-owl-text-secondary mt-1">
                  Değişiklikler otomatik olarak senkronize edilsin
                </p>
              </div>
              <Toggle
                enabled={config.enabled}
                onChange={handleToggleSync}
              />
            </div>
          </section>

          {/* Data Types */}
          <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
            <h3 className="text-lg font-medium text-owl-text mb-4">Senkronize Edilecek Veriler</h3>

            <div className="space-y-4">
              {/* Accounts */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-owl-text">E-posta Hesapları</label>
                  <p className="text-xs text-owl-text-secondary mt-0.5">
                    IMAP/SMTP ayarları (şifreler hariç)
                  </p>
                </div>
                <Toggle
                  enabled={config.syncAccounts}
                  onChange={(value) => handleToggleDataType('syncAccounts', value)}
                />
              </div>

              {/* Contacts */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-owl-text">Kişiler</label>
                  <p className="text-xs text-owl-text-secondary mt-0.5">
                    Adres defteri kişileri
                  </p>
                </div>
                <Toggle
                  enabled={config.syncContacts}
                  onChange={(value) => handleToggleDataType('syncContacts', value)}
                />
              </div>

              {/* Preferences */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-owl-text">Tercihler</label>
                  <p className="text-xs text-owl-text-secondary mt-0.5">
                    Tema, dil, bildirim ayarları
                  </p>
                </div>
                <Toggle
                  enabled={config.syncPreferences}
                  onChange={(value) => handleToggleDataType('syncPreferences', value)}
                />
              </div>

              {/* Signatures */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-owl-text">İmzalar</label>
                  <p className="text-xs text-owl-text-secondary mt-0.5">
                    E-posta imzaları
                  </p>
                </div>
                <Toggle
                  enabled={config.syncSignatures}
                  onChange={(value) => handleToggleDataType('syncSignatures', value)}
                />
              </div>
            </div>
          </section>

          {/* Sync Status */}
          <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-owl-text">Senkronizasyon Durumu</h3>
              <button
                onClick={() => setShowManualSync(true)}
                className="px-4 py-2 bg-owl-accent text-white text-sm font-medium rounded-lg hover:bg-owl-accent-hover transition-colors"
              >
                Manuel Senkronize Et
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {statuses.map((status) => (
                <div
                  key={status.dataType}
                  className="p-4 border border-owl-border rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-owl-text capitalize">
                      {status.dataType === 'accounts' && 'Hesaplar'}
                      {status.dataType === 'contacts' && 'Kişiler'}
                      {status.dataType === 'preferences' && 'Tercihler'}
                      {status.dataType === 'signatures' && 'İmzalar'}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        status.status === 'syncing'
                          ? 'bg-owl-accent/20 text-owl-accent'
                          : status.status === 'error'
                          ? 'bg-owl-error/20 text-owl-error'
                          : 'bg-owl-success/20 text-owl-success'
                      }`}
                    >
                      {status.status === 'syncing' && 'Senkronize ediliyor'}
                      {status.status === 'error' && 'Hata'}
                      {status.status === 'idle' && 'Hazır'}
                    </span>
                  </div>
                  <div className="text-xs text-owl-text-secondary">
                    Versiyon: {status.version}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Modals */}
      <OwlivionAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        isLoggedIn={isAccountConnected}
        onSuccess={handleAccountSuccess}
      />

      <DeviceManagerModal
        isOpen={showDeviceManager}
        onClose={() => setShowDeviceManager(false)}
        currentDeviceId={config?.deviceId || ''}
      />

      <ManualSyncModal
        isOpen={showManualSync}
        onClose={() => setShowManualSync(false)}
        onSuccess={() => {
          reloadStatus();
          reload();
        }}
      />
    </div>
  );
}

// Toggle Component
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
