// ============================================================================
// Owlivion Mail - Owlivion Account Modal (Login/Register)
// ============================================================================

import { useState } from 'react';
import { useShortcut } from '../../hooks/useKeyboardShortcuts';
import { registerAccount, loginAccount, logoutAccount, startSync } from '../../services/syncService';
import { isMobile } from '../../hooks/usePlatform';

interface OwlivionAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  onSuccess: () => void;
}

type Tab = 'login' | 'register';

function translateSyncError(msg: string): string {
  if (!msg) return 'Bir hata olustu';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid credentials') || lower.includes('invalid email or password'))
    return 'E-posta veya sifre hatali';
  if (lower.includes('user already exists') || lower.includes('conflict'))
    return 'Bu e-posta adresi zaten kayitli';
  if (lower.includes('unauthorized'))
    return 'Oturum suresi doldu, tekrar giris yapin';
  if (lower.includes('rate limit'))
    return 'Cok fazla deneme yaptiniz, lutfen bekleyin';
  if (lower.includes('network') || lower.includes('request failed') || lower.includes('connect'))
    return 'Sunucuya baglanilamadi, internet baglantinizi kontrol edin';
  if (lower.includes('server error'))
    return 'Sunucu hatasi, daha sonra tekrar deneyin';
  return msg;
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('');
  const mobile = isMobile();

  useShortcut('Escape', onClose, { enabled: isOpen && !loading });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!masterPassword) {
        setError('Ana sifre gereklidir');
        setLoading(false);
        return;
      }

      if (tab === 'register') {
        setStatus('Hesap olusturuluyor...');
        await registerAccount(trimmedEmail, password, masterPassword);
      } else {
        setStatus('Giris yapiliyor...');
        await loginAccount(trimmedEmail, password);
      }

      // Trigger sync to download accounts
      setStatus('Veriler senkronize ediliyor...');
      try {
        await startSync(masterPassword);
      } catch (syncErr) {
        console.warn('Post-login sync warning:', syncErr);
        // Don't block login if sync fails - user can sync later
      }

      setStatus('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Owlivion login/register error:', err);
      const rawMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      setError(translateSyncError(rawMsg));
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
      console.error('Owlivion logout error:', err);
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'Cikis yapilamadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={mobile ? 'w-full h-full bg-owl-surface flex flex-col' : 'w-full max-w-md bg-owl-surface border border-owl-border rounded-xl shadow-2xl'}>
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
        <div className={`p-6 ${mobile ? 'flex-1 overflow-y-auto' : ''}`}>
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
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    spellCheck={false}
                    className="w-full px-4 py-3 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                    placeholder="ornek@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-owl-text mb-2">
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="current-password"
                      spellCheck={false}
                      className="w-full px-4 py-3 pr-12 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-owl-text-secondary hover:text-owl-text transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="masterPassword" className="block text-sm font-medium text-owl-text mb-2">
                    Ana Sifre
                    <span className="text-xs text-owl-text-secondary ml-2">
                      ({tab === 'register' ? 'Verilerinizi sifrelemek icin' : 'Verilerinizi cozemek icin'})
                    </span>
                  </label>
                  <input
                    id="masterPassword"
                    type="password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete={tab === 'register' ? 'new-password' : 'off'}
                    spellCheck={false}
                    className="w-full px-4 py-3 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-owl-text disabled:opacity-50"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-owl-text-secondary mt-1">
                    Bu sifre sadece yerel cihazinizda kullanilir ve sunucuya gonderilmez
                  </p>
                </div>

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
                    ? (status || 'Isleniyor...')
                    : tab === 'register'
                    ? 'Hesap Olustur'
                    : 'Giris Yap'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
