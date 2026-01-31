// ============================================================================
// Owlivion Mail - Signature Settings
// ============================================================================

import { useState, useEffect } from 'react';
import { updateAccountSignature, fetchUrlContent } from '../../services/mailService';
import type { Account } from '../../types';

interface SignatureSettingsProps {
  accounts: Account[];
  onAccountsChange: (accounts: Account[]) => void;
}

// Pre-built signature templates
const SIGNATURE_TEMPLATES = [
  {
    id: 'none',
    name: 'İmza Yok',
    description: 'İmza kullanma',
    html: '',
  },
  {
    id: 'current',
    name: 'Mevcut İmza',
    description: 'Kayıtlı imzanız',
    html: '',
  },
  {
    id: 'simple',
    name: 'Basit İmza',
    description: 'Sadece isim ve e-posta',
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
<p style="margin: 0;"><strong>{{name}}</strong></p>
<p style="margin: 0; color: #666;">{{email}}</p>
</div>`,
  },
  {
    id: 'professional',
    name: 'Profesyonel',
    description: 'İsim, ünvan ve iletişim bilgileri',
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif;">
<tr>
<td style="padding-right: 15px; border-right: 2px solid #7c3aed;">
<p style="margin: 0; font-size: 16px; font-weight: bold; color: #1f2937;">{{name}}</p>
<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">{{title}}</p>
</td>
<td style="padding-left: 15px;">
<p style="margin: 0; font-size: 12px; color: #6b7280;">{{email}}</p>
<p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">{{phone}}</p>
<p style="margin: 2px 0 0 0; font-size: 12px; color: #7c3aed;">{{website}}</p>
</td>
</tr>
</table>`,
  },
  {
    id: 'custom',
    name: 'Özel İmza Oluştur',
    description: 'Kendi imzanızı yazın',
    html: '',
  },
  {
    id: 'url',
    name: 'URL\'den Yükle',
    description: 'Harici URL\'den imza yükle',
    html: '',
  },
];

