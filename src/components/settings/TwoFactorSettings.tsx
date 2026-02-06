/**
 * Two-Factor Authentication Settings Component
 * Enable/disable 2FA with QR code setup
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TwoFactorStatus {
  enabled: boolean;
  enabled_at?: string;
  backup_codes_remaining: number;
}

interface TwoFactorSetup {
  secret: string;
  qr_code_url: string;
  manual_entry_key: string;
}

export const TwoFactorSettings = () => {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup flow
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');

  // Load 2FA status
  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await invoke<{ success: boolean; data: TwoFactorStatus }>(
        'sync_get_2fa_status'
      );

      if (response.success) {
        setStatus(response.data);
      }
    } catch (err) {
      console.error('Load 2FA status error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load 2FA status');
    } finally {
      setLoading(false);
    }
  };

  // Start 2FA setup
  const startSetup = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await invoke<{ success: boolean; data: TwoFactorSetup }>(
        'sync_setup_2fa'
      );

      if (response.success) {
        setSetupData(response.data);
        setShowSetup(true);
      } else {
        setError('Failed to initialize 2FA setup');
      }
    } catch (err) {
      console.error('Start 2FA setup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  };

  // Enable 2FA (verify code and get backup codes)
  const enableTwoFactor = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await invoke<{ success: boolean; backup_codes: string[] }>(
        'sync_enable_2fa',
        { token: verificationCode }
      );

      if (response.success) {
        setBackupCodes(response.backup_codes);
        setShowBackupCodes(true);
        setShowSetup(false);
        setVerificationCode('');
        await loadStatus();
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      console.error('Enable 2FA error:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  // Disable 2FA
  const disableTwoFactor = async () => {
    if (!disablePassword || !disableToken) {
      setError('Password and 2FA code are required');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await invoke<{ success: boolean }>(
        'sync_disable_2fa',
        { password: disablePassword, token: disableToken }
      );

      if (response.success) {
        setShowDisable(false);
        setDisablePassword('');
        setDisableToken('');
        await loadStatus();
        alert('2FA disabled successfully. All sessions have been revoked.');
      } else {
        setError('Invalid password or 2FA code');
      }
    } catch (err) {
      console.error('Disable 2FA error:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  // Copy backup codes to clipboard
  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    alert('Backup codes copied to clipboard!');
  };

  // Download backup codes as text file
  const downloadBackupCodes = () => {
    const text = `Owlivion Mail - Two-Factor Authentication Backup Codes
Generated: ${new Date().toLocaleString()}

IMPORTANT: Save these codes in a safe place. Each code can only be used once.

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `owlivion-2fa-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (loading && !status) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          İki Faktörlü Kimlik Doğrulama (2FA)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Hesabınızı ekstra bir güvenlik katmanıyla koruyun
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${status?.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <svg className={`w-6 h-6 ${status?.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                {status?.enabled ? '2FA Aktif' : '2FA Devre Dışı'}
              </h4>
              {status?.enabled && status.enabled_at && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Etkinleştirilme: {new Date(status.enabled_at).toLocaleDateString('tr-TR')}
                </p>
              )}
              {status?.enabled && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Kalan yedek kod: {status.backup_codes_remaining}/10
                </p>
              )}
            </div>
          </div>

          {!status?.enabled ? (
            <button
              onClick={startSetup}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Etkinleştir
            </button>
          ) : (
            <button
              onClick={() => setShowDisable(true)}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Devre Dışı Bırak
            </button>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">2FA Nedir?</p>
            <p>İki faktörlü kimlik doğrulama, şifrenize ek olarak telefonunuzdaki bir uygulamadan alacağınız 6 haneli bir kod gerektirir. Bu sayede şifreniz çalınsa bile hesabınız güvende kalır.</p>
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      {showSetup && setupData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                2FA Kurulumu
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Aşağıdaki adımları takip edin
              </p>
            </div>

            {/* Step 1: QR Code */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Adım 1: QR Kodu Tarayın
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Google Authenticator, Authy veya benzer bir uygulama ile bu QR kodu tarayın:
              </p>
              <div className="bg-white p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-center">
                <img src={setupData.qr_code_url} alt="2FA QR Code" className="w-48 h-48" />
              </div>
              <details className="text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  QR kod çalışmıyor mu? Manuel kod kullanın
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded font-mono break-all">
                  {setupData.manual_entry_key}
                </div>
              </details>
            </div>

            {/* Step 2: Verify */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Adım 2: Kodu Doğrulayın
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uygulamanızda görünen 6 haneli kodu girin:
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSetup(false);
                  setVerificationCode('');
                  setSetupData(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={enableTwoFactor}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Doğrulanıyor...' : 'Doğrula ve Etkinleştir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                ⚠️ Yedek Kodlarınız
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Bu kodlar sadece BİR KEZ gösterilecek! Güvenli bir yere kaydedin.
              </p>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 font-mono text-sm space-y-1">
              {backupCodes.map((code, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400 w-6">{i + 1}.</span>
                  <span className="text-gray-900 dark:text-white">{code}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyBackupCodes}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Kopyala
              </button>
              <button
                onClick={downloadBackupCodes}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                İndir
              </button>
            </div>

            <button
              onClick={() => {
                setShowBackupCodes(false);
                setBackupCodes([]);
              }}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Anladım, Kodları Kaydettim
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Her kod sadece bir kez kullanılabilir. Telefonunuza erişiminiz olmadığında bu kodlardan birini kullanabilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                2FA'yı Devre Dışı Bırak
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                ⚠️ Tüm oturumlarınız sonlandırılacak!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Şifreniz
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  2FA Kodu veya Yedek Kod
                </label>
                <input
                  type="text"
                  value={disableToken}
                  onChange={(e) => setDisableToken(e.target.value)}
                  placeholder="000000 veya XXXX-XXXX"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDisable(false);
                  setDisablePassword('');
                  setDisableToken('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={disableTwoFactor}
                disabled={loading || !disablePassword || !disableToken}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'İşleniyor...' : 'Devre Dışı Bırak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
