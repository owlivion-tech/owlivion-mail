// ============================================================================
// Owlivion Mail - Sync Settings Component
// ============================================================================

import { useState, useEffect } from 'react';
import { useSyncConfig, useSyncStatus, useScheduler } from '../../hooks/useSync';
import {
  formatLastSync,
  getPlatformIcon,
  getQueueStats,
  retryFailedSyncs,
  clearFailedQueue,
  type QueueStats,
} from '../../services/syncService';
import { OwlivionAccountModal } from './OwlivionAccountModal';
import { DeviceManagerModal } from './DeviceManagerModal';
import { ManualSyncModal } from './ManualSyncModal';
import { SyncHistoryModal } from './SyncHistoryModal';

export function SyncSettings() {
  const { config, loading, error, update, reload } = useSyncConfig();
  const { statuses, reload: reloadStatus } = useSyncStatus();
  const { status: schedulerStatus, loading: schedulerLoading, updateConfig: updateScheduler } = useScheduler();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [showManualSync, setShowManualSync] = useState(false);
  const [historyDataType, setHistoryDataType] = useState<'accounts' | 'contacts' | 'preferences' | 'signatures' | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  const handleAccountSuccess = () => {
    reload();
    reloadStatus();
  };

  // Load queue stats
  useEffect(() => {
    const loadQueueStats = async () => {
      try {
        const stats = await getQueueStats();
        setQueueStats(stats);
      } catch (err) {
        console.error('Failed to load queue stats:', err);
      }
    };

    if (config?.enabled) {
      loadQueueStats();
      // Reload every 30 seconds
      const interval = setInterval(loadQueueStats, 30000);
      return () => clearInterval(interval);
    }
  }, [config?.enabled]);

  const handleRetryFailed = async () => {
    setQueueLoading(true);
    try {
      const count = await retryFailedSyncs();
      console.log(`Retried ${count} failed syncs`);
      // Reload stats
      const stats = await getQueueStats();
      setQueueStats(stats);
    } catch (err) {
      console.error('Failed to retry syncs:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleClearFailed = async () => {
    setQueueLoading(true);
    try {
      const count = await clearFailedQueue();
      console.log(`Cleared ${count} failed items`);
      // Reload stats
      const stats = await getQueueStats();
      setQueueStats(stats);
    } catch (err) {
      console.error('Failed to clear queue:', err);
    } finally {
      setQueueLoading(false);
    }
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
                  <button
                    onClick={() => setHistoryDataType(status.dataType as 'accounts' | 'contacts' | 'preferences' | 'signatures')}
                    className="text-xs text-owl-accent hover:underline mt-2"
                  >
                    📜 Geçmişi Görüntüle
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Background Scheduler Section */}
          <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-owl-text">
                  Otomatik Senkronizasyon Zamanlayıcı
                </h3>
                <p className="text-sm text-owl-text-secondary mt-1">
                  Belirli aralıklarla otomatik olarak veri senkronize et
                </p>
              </div>
              <div className="flex items-center gap-2">
                {schedulerStatus?.running ? (
                  <span className="text-owl-success flex items-center gap-1">
                    <span className="w-2 h-2 bg-owl-success rounded-full animate-pulse"></span>
                    Çalışıyor
                  </span>
                ) : (
                  <span className="text-owl-text-secondary flex items-center gap-1">
                    <span className="w-2 h-2 bg-owl-text-secondary rounded-full"></span>
                    Durduruldu
                  </span>
                )}
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between mb-4 p-4 bg-owl-background rounded-lg">
              <div>
                <label htmlFor="scheduler-enabled" className="text-sm font-medium text-owl-text cursor-pointer">
                  Otomatik Senkronizasyonu Etkinleştir
                </label>
                <p className="text-xs text-owl-text-secondary mt-1">
                  Kapalı olduğunda yalnızca manuel senkronizasyon yapılır
                </p>
              </div>
              <input
                id="scheduler-enabled"
                type="checkbox"
                checked={schedulerStatus?.enabled || false}
                disabled={schedulerLoading}
                onChange={(e) => {
                  updateScheduler(e.target.checked, schedulerStatus?.intervalMinutes || 30);
                }}
                className="h-5 w-5 text-owl-accent focus:ring-owl-accent border-owl-border rounded disabled:opacity-50 cursor-pointer"
              />
            </div>

            {/* Interval Selector */}
            {schedulerStatus?.enabled && (
              <div className="mb-4 p-4 bg-owl-background rounded-lg">
                <label htmlFor="scheduler-interval" className="block text-sm font-medium text-owl-text mb-2">
                  Senkronizasyon Aralığı
                </label>
                <select
                  id="scheduler-interval"
                  value={schedulerStatus?.intervalMinutes || 30}
                  disabled={schedulerLoading}
                  onChange={(e) => {
                    updateScheduler(true, parseInt(e.target.value));
                  }}
                  className="block w-full px-3 py-2 border border-owl-border rounded-md shadow-sm focus:ring-owl-accent focus:border-owl-accent bg-owl-surface text-owl-text disabled:opacity-50 cursor-pointer"
                >
                  <option value="15">15 Dakika</option>
                  <option value="30">30 Dakika (Önerilen)</option>
                  <option value="60">1 Saat</option>
                  <option value="120">2 Saat</option>
                  <option value="240">4 Saat</option>
                </select>
                <p className="text-xs text-owl-text-secondary mt-2">
                  Daha sık senkronizasyon daha fazla ağ kullanımına neden olur
                </p>
              </div>
            )}

            {/* Status Display */}
            {schedulerStatus?.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-owl-background rounded-lg">
                <div>
                  <p className="text-xs text-owl-text-secondary mb-1">Son Otomatik Senkronizasyon</p>
                  <p className="text-sm font-medium text-owl-text">
                    {schedulerStatus.lastRun ? formatLastSync(schedulerStatus.lastRun) : 'Henüz çalışmadı'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-owl-text-secondary mb-1">Sonraki Senkronizasyon</p>
                  <p className="text-sm font-medium text-owl-text">
                    {schedulerStatus.nextRun ? formatLastSync(schedulerStatus.nextRun) : 'Hesaplanıyor...'}
                  </p>
                </div>
              </div>
            )}

            {/* Security Warning */}
            {schedulerStatus?.enabled && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>
                    <strong>Güvenlik Notu:</strong> Otomatik senkronizasyon şu anda şifreleme desteği sunmamaktadır.
                    Hassas verilerin güvenli senkronizasyonu için manuel senkronizasyon kullanın.
                  </span>
                </p>
              </div>
            )}
          </section>

          {/* Offline Queue Status */}
          {queueStats && (queueStats.totalCount > 0) && (
            <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-owl-text">Çevrimdışı Kuyruk</h3>
                <span className="text-xs text-owl-text-secondary">
                  Otomatik yeniden deneme: 30s - 1 saat
                </span>
              </div>

              <div className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {queueStats.pendingCount > 0 && (
                    <div className="p-4 border border-owl-warning rounded-lg">
                      <div className="text-2xl font-bold text-owl-warning">
                        {queueStats.pendingCount}
                      </div>
                      <div className="text-sm text-owl-text-secondary mt-1">
                        Beklemede
                      </div>
                    </div>
                  )}

                  {queueStats.failedCount > 0 && (
                    <div className="p-4 border border-owl-error rounded-lg">
                      <div className="text-2xl font-bold text-owl-error">
                        {queueStats.failedCount}
                      </div>
                      <div className="text-sm text-owl-text-secondary mt-1">
                        Başarısız
                      </div>
                    </div>
                  )}

                  {queueStats.completedCount > 0 && (
                    <div className="p-4 border border-owl-success rounded-lg">
                      <div className="text-2xl font-bold text-owl-success">
                        {queueStats.completedCount}
                      </div>
                      <div className="text-sm text-owl-text-secondary mt-1">
                        Tamamlandı
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(queueStats.failedCount > 0 || queueStats.pendingCount > 0) && (
                  <div className="flex gap-3">
                    {queueStats.failedCount > 0 && (
                      <>
                        <button
                          onClick={handleRetryFailed}
                          disabled={queueLoading}
                          className="flex-1 px-4 py-2 bg-owl-accent text-white text-sm font-medium rounded-lg hover:bg-owl-accent-hover transition-colors disabled:opacity-50"
                        >
                          {queueLoading ? 'İşleniyor...' : 'Başarısızları Tekrar Dene'}
                        </button>
                        <button
                          onClick={handleClearFailed}
                          disabled={queueLoading}
                          className="px-4 py-2 border border-owl-error text-owl-error text-sm font-medium rounded-lg hover:bg-owl-error/10 transition-colors disabled:opacity-50"
                        >
                          Temizle
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="text-xs text-owl-text-secondary">
                  <p>
                    ℹ️ Senkronizasyon başarısız olduğunda (internet yok, sunucu ulaşılamaz),
                    verileriniz otomatik olarak kuyruğa alınır ve yeniden denenir.
                  </p>
                </div>
              </div>
            </section>
          )}
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

      {historyDataType && (
        <SyncHistoryModal
          isOpen={true}
          onClose={() => setHistoryDataType(null)}
          dataType={historyDataType}
        />
      )}
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
