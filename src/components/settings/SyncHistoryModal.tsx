import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SyncSnapshot } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dataType: 'accounts' | 'contacts' | 'preferences' | 'signatures';
}

export function SyncHistoryModal({ isOpen, onClose, dataType }: Props) {
  const [history, setHistory] = useState<SyncSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, dataType]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshots = await invoke<SyncSnapshot[]>('get_sync_history', {
        dataType,
        limit: 30,
      });
      setHistory(snapshots);
    } catch (err) {
      console.error('Geçmiş yüklenemedi:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleRollbackRequest = (version: number) => {
    setRollbackVersion(version);
    setShowPasswordPrompt(true);
    setMasterPassword('');
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackVersion || !masterPassword) return;

    try {
      await invoke('rollback_sync', {
        dataType,
        version: rollbackVersion,
        masterPassword,
      });
      alert('Geri alma başarılı! Verileriniz seçili versiyona döndürüldü.');
      setShowPasswordPrompt(false);
      setMasterPassword('');
      setRollbackVersion(null);
      onClose();
    } catch (err) {
      alert('Geri alma başarısız: ' + err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getOperationBadge = (operation: string) => {
    const colors = {
      push: 'bg-blue-500/20 text-blue-400',
      pull: 'bg-green-500/20 text-green-400',
      merge: 'bg-purple-500/20 text-purple-400',
    };
    return colors[operation as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
      conflict: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
          className="bg-owl-surface border border-owl-border rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-owl-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-owl-text">
                {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Geçmişi
              </h2>
              <button
                onClick={onClose}
                className="text-owl-text-secondary hover:text-owl-text transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-owl-text-secondary mt-1">
              Son 30 senkronizasyon kaydı
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-owl-accent"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400">Hata: {error}</p>
                <button onClick={loadHistory} className="btn-secondary mt-4">
                  Tekrar Dene
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-owl-text-secondary">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Henüz senkronizasyon geçmişi yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-4 border border-owl-border rounded-lg hover:border-owl-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-owl-text">
                            Versiyon {snap.version}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getOperationBadge(snap.operation)}`}>
                            {snap.operation}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(snap.syncStatus)}`}>
                            {snap.syncStatus}
                          </span>
                        </div>
                        <div className="text-sm text-owl-text-secondary space-y-1">
                          <div className="flex items-center gap-4">
                            <span>{formatDate(snap.createdAt)}</span>
                            <span>•</span>
                            <span>{snap.itemsCount} öğe</span>
                            <span>•</span>
                            <span className="font-mono text-xs">{snap.deviceId.slice(0, 8)}</span>
                          </div>
                          {snap.errorMessage && (
                            <div className="text-red-400 text-xs mt-1">
                              Hata: {snap.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRollbackRequest(snap.version)}
                        className="btn-secondary text-sm whitespace-nowrap ml-4"
                        disabled={snap.syncStatus === 'failed'}
                      >
                        Bu Versiyona Dön
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-owl-border">
            <button onClick={onClose} className="btn-secondary w-full">
              Kapat
            </button>
          </div>
        </div>
      </div>

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-owl-surface border border-owl-border p-6 rounded-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2 text-owl-text">Master Şifre Gerekli</h3>
            <p className="text-sm text-owl-text-secondary mb-4">
              Geri alma işlemi için master şifrenizi girin
            </p>
            <input
              type="password"
              placeholder="Master şifrenizi girin"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRollbackConfirm()}
              className="input w-full mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleRollbackConfirm}
                className="btn-primary flex-1"
                disabled={!masterPassword}
              >
                Onayla
              </button>
              <button
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setMasterPassword('');
                  setRollbackVersion(null);
                }}
                className="btn-secondary flex-1"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