export function SignatureSettings({ accounts, onAccountsChange }: SignatureSettingsProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0]?.id?.toString() || '');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
  const [customHtml, setCustomHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string>('https://owlivion.com/mail/');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentAccount = accounts.find(a => a.id.toString() === selectedAccount);

  // Load current signature when account changes
  useEffect(() => {
    if (currentAccount?.signature) {
      setSelectedTemplate('current');
      setCustomHtml(currentAccount.signature);
    } else {
      setSelectedTemplate('none');
      setCustomHtml('');
    }
  }, [selectedAccount, currentAccount?.signature]);

  // Fetch signature via Rust backend (bypasses CSP)
  const loadSignatureFromUrl = async () => {
    if (!signatureUrl) return;
    setIsLoadingUrl(true);
    try {
      // Use Rust backend for fetching (more reliable, bypasses CSP)
      const html = await fetchUrlContent(signatureUrl);
      setCustomHtml(html);
      setSelectedTemplate('url');
    } catch (err: any) {
      console.error('İmza yüklenemedi:', err);
      alert(`İmza URL'den yüklenemedi: ${err?.message || 'Bağlantı hatası'}`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Remove signature
  const handleRemoveSignature = async () => {
    if (!currentAccount) return;
    if (!confirm('İmzayı silmek istediğinizden emin misiniz?')) return;

    setIsSaving(true);
    try {
      await updateAccountSignature(currentAccount.id, '');

      const updatedAccounts = accounts.map(acc =>
        acc.id.toString() === selectedAccount
          ? { ...acc, signature: '' }
          : acc
      );
      onAccountsChange(updatedAccounts);

      setCustomHtml('');
      setSelectedTemplate('none');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('İmza silinemedi:', err);
      alert(`İmza silinemedi: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);

    if (templateId === 'current' && currentAccount?.signature) {
      setCustomHtml(currentAccount.signature);
      return;
    }

    if (templateId === 'custom') {
      setCustomHtml('');
      return;
    }

    if (templateId === 'url') {
      return; // Don't change HTML, wait for URL load
    }

    const template = SIGNATURE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      let html = template.html;
      if (currentAccount) {
        html = html
          .replace(/\{\{name\}\}/g, currentAccount.displayName || '')
          .replace(/\{\{email\}\}/g, currentAccount.email || '')
          .replace(/\{\{title\}\}/g, '')
          .replace(/\{\{phone\}\}/g, '')
          .replace(/\{\{website\}\}/g, '');
      }
      setCustomHtml(html);
    }
  };

  const handleSaveSignature = async () => {
    if (!currentAccount) return;

    setIsSaving(true);
    try {
      const signatureHtml = customHtml;

      // Save to database
      await updateAccountSignature(currentAccount.id, signatureHtml);

      // Update local state
      const updatedAccounts = accounts.map(acc =>
        acc.id.toString() === selectedAccount
          ? { ...acc, signature: signatureHtml }
          : acc
      );
      onAccountsChange(updatedAccounts);

      // Show success message and switch to "current" template
      setSaveSuccess(true);
      if (signatureHtml) {
        setSelectedTemplate('current');
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('İmza kaydedilemedi:', err);
      const errorMsg = err?.message || err?.toString() || 'Bilinmeyen hata';
      alert(`İmza kaydedilemedi: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const hasCurrentSignature = currentAccount?.signature && currentAccount.signature.trim() !== '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-owl-text">E-posta İmzaları</h2>
        <p className="mt-1 text-owl-text-secondary">
          Hesaplarınız için e-posta imzası seçin veya özelleştirin
        </p>
      </div>

      {/* Account Selector */}
      {accounts.length > 1 && (
        <div className="bg-owl-surface border border-owl-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-owl-text mb-4">Hesap Seçin</h3>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-4 py-3 bg-owl-bg border border-owl-border rounded-lg text-owl-text focus:outline-none focus:ring-2 focus:ring-owl-accent"
          >
            {accounts.map(account => (
              <option key={account.id} value={account.id.toString()}>
                {account.displayName} ({account.email})
                {account.signature ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current Signature Status */}
      {hasCurrentSignature && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-green-400 text-sm">Bu hesap için kayıtlı bir imzanız var</span>
        </div>
      )}

      {/* Template Selection */}
      <div className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-owl-text mb-4">İmza Şablonu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SIGNATURE_TEMPLATES.filter(t => t.id !== 'current' || hasCurrentSignature).map(template => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedTemplate === template.id
                  ? 'border-owl-accent bg-owl-accent/10'
                  : 'border-owl-border hover:border-owl-text-secondary bg-owl-surface-2'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-owl-text flex items-center gap-2">
                    {template.name}
                    {template.id === 'current' && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Aktif</span>
                    )}
                  </h4>
                  <p className="text-sm text-owl-text-secondary mt-1">{template.description}</p>
                </div>
                {selectedTemplate === template.id && (
                  <svg className="w-5 h-5 text-owl-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* URL Input */}
      {selectedTemplate === 'url' && (
        <div className="bg-owl-surface border border-owl-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-owl-text mb-4">İmza URL'si</h3>
          <div className="flex gap-3">
            <input
              type="url"
              value={signatureUrl}
              onChange={(e) => setSignatureUrl(e.target.value)}
              placeholder="https://owlivion.com/mail/imza.html"
              className="flex-1 px-4 py-3 bg-owl-bg border border-owl-border rounded-lg text-owl-text focus:outline-none focus:ring-2 focus:ring-owl-accent"
            />
            <button
              onClick={loadSignatureFromUrl}
              disabled={isLoadingUrl || !signatureUrl}
              className="px-6 py-3 bg-owl-accent hover:bg-owl-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoadingUrl ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </div>
          <p className="mt-2 text-xs text-owl-text-secondary">
            Örnek: https://owlivion.com/mail/berkan-cetinel-adaptive.html
          </p>
        </div>
      )}

      {/* Custom HTML Editor */}
      {(selectedTemplate === 'custom' || selectedTemplate === 'url' || (selectedTemplate !== 'none' && customHtml)) && (
        <div className="bg-owl-surface border border-owl-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-owl-text">
              {selectedTemplate === 'custom' ? 'İmza Oluştur' : 'İmza Düzenleyici'}
            </h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 text-sm bg-owl-surface-2 hover:bg-owl-border text-owl-text rounded-lg transition-colors"
            >
              {showPreview ? 'HTML Düzenle' : 'Önizleme'}
            </button>
          </div>

          {showPreview ? (
            <div className="p-4 bg-white rounded-lg border border-owl-border min-h-[200px]">
              {customHtml ? (
                <div dangerouslySetInnerHTML={{ __html: customHtml }} />
              ) : (
                <p className="text-gray-400 italic">İmza içeriği boş</p>
              )}
            </div>
          ) : (
            <textarea
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              className="w-full h-64 px-4 py-3 bg-owl-bg border border-owl-border rounded-lg text-owl-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-owl-accent resize-none"
              placeholder="HTML imza kodunuzu buraya yazın veya yapıştırın..."
            />
          )}

          <p className="mt-2 text-xs text-owl-text-secondary">
            Değişkenler: {'{{name}}'}, {'{{email}}'}, {'{{title}}'}, {'{{phone}}'}, {'{{website}}'}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {saveSuccess && (
            <span className="text-green-500 flex items-center gap-2 animate-pulse">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              İmza kaydedildi!
            </span>
          )}
          {hasCurrentSignature && (
            <button
              onClick={handleRemoveSignature}
              disabled={isSaving}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              İmzayı Sil
            </button>
          )}
        </div>
        <button
          onClick={handleSaveSignature}
          disabled={isSaving}
          className="px-6 py-3 bg-owl-accent hover:bg-owl-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Kaydediliyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              İmzayı Kaydet
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default SignatureSettings;
