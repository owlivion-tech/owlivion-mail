// ============================================================================
// Owlivion Mail - Owlivion Account Modal (Login/Register)
// ============================================================================

import { useState } from 'react';
import { useShortcut } from '../../hooks/useKeyboardShortcuts';
import { registerAccount, loginAccount, logoutAccount } from '../../services/syncService';

interface OwlivionAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  onSuccess: () => void;
}

type Tab = 'login' | 'register';

export function OwlivionAccountModal({
  isOpen,
  onClose,
  isLoggedIn,
  onSuccess,
}: OwlivionAccountModalProps) {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useShortcut('Escape', onClose, { enabled: isOpen && !loading });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'register') {
        if (!masterPassword) {
          setError('Ana şifre gereklidir');
          setLoading(false);
          return;
        }
        await registerAccount(email, password, masterPassword);
      } else {
        await loginAccount(email, password);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutAccount();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Çıkış yapılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-owl-surface border border-owl-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-owl-border">
          <h2 className="text-xl font-semibold text-owl-text">
            {isLoggedIn ? 'Hesaptan Çıkış' : 'Owlivion Hesabı'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoggedIn ? (
            <div className="space-y-4">
              <p className="text-owl-text-secondary">
                Hesaptan çıkış yapmak istediğinizden emin misiniz? Senkronizasyon devre dışı kalacak.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-owl-border text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-owl-error text-white rounded-lg hover:bg-owl-error-hover transition-colors disabled:opacity-50"
                >
                  {loading ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6 p-1 bg-owl-bg rounded-lg">
                <button
                  onClick={() => setTab('login')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    tab === 'login'
                      ? 'bg-owl-surface text-owl-text'
                      : 'text-owl-text-secondary hover:text-owl-text'
                  }`}
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => setTab('register')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    tab === 'register'
                      ? 'bg-owl-surface text-owl-text'
                      : 'text-owl-text-secondary hover:text-owl-text'
                  }`}
                >
                  Hesap Oluştur
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-owl-text mb-2">
                    E-posta
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                    placeholder="ornek@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-owl-text mb-2">
                    Şifre
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>

                {tab === 'register' && (
                  <div>
                    <label htmlFor="masterPassword" className="block text-sm font-medium text-owl-text mb-2">
                      Ana Şifre
                      <span className="text-xs text-owl-text-secondary ml-2">
                        (Verilerinizi şifrelemek için)
                      </span>
                    </label>
                    <input
                      id="masterPassword"
                      type="password"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      required={tab === 'register'}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-owl-text-secondary mt-1">
                      Bu şifre sadece yerel cihazınızda kullanılır ve sunucuya gönderilmez
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-owl-error/10 border border-owl-error rounded-lg text-sm text-owl-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-owl-accent text-white font-medium rounded-lg hover:bg-owl-accent-hover transition-colors disabled:opacity-50"
                >
                  {loading
                    ? 'İşleniyor...'
                    : tab === 'register'
                    ? 'Hesap Oluştur'
                    : 'Giriş Yap'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
