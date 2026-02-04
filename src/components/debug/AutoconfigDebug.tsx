// ============================================================================
// Autoconfig Debug Tool - Thunderbird-style Email Detection Diagnostics
// ============================================================================

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AutoConfigDebug {
  email: string;
  domain: string;
  presetTried: boolean;
  presetResult: string | null;
  ispAutoconfigTried: boolean;
  ispAutoconfigResult: string | null;
  wellknownTried: boolean;
  wellknownResult: string | null;
  ispdbTried: boolean;
  ispdbResult: string | null;
  mxLookupTried: boolean;
  mxLookupResult: string | null;
  guessingTried: boolean;
  guessingResult: string | null;
  finalConfig: {
    provider: string | null;
    displayName: string | null;
    imapHost: string;
    imapPort: number;
    imapSecurity: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecurity: string;
    detectionMethod: string | null;
  } | null;
  totalDurationMs: number;
}

export function AutoconfigDebug() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoConfigDebug | null>(null);
  const [error, setError] = useState('');

  const runTest = async () => {
    if (!email) {
      setError('Lütfen bir email adresi girin');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const debugResult = await invoke<AutoConfigDebug>('autoconfig_detect_debug', { email });
      setResult(debugResult);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (result: string | null) => {
    if (!result) return '⏭';
    if (result === 'SUCCESS') return '✅';
    if (result === 'NOT_FOUND') return '⚠️';
    return '❌';
  };

  const getStatusColor = (result: string | null) => {
    if (!result) return 'text-owl-text-secondary';
    if (result === 'SUCCESS') return 'text-owl-success';
    if (result === 'NOT_FOUND') return 'text-owl-warning';
    return 'text-owl-error';
  };

  return (
    <div className="min-h-screen bg-owl-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-owl-surface border border-owl-border rounded-xl shadow-owl-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-owl-border bg-gradient-to-r from-owl-accent/10 to-transparent">
            <h1 className="text-2xl font-bold text-owl-text mb-2">
              🔍 Autoconfig Debug Tool
            </h1>
            <p className="text-sm text-owl-text-secondary">
              Thunderbird-style email otomatik yapılandırma sistemini test edin
            </p>
          </div>

          {/* Input */}
          <div className="p-6 border-b border-owl-border">
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runTest()}
                placeholder="email@example.com"
                className="flex-1 px-4 py-3 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent"
                disabled={loading}
              />
              <button
                onClick={runTest}
                disabled={loading}
                className="px-6 py-3 bg-owl-accent hover:bg-owl-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Test Ediliyor...' : 'Test Et'}
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-owl-error/10 border border-owl-error/20 rounded-lg">
                <p className="text-sm text-owl-error">{error}</p>
              </div>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="bg-owl-surface-2 rounded-lg p-4 border border-owl-border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-owl-text-secondary mb-1">Email</p>
                    <p className="font-mono text-sm text-owl-text">{result.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-owl-text-secondary mb-1">Domain</p>
                    <p className="font-mono text-sm text-owl-text">{result.domain}</p>
                  </div>
                  <div>
                    <p className="text-xs text-owl-text-secondary mb-1">Toplam Süre</p>
                    <p className="font-mono text-sm text-owl-text">{result.totalDurationMs}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-owl-text-secondary mb-1">Detection Method</p>
                    <p className="font-mono text-sm text-owl-accent">
                      {result.finalConfig?.detectionMethod || 'FAILED'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detection Steps */}
              <div>
                <h3 className="text-lg font-semibold text-owl-text mb-3">Detection Steps</h3>
                <div className="space-y-2">
                  {/* Preset */}
                  <DetectionStep
                    icon={getStatusIcon(result.presetResult)}
                    color={getStatusColor(result.presetResult)}
                    title="1. Built-in Presets"
                    description="Major providers (Gmail, Outlook, Yahoo...)"
                    result={result.presetResult}
                    tried={result.presetTried}
                  />

                  {/* ISP Autoconfig */}
                  <DetectionStep
                    icon={getStatusIcon(result.ispAutoconfigResult)}
                    color={getStatusColor(result.ispAutoconfigResult)}
                    title="2. ISP Autoconfig Server"
                    description={`https://autoconfig.${result.domain}/mail/config-v1.1.xml`}
                    result={result.ispAutoconfigResult}
                    tried={result.ispAutoconfigTried}
                  />

                  {/* Well-known */}
                  <DetectionStep
                    icon={getStatusIcon(result.wellknownResult)}
                    color={getStatusColor(result.wellknownResult)}
                    title="3. Well-known URL"
                    description={`https://${result.domain}/.well-known/autoconfig/mail/config-v1.1.xml`}
                    result={result.wellknownResult}
                    tried={result.wellknownTried}
                  />

                  {/* Mozilla ISPDB */}
                  <DetectionStep
                    icon={getStatusIcon(result.ispdbResult)}
                    color={getStatusColor(result.ispdbResult)}
                    title="4. Mozilla ISPDB"
                    description="Thunderbird central database"
                    result={result.ispdbResult}
                    tried={result.ispdbTried}
                  />

                  {/* MX Lookup */}
                  <DetectionStep
                    icon={getStatusIcon(result.mxLookupResult)}
                    color={getStatusColor(result.mxLookupResult)}
                    title="5. MX Record Lookup"
                    description="DNS-based provider detection"
                    result={result.mxLookupResult}
                    tried={result.mxLookupTried}
                  />

                  {/* Smart Guessing */}
                  <DetectionStep
                    icon={getStatusIcon(result.guessingResult)}
                    color={getStatusColor(result.guessingResult)}
                    title="6. Smart Guessing + Port Testing"
                    description="Try common patterns with TCP connection tests"
                    result={result.guessingResult}
                    tried={result.guessingTried}
                  />
                </div>
              </div>

              {/* Final Config */}
              {result.finalConfig && (
                <div>
                  <h3 className="text-lg font-semibold text-owl-text mb-3">Final Configuration</h3>
                  <div className="bg-owl-surface-2 rounded-lg p-4 border border-owl-border">
                    <div className="grid grid-cols-2 gap-4">
                      {result.finalConfig.provider && (
                        <div className="col-span-2">
                          <p className="text-xs text-owl-text-secondary mb-1">Provider</p>
                          <p className="font-semibold text-owl-accent">{result.finalConfig.provider}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-owl-text-secondary mb-1">IMAP Server</p>
                        <p className="font-mono text-sm text-owl-text">{result.finalConfig.imapHost}:{result.finalConfig.imapPort}</p>
                        <p className="text-xs text-owl-text-secondary mt-1">{result.finalConfig.imapSecurity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-owl-text-secondary mb-1">SMTP Server</p>
                        <p className="font-mono text-sm text-owl-text">{result.finalConfig.smtpHost}:{result.finalConfig.smtpPort}</p>
                        <p className="text-xs text-owl-text-secondary mt-1">{result.finalConfig.smtpSecurity}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-owl-surface border border-owl-border rounded-lg p-4">
          <h4 className="font-semibold text-owl-text mb-2">Nasıl Kullanılır?</h4>
          <ul className="text-sm text-owl-text-secondary space-y-1">
            <li>• Email adresinizi girin ve "Test Et" butonuna tıklayın</li>
            <li>• Sistem 6 farklı metodu sırayla deneyecek</li>
            <li>• ✅ = Başarılı, ⚠️ = Bulunamadı, ❌ = Hata, ⏭ = Atlandı</li>
            <li>• İlk başarılı metod bulunduğunda diğerleri atlanır</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DetectionStep({
  icon,
  color,
  title,
  description,
  result,
  tried,
}: {
  icon: string;
  color: string;
  title: string;
  description: string;
  result: string | null;
  tried: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        !tried
          ? 'bg-owl-bg border-owl-border opacity-50'
          : result === 'SUCCESS'
          ? 'bg-owl-success/5 border-owl-success/20'
          : result === 'NOT_FOUND'
          ? 'bg-owl-warning/5 border-owl-warning/20'
          : 'bg-owl-error/5 border-owl-error/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${color}`}>{title}</h4>
          <p className="text-xs text-owl-text-secondary mt-1 break-all">{description}</p>
          {result && result !== 'SUCCESS' && result !== 'NOT_FOUND' && (
            <p className="text-xs text-owl-error mt-2 font-mono">{result}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AutoconfigDebug;
