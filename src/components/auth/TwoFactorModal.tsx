import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TwoFactorModalProps {
  email: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ email, onSuccess, onCancel }) => {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingBackupCodes, setRemainingBackupCodes] = useState<number | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (!useBackupCode && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [useBackupCode]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (index === 5 && value && newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleVerify(code.join(''));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setCode(newCode);
      setError(null);
      // Focus last input
      inputRefs.current[5]?.focus();
      // Auto-submit
      handleVerify(pastedData);
    }
  };

  const handleBackupCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setBackupCode(value);
    setError(null);
  };

  const handleVerify = async (tokenToVerify?: string) => {
    const finalToken = useBackupCode ? backupCode : (tokenToVerify || code.join(''));

    if (!finalToken || (useBackupCode && finalToken.length !== 8) || (!useBackupCode && finalToken.length !== 6)) {
      setError(useBackupCode ? 'Lütfen 8 haneli yedek kodu girin' : 'Lütfen 6 haneli kodu girin');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await invoke<{
        success: boolean;
        message?: string;
        backup_code_used?: boolean;
        remaining_backup_codes?: number;
      }>('sync_verify_2fa', {
        email,
        token: finalToken,
        rememberDevice,
      });

      if (result.success) {
        // Show remaining backup codes if a backup code was used
        if (result.backup_code_used && result.remaining_backup_codes !== undefined) {
          setRemainingBackupCodes(result.remaining_backup_codes);
          // Wait 2 seconds to show the message, then proceed
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else {
          onSuccess();
        }
      } else {
        setError(result.message || 'Doğrulama başarısız');
        // Reset code inputs
        if (!useBackupCode) {
          setCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (err: any) {
      console.error('2FA verification error:', err);
      setError(err.message || 'Doğrulama sırasında bir hata oluştu');
      // Reset code inputs
      if (!useBackupCode) {
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setError(null);
    setCode(['', '', '', '', '', '']);
    setBackupCode('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            İki Faktörlü Doğrulama
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400">
            {useBackupCode
              ? 'Yedek kodunuzu girin'
              : 'Kimlik doğrulama uygulamanızdan 6 haneli kodu girin'}
          </p>
        </div>

        {/* Success message for backup code usage */}
        {remainingBackupCodes !== null && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Yedek kod başarıyla kullanıldı
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Kalan yedek kod sayısı: {remainingBackupCodes}
                </p>
                {remainingBackupCodes <= 2 && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    ⚠️ Yedek kodlarınız azalıyor! Ayarlardan yenilerini oluşturun.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Code input */}
        {!useBackupCode ? (
          <div className="mb-6">
            <div className="flex justify-center gap-2 mb-4">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isVerifying}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
              ))}
            </div>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Kodu yapıştırabilir veya manuel olarak girebilirsiniz
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <input
              type="text"
              value={backupCode}
              onChange={handleBackupCodeChange}
              placeholder="XXXXXXXX"
              maxLength={8}
              disabled={isVerifying}
              className="w-full px-4 py-3 text-center text-xl font-mono font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
              8 haneli yedek kodunuzu girin
            </p>
          </div>
        )}

        {/* Remember device checkbox */}
        <div className="mb-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={isVerifying}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Bu cihazı hatırla (30 gün)
            </span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
            Güvenli bir cihazda değilseniz işaretlemeyin
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || remainingBackupCodes !== null}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isVerifying ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Doğrulanıyor...
              </>
            ) : (
              'Doğrula ve Giriş Yap'
            )}
          </button>

          <button
            onClick={toggleBackupCode}
            disabled={isVerifying || remainingBackupCodes !== null}
            className="w-full px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {useBackupCode ? '← 2FA Koduna Dön' : 'Yedek Kod Kullan'}
          </button>

          <button
            onClick={onCancel}
            disabled={isVerifying || remainingBackupCodes !== null}
            className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            İptal
          </button>
        </div>

        {/* Help text */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            {useBackupCode ? (
              <>
                Yedek kodlarınızı bulamıyor musunuz? Hesap sahibiyle iletişime geçin.
              </>
            ) : (
              <>
                Kimlik doğrulama uygulamanıza erişiminiz yok mu?{' '}
                <button
                  onClick={toggleBackupCode}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  disabled={isVerifying}
                >
                  Yedek kod kullanın
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorModal;
