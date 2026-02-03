// ============================================================================
// Owlivion Mail - Manual Sync Modal
// ============================================================================

import { useState } from 'react';
import { useShortcut } from '../../hooks/useKeyboardShortcuts';
import { useSyncTrigger } from '../../hooks/useSync';

interface ManualSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualSyncModal({
  isOpen,
  onClose,
  onSuccess,
}: ManualSyncModalProps) {
  const [masterPassword, setMasterPassword] = useState('');
  const { syncing, result, error, trigger, reset } = useSyncTrigger();

  useShortcut('Escape', () => {
    if (!syncing) {
      reset();
      onClose();
    }
  }, { enabled: isOpen });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await trigger(masterPassword);
      onSuccess();
      setTimeout(() => {
        reset();
        setMasterPassword('');
        onClose();
      }, 2000);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    if (!syncing) {
      reset();
      setMasterPassword('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-owl-surface border border-owl-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-owl-border">
          <h2 className="text-xl font-semibold text-owl-text">
            Manuel Senkronizasyon
          </h2>
          {!syncing && (
            <button
              onClick={handleClose}
              className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="masterPassword" className="block text-sm font-medium text-owl-text mb-2">
                  Ana Şifre
                </label>
                <input
                  id="masterPassword"
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  required
                  disabled={syncing}
                  autoFocus
                  className="w-full px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                  placeholder="••••••••"
                />
                <p className="text-xs text-owl-text-secondary mt-2">
                  Verilerinizi şifrelemek için kullandığınız ana şifreyi girin
                </p>
              </div>

              {error && (
                <div className="p-3 bg-owl-error/10 border border-owl-error rounded-lg text-sm text-owl-error">
                  {error}
                </div>
              )}

              {syncing && (
                <div className="p-4 bg-owl-accent/10 border border-owl-accent rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-owl-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-owl-accent">Senkronize ediliyor...</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={syncing}
                  className="flex-1 px-4 py-2 border border-owl-border text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={syncing || !masterPassword}
                  className="flex-1 px-4 py-2 bg-owl-accent text-white rounded-lg hover:bg-owl-accent-hover transition-colors disabled:opacity-50"
                >
                  {syncing ? 'Senkronize ediliyor...' : 'Senkronize Et'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Success */}
              {result.errors.length === 0 ? (
                <div className="p-4 bg-owl-success/10 border border-owl-success rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-owl-success/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="font-medium text-owl-success">Senkronizasyon Tamamlandı</span>
                  </div>

                  <div className="space-y-2 text-sm text-owl-text-secondary">
                    {result.accountsSynced && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Hesaplar senkronize edildi</span>
                      </div>
                    )}
                    {result.contactsSynced && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Kişiler senkronize edildi</span>
                      </div>
                    )}
                    {result.preferencesSynced && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Tercihler senkronize edildi</span>
                      </div>
                    )}
                    {result.signaturesSynced && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>İmzalar senkronize edildi</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-owl-error/10 border border-owl-error rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-owl-error/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-owl-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="font-medium text-owl-error">Senkronizasyon Hataları</span>
                  </div>

                  <div className="space-y-2 text-sm text-owl-error">
                    {result.errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-owl-accent text-white rounded-lg hover:bg-owl-accent-hover transition-colors"
              >
                Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
