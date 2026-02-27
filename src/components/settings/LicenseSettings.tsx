// ============================================================================
// Owlivion Mail - License Settings Component
// Pro/Team plan activation and management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  getLicenseStatus,
  activateLicense,
  deactivateLicense,
  isPro,
} from '../../services/licenseService';
import type { LicenseInfo } from '../../services/licenseService';

export function LicenseSettings() {
  const [license, setLicense] = useState<LicenseInfo>({ plan: 'free', status: 'active' });
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const status = await getLicenseStatus();
    setLicense(status);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setMessage(null);

    const result = await activateLicense(licenseKey.trim());

    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Lisans basariyla aktif edildi!' });
      setLicenseKey('');
      if (result.license) setLicense(result.license);
      else fetchStatus();
    } else {
      setMessage({ type: 'error', text: result.error || 'Lisans aktif edilemedi' });
    }

    setActivating(false);
  };

  const handleDeactivate = async () => {
    setActivating(true);
    setMessage(null);

    const result = await deactivateLicense();

    if (result.success) {
      setMessage({ type: 'success', text: 'Lisans bu cihazdan kaldirildi' });
      fetchStatus();
    } else {
      setMessage({ type: 'error', text: result.error || 'Islem basarisiz' });
    }

    setActivating(false);
  };

  const planLabel = {
    free: 'Ucretsiz',
    pro: 'Pro',
    team: 'Takim',
  };

  const planColor = {
    free: 'text-owl-text-secondary',
    pro: 'text-purple-400',
    team: 'text-blue-400',
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-owl-bg-secondary/60 rounded w-1/3" />
        <div className="h-20 bg-owl-bg-secondary/60 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-owl-text-primary mb-1">Plan & Lisans</h3>
        <p className="text-sm text-owl-text-secondary">Mevcut planinisiniz yonetin ve Pro ozelliklerine erisin</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-owl-bg-secondary rounded-xl p-5 border border-owl-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-bold ${planColor[license.plan]}`}>
              {planLabel[license.plan]}
            </div>
            {isPro(license) && (
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-full">
                {license.status === 'active' ? 'Aktif' : license.status === 'expired' ? 'Suresi Dolmus' : 'Iptal'}
              </span>
            )}
          </div>
          {isPro(license) && license.license_key && (
            <span className="text-xs text-owl-text-muted font-mono">{license.license_key}</span>
          )}
        </div>

        {isPro(license) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {license.active_devices !== undefined && (
              <div>
                <span className="text-owl-text-secondary">Aktif Cihaz:</span>{' '}
                <span className="text-owl-text-primary font-medium">
                  {license.active_devices} / {license.max_devices}
                </span>
              </div>
            )}
            {license.expires_at && (
              <div>
                <span className="text-owl-text-secondary">Yenileme:</span>{' '}
                <span className="text-owl-text-primary font-medium">
                  {new Date(license.expires_at).toLocaleDateString('tr-TR')}
                </span>
              </div>
            )}
          </div>
        )}

        {!isPro(license) && (
          <div className="text-sm text-owl-text-secondary">
            <p className="mb-2">Ucretsiz plan: 2 hesap, sifreleme, phishing tespiti dahil.</p>
            <p className="text-owl-text-muted">
              Pro'ya yukselerek sinirsiz hesap, AI akilli siralama ve daha fazlasini edin.
            </p>
          </div>
        )}
      </div>

      {/* Pro Features */}
      {!isPro(license) && (
        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-5 border border-purple-500/20">
          <h4 className="text-sm font-semibold text-owl-text-primary mb-3">Pro Ozellikleri</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-owl-text-secondary">
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Sinirsiz hesap
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> AI akilli siralama
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> E-posta erteleme
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Zamanlanmis gonderim
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Takma adi yonetimi
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Oncelikli destek
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-owl-text-primary">$5</span>
            <span className="text-sm text-owl-text-secondary">/ ay veya $48/yil</span>
          </div>
        </div>
      )}

      {/* License Key Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-owl-text-primary">
          {isPro(license) ? 'Farkli Lisans Anahtari Gir' : 'Lisans Anahtari'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="flex-1 px-3 py-2 bg-owl-bg-primary border border-owl-border rounded-lg text-owl-text-primary placeholder-owl-text-muted text-sm font-mono focus:outline-none focus:border-owl-accent-primary"
          />
          <button
            onClick={handleActivate}
            disabled={activating || !licenseKey.trim()}
            className="px-4 py-2 bg-owl-accent-primary text-white text-sm font-medium rounded-lg hover:bg-owl-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {activating ? 'Aktif ediliyor...' : 'Aktif Et'}
          </button>
        </div>
      </div>

      {/* Deactivate */}
      {isPro(license) && (
        <button
          onClick={handleDeactivate}
          disabled={activating}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Bu cihazdan lisansi kaldir
        </button>
      )}

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
