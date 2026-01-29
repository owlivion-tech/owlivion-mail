// ============================================================================
// Owlivion Mail - Add Account Modal (Thunderbird-style Auto-configuration)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useShortcut } from '../../hooks/useKeyboardShortcuts';
import type { Account, AutoConfig, SecurityType } from '../../types';
import { invoke } from '@tauri-apps/api/core';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (account: Account) => void;
  editAccount?: Account;
}

type Step = 'credentials' | 'detecting' | 'configure' | 'testing' | 'success' | 'error';

export function AddAccountModal({
  isOpen,
  onClose,
  onAccountAdded,
  editAccount,
}: AddAccountModalProps) {
  // Form state
  const [displayName, setDisplayName] = useState(editAccount?.displayName || '');
  const [email, setEmail] = useState(editAccount?.email || '');
  const [password, setPassword] = useState('');

  // Configuration state
  const [config, setConfig] = useState<AutoConfig | null>(null);
  const [imapHost, setImapHost] = useState(editAccount?.imapHost || '');
  const [imapPort, setImapPort] = useState(editAccount?.imapPort || 993);
  const [imapSecurity, setImapSecurity] = useState<SecurityType>(editAccount?.imapSecurity || 'SSL');
  const [smtpHost, setSmtpHost] = useState(editAccount?.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(editAccount?.smtpPort || 587);
  const [smtpSecurity, setSmtpSecurity] = useState<SecurityType>(editAccount?.smtpSecurity || 'STARTTLS');

  // UI state
  const [step, setStep] = useState<Step>(editAccount ? 'configure' : 'credentials');
  const [showManual, setShowManual] = useState(!!editAccount);
  const [error, setError] = useState('');
  const [testProgress, setTestProgress] = useState('');

  // Close on Escape
  useShortcut('Escape', onClose, { enabled: isOpen && step !== 'detecting' && step !== 'testing' });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !editAccount) {
      setDisplayName('');
      setEmail('');
      setPassword('');
      setConfig(null);
      setStep('credentials');
      setShowManual(false);
      setError('');
    }
  }, [isOpen, editAccount]);

  // Auto-detect configuration
  const detectConfig = async () => {
    setStep('detecting');
    setError('');

    try {
      // Call Tauri backend to auto-detect email configuration
      const result = await invoke<AutoConfig>('autoconfig_detect', { email });

      setConfig(result);
      setImapHost(result.imapHost);
      setImapPort(result.imapPort);
      setImapSecurity(result.imapSecurity);
      setSmtpHost(result.smtpHost);
      setSmtpPort(result.smtpPort);
      setSmtpSecurity(result.smtpSecurity);

      if (result.displayName && !displayName) {
        setDisplayName(result.displayName);
      }

      console.log('Autoconfig result:', result);

      setStep('configure');
    } catch (err) {
      console.error('Auto-detect failed:', err);
      // Fallback to manual configuration
      setShowManual(true);
      setStep('configure');
      setError('Otomatik yapılandırma bulunamadı. Lütfen sunucu ayarlarını manuel girin.');
    }
  };

  // Test connection and add account
  const testAndAdd = async () => {
    setStep('testing');
    setError('');
    setTestProgress('IMAP bağlantısı test ediliyor...');

    try {
      // Test IMAP connection
      await invoke('account_test_imap', {
        host: imapHost,
        port: imapPort,
        security: imapSecurity,
        email,
        password,
      });

      setTestProgress('SMTP bağlantısı test ediliyor...');

      // Test SMTP connection
      await invoke('account_test_smtp', {
        host: smtpHost,
        port: smtpPort,
        security: smtpSecurity,
        email,
        password,
      });

      setTestProgress('Hesap kaydediliyor...');

      // Add account
      const accountId = await invoke<number>('account_add', {
        email,
        displayName,
        password,
        imapHost,
        imapPort,
        imapSecurity,
        smtpHost,
        smtpPort,
        smtpSecurity,
        isDefault: true,
      });

      const newAccount: Account = {
        id: accountId,
        email,
        displayName,
        imapHost,
        imapPort,
        imapSecurity,
        smtpHost,
        smtpPort,
        smtpSecurity,
        isActive: true,
        isDefault: true,
        signature: '',
        syncDays: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setStep('success');
      setTimeout(() => {
        onAccountAdded(newAccount);
      }, 1500);
    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      console.error('Connection test error:', err);
      setError(errorMsg || 'Bağlantı testi başarısız oldu');
      setStep('error');
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 'credentials') {
      if (!displayName || !email || !password) {
        setError('Lütfen tüm alanları doldurun');
        return;
      }

      if (showManual) {
        setStep('configure');
      } else {
        detectConfig();
      }
    } else if (step === 'configure') {
      if (!imapHost || !smtpHost) {
        setError('Lütfen sunucu ayarlarını doldurun');
        return;
      }
      testAndAdd();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-owl-surface border border-owl-border rounded-xl shadow-owl-lg w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-owl-border">
          <h2 className="text-lg font-semibold text-owl-text">
            {editAccount ? 'Hesabı Düzenle' : 'Hesap Ekle'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-owl-text-secondary hover:text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors"
            disabled={step === 'detecting' || step === 'testing'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Step Indicator */}
            {!editAccount && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <StepDot active={step === 'credentials'} completed={step !== 'credentials'} />
                <div className="w-8 h-px bg-owl-border" />
                <StepDot active={step === 'detecting' || step === 'configure'} completed={step === 'testing' || step === 'success'} />
                <div className="w-8 h-px bg-owl-border" />
                <StepDot active={step === 'testing' || step === 'success' || step === 'error'} completed={step === 'success'} />
              </div>
            )}

            {/* Credentials Step */}
            {step === 'credentials' && (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-owl-text mb-2">
                      Görünen Ad
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Berkan Çetinel"
                      className="w-full px-4 py-3 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-owl-text mb-2">
                      E-posta Adresi
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@gmail.com"
                      className="w-full px-4 py-3 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-owl-text mb-2">
                      Şifre
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent focus:border-transparent"
                    />
                    <p className="mt-2 text-xs text-owl-text-secondary">
                      Gmail için uygulama şifresi kullanın.
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-owl-accent hover:underline ml-1">
                        Nasıl oluşturulur?
                      </a>
                    </p>
                  </div>
                </div>

                {/* Manual Config Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="manualConfig"
                    checked={showManual}
                    onChange={(e) => setShowManual(e.target.checked)}
                    className="w-4 h-4 rounded border-owl-border bg-owl-surface-2 text-owl-accent focus:ring-owl-accent"
                  />
                  <label htmlFor="manualConfig" className="ml-2 text-sm text-owl-text-secondary">
                    Sunucu ayarlarını manuel gir
                  </label>
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-owl-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-owl-surface text-owl-text-secondary">veya</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text hover:bg-owl-border/50 transition-colors"
                    onClick={() => {/* TODO: Gmail OAuth */}}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
                      <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z" />
                      <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z" />
                      <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z" />
                    </svg>
                    Google ile giriş yap
                  </button>

                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text hover:bg-owl-border/50 transition-colors"
                    onClick={() => {/* TODO: Outlook OAuth */}}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#0078D4" d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12Z" />
                      <path fill="#fff" d="M7.5 7.5h9v9h-9z" />
                      <path fill="#0078D4" d="M8.25 8.25h3.75v3.75H8.25zm4.5 0h3.75v3.75h-3.75zm-4.5 4.5h3.75v3.75H8.25zm4.5 0h3.75v3.75h-3.75z" />
                    </svg>
                    Microsoft ile giriş yap
                  </button>
                </div>
              </>
            )}

            {/* Detecting Step */}
            {step === 'detecting' && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-owl-accent/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-owl-accent animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-owl-text mb-2">
                  Ayarlar Algılanıyor...
                </h3>
                <p className="text-owl-text-secondary">
                  {email} için sunucu ayarları aranıyor
                </p>
              </div>
            )}

            {/* Configure Step */}
            {step === 'configure' && (
              <div className="space-y-6">
                {/* Detected Provider */}
                {config && (
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${
                    config.provider
                      ? 'bg-owl-success/10 border border-owl-success/20'
                      : 'bg-owl-warning/10 border border-owl-warning/20'
                  }`}>
                    <svg className={`w-5 h-5 ${config.provider ? 'text-owl-success' : 'text-owl-warning'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`text-sm ${config.provider ? 'text-owl-success' : 'text-owl-warning'}`}>
                      {config.provider
                        ? `${config.provider} ayarları otomatik algılandı`
                        : `Ayarlar tahmin edildi (${config.detectionMethod || 'guessed'})`}
                    </span>
                  </div>
                )}

                {/* IMAP Settings */}
                <div>
                  <h4 className="text-sm font-medium text-owl-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-owl-accent"></span>
                    Gelen Sunucu (IMAP)
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                        placeholder="imap.gmail.com"
                        className="w-full px-4 py-2.5 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={imapPort}
                        onChange={(e) => setImapPort(parseInt(e.target.value))}
                        placeholder="993"
                        className="w-full px-4 py-2.5 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <select
                      value={imapSecurity}
                      onChange={(e) => setImapSecurity(e.target.value as SecurityType)}
                      className="w-full px-4 py-2.5 border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm"
                      style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}
                    >
                      <option value="SSL" style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}>SSL/TLS</option>
                      <option value="STARTTLS" style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}>STARTTLS</option>
                      <option value="NONE" style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}>Şifresiz (önerilmez)</option>
                    </select>
                  </div>
                </div>

                {/* SMTP Settings */}
                <div>
                  <h4 className="text-sm font-medium text-owl-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-owl-accent"></span>
                    Giden Sunucu (SMTP)
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-4 py-2.5 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                        placeholder="587"
                        className="w-full px-4 py-2.5 bg-owl-surface-2 border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <select
                      value={smtpSecurity}
                      onChange={(e) => setSmtpSecurity(e.target.value as SecurityType)}
                      className="w-full px-4 py-2.5 border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm"
                      style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}
                    >
                      <option value="STARTTLS" style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}>STARTTLS</option>
                      <option value="SSL" style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}>SSL/TLS</option>
                      <option value="NONE" style={{ backgroundColor: '#1a1a24', color: '#e4e4e7' }}>Şifresiz (önerilmez)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Testing Step */}
            {step === 'testing' && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-owl-accent/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-owl-accent animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-owl-text mb-2">
                  Bağlantı Test Ediliyor...
                </h3>
                <p className="text-owl-text-secondary">
                  {testProgress}
                </p>
              </div>
            )}

            {/* Success Step */}
            {step === 'success' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-owl-success/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-owl-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-owl-text mb-2">
                  Hesap Başarıyla Eklendi!
                </h3>
                <p className="text-owl-text-secondary mb-4">
                  {email} hesabı kullanıma hazır
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setTestProgress('Test e-postası gönderiliyor...');
                    try {
                      await invoke('send_test_email', {
                        host: smtpHost,
                        port: smtpPort,
                        security: smtpSecurity,
                        email,
                        password,
                        toEmail: email,
                      });
                      setTestProgress('Test e-postası gönderildi!');
                    } catch (err: any) {
                      setTestProgress(`Hata: ${err.message || err}`);
                    }
                  }}
                  className="px-4 py-2 bg-owl-surface-2 hover:bg-owl-border text-owl-text rounded-lg transition-colors text-sm"
                >
                  Test E-postası Gönder
                </button>
                {testProgress && (
                  <p className="mt-3 text-sm text-owl-text-secondary">{testProgress}</p>
                )}
              </div>
            )}

            {/* Error Step */}
            {step === 'error' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-owl-error/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-owl-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-owl-text mb-2">
                  Bağlantı Başarısız
                </h3>
                <p className="text-owl-error text-sm mb-4">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setStep('configure')}
                  className="text-owl-accent hover:underline text-sm"
                >
                  Ayarları düzenle
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && step !== 'error' && (
              <div className="p-3 bg-owl-error/10 border border-owl-error/20 rounded-lg">
                <p className="text-sm text-owl-error">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {(step === 'credentials' || step === 'configure') && (
            <div className="px-6 py-4 border-t border-owl-border bg-owl-surface-2/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white font-medium rounded-lg transition-colors"
              >
                {step === 'credentials' ? (showManual ? 'Devam' : 'Ayarları Algıla') : 'Bağlantıyı Test Et'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// Step indicator dot
function StepDot({ active, completed }: { active: boolean; completed: boolean }) {
  return (
    <div
      className={`w-3 h-3 rounded-full transition-colors ${
        completed
          ? 'bg-owl-success'
          : active
          ? 'bg-owl-accent'
          : 'bg-owl-border'
      }`}
    />
  );
}

export default AddAccountModal;
