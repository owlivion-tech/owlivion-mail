import React, { useState } from 'react';
import { SecurityAlert } from '../../types';

interface SecurityAlertModalProps {
  alerts: SecurityAlert[];
  onAcknowledge: () => void;
  onSecureAccount: () => void;
}

const SecurityAlertModal: React.FC<SecurityAlertModalProps> = ({
  alerts,
  onAcknowledge,
  onSecureAccount,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (alerts.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'medium':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      case 'low':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'low':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getAlertTitle = (type: string) => {
    switch (type) {
      case 'new_location':
        return 'Yeni Konumdan Giriş';
      case 'unusual_time':
        return 'Olağandışı Saat';
      case 'failed_attempts':
        return 'Başarısız Giriş Denemeleri';
      default:
        return 'Güvenlik Uyarısı';
    }
  };

  const getAlertDescription = (alert: SecurityAlert) => {
    switch (alert.alert_type) {
      case 'new_location':
        return `Hesabınıza daha önce kullanılmamış bir konumdan giriş yapıldı: ${
          alert.details?.location || 'Bilinmeyen konum'
        } (IP: ${alert.details?.ip || 'Bilinmiyor'})`;
      case 'unusual_time':
        return `Hesabınıza alışılmadık bir saatte giriş yapıldı (Saat ${
          alert.details?.hour || 'bilinmiyor'
        }:00). Bu, normal giriş saatlerinizden farklı.`;
      case 'failed_attempts':
        return `Son 1 saat içinde ${
          alert.details?.count || 'birçok'
        } başarısız giriş denemesi tespit edildi. Hesabınıza yetkisiz erişim girişimi olabilir.`;
      default:
        return 'Hesabınızda olağandışı bir aktivite tespit edildi.';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'Yüksek Risk';
      case 'medium':
        return 'Orta Risk';
      case 'low':
        return 'Düşük Risk';
      default:
        return 'Bilgi';
    }
  };

  const handleAcknowledge = async () => {
    setIsProcessing(true);
    try {
      await onAcknowledge();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSecureAccount = async () => {
    setIsProcessing(true);
    try {
      await onSecureAccount();
    } finally {
      setIsProcessing(false);
    }
  };

  const highSeverityAlerts = alerts.filter((a) => a.severity === 'high');
  const hasHighSeverity = highSeverityAlerts.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-start">
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                hasHighSeverity
                  ? 'bg-red-100 dark:bg-red-900'
                  : 'bg-orange-100 dark:bg-orange-900'
              }`}
            >
              <svg
                className={`w-6 h-6 ${
                  hasHighSeverity
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Olağandışı Aktivite Tespit Edildi
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Hesabınızda güvenlik ekibimiz tarafından aşağıdaki uyarılar tespit edildi
              </p>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="p-6 space-y-4">
          {alerts.map((alert, index) => (
            <div
              key={alert.id || index}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">{getSeverityIcon(alert.severity)}</div>
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{getAlertTitle(alert.alert_type)}</h3>
                    <span className="text-xs font-medium px-2 py-1 rounded">
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{getAlertDescription(alert)}</p>
                  <p className="text-xs opacity-75">
                    Zaman: {new Date(alert.created_at).toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div className="px-6 pb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Önerilen Güvenlik Önlemleri
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 ml-7">
              <li>• Aktif oturumlarınızı kontrol edin ve tanımadığınız cihazları kapatın</li>
              <li>• İki faktörlü kimlik doğrulamayı (2FA) etkinleştirin</li>
              <li>• Şifrenizi değiştirin (güçlü ve benzersiz bir şifre kullanın)</li>
              <li>• Hesap aktivitelerinizi düzenli olarak gözden geçirin</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAcknowledge}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Bu Bendim, Devam Et
            </button>

            <button
              onClick={handleSecureAccount}
              disabled={isProcessing}
              className={`flex-1 px-4 py-3 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                hasHighSeverity
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {isProcessing ? (
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
                  İşleniyor...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Hesabımı Güvenli Hale Getir
                </>
              )}
            </button>
          </div>

          {hasHighSeverity && (
            <p className="text-xs text-center text-red-600 dark:text-red-400 mt-3">
              ⚠️ Yüksek riskli uyarılar tespit edildi. Hesabınızı derhal güvenli hale getirmenizi
              öneririz.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityAlertModal;
