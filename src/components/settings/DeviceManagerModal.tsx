// ============================================================================
// Owlivion Mail - Device Manager Modal
// ============================================================================

import { useState, useEffect } from 'react';
import { useShortcut } from '../../hooks/useKeyboardShortcuts';
import { useDevices } from '../../hooks/useSync';
import { revokeDevice, getPlatformIcon, formatLastSync } from '../../services/syncService';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDeviceId: string;
}

export function DeviceManagerModal({
  isOpen,
  onClose,
  currentDeviceId,
}: DeviceManagerModalProps) {
  const { devices, loading, error, reload } = useDevices();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState('');

  useShortcut('Escape', onClose, { enabled: isOpen && !revokingId });

  useEffect(() => {
    if (isOpen) {
      reload();
    }
  }, [isOpen, reload]);

  if (!isOpen) return null;

  const handleRevoke = async (deviceId: string) => {
    if (deviceId === currentDeviceId) {
      setRevokeError('Aktif cihazı kaldıramazsınız');
      return;
    }

    if (!confirm('Bu cihazın erişimini iptal etmek istediğinizden emin misiniz?')) {
      return;
    }

    setRevokingId(deviceId);
    setRevokeError('');

    try {
      await revokeDevice(deviceId);
      await reload();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Cihaz kaldırılamadı');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-owl-surface border border-owl-border rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-owl-border">
          <div>
            <h2 className="text-xl font-semibold text-owl-text">Cihaz Yönetimi</h2>
            <p className="text-sm text-owl-text-secondary mt-1">
              Senkronize edilen cihazlarınızı görün ve yönetin
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-owl-text-secondary">Yükleniyor...</div>
            </div>
          ) : error ? (
            <div className="p-4 bg-owl-error/10 border border-owl-error rounded-lg text-owl-error">
              {error}
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 text-owl-text-secondary">
              Henüz cihaz bulunamadı
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const isCurrentDevice = device.deviceId === currentDeviceId;

                return (
                  <div
                    key={device.deviceId}
                    className={`p-4 border rounded-lg transition-colors ${
                      isCurrentDevice
                        ? 'border-owl-accent bg-owl-accent/5'
                        : 'border-owl-border hover:bg-owl-surface-2'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Platform Icon */}
                        <div className="text-3xl">{getPlatformIcon(device.platform)}</div>

                        {/* Device Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-owl-text truncate">
                              {device.deviceName}
                            </h3>
                            {isCurrentDevice && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-owl-accent/20 text-owl-accent rounded-full">
                                Bu Cihaz
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-owl-text-secondary mt-1">
                            {device.platform}
                          </p>

                          <div className="flex items-center gap-4 mt-2 text-xs text-owl-text-secondary">
                            <div className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Son görülme: {formatLastSync(device.lastSeenAt)}</span>
                            </div>
                          </div>

                          <p className="text-xs text-owl-text-secondary mt-2 font-mono">
                            ID: {device.deviceId.slice(0, 16)}...
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isCurrentDevice && (
                        <button
                          onClick={() => handleRevoke(device.deviceId)}
                          disabled={revokingId === device.deviceId}
                          className="px-3 py-1.5 text-sm text-owl-error hover:bg-owl-error/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {revokingId === device.deviceId ? 'Kaldırılıyor...' : 'Erişimi İptal Et'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {revokeError && (
            <div className="mt-4 p-3 bg-owl-error/10 border border-owl-error rounded-lg text-sm text-owl-error">
              {revokeError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-owl-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-owl-text-secondary">
              Toplam {devices.length} cihaz
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-owl-accent text-white rounded-lg hover:bg-owl-accent-hover transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
