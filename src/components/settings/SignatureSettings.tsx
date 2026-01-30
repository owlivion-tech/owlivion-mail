// ============================================================================
// Owlivion Mail - Signature Settings
// ============================================================================

import { useState } from 'react';
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
    preview: null,
    html: '',
  },
  {
    id: 'simple',
    name: 'Basit İmza',
    description: 'Sadece isim ve e-posta',
    preview: null,
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
<p style="margin: 0;"><strong>{{name}}</strong></p>
<p style="margin: 0; color: #666;">{{email}}</p>
</div>`,
  },
  {
    id: 'professional',
    name: 'Profesyonel',
    description: 'İsim, ünvan ve iletişim bilgileri',
    preview: null,
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
];

export function SignatureSettings({ accounts, onAccountsChange }: SignatureSettingsProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0]?.id?.toString() || '');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
  const [customHtml, setCustomHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const currentAccount = accounts.find(a => a.id.toString() === selectedAccount);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = SIGNATURE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      // Replace placeholders with account data
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

  const handleSaveSignature = () => {
    if (!currentAccount) return;

    const signatureHtml = customHtml;

    const updatedAccounts = accounts.map(acc =>
      acc.id.toString() === selectedAccount
        ? { ...acc, signature: signatureHtml }
        : acc
    );
    onAccountsChange(updatedAccounts);

    // TODO: Save to database via Tauri command
    alert('İmza kaydedildi!');
  };

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
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Template Selection */}
      <div className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-owl-text mb-4">İmza Şablonu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SIGNATURE_TEMPLATES.map(template => (
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
                  <h4 className="font-medium text-owl-text">{template.name}</h4>
                  <p className="text-sm text-owl-text-secondary mt-1">{template.description}</p>
                </div>
                {selectedTemplate === template.id && (
                  <svg className="w-5 h-5 text-owl-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {template.preview && (
                <a
                  href={template.preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-owl-accent hover:underline"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Önizleme
                </a>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom HTML Editor */}
      {selectedTemplate !== 'none' && (
        <div className="bg-owl-surface border border-owl-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-owl-text">İmza Düzenleyici</h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 text-sm bg-owl-surface-2 hover:bg-owl-border text-owl-text rounded-lg transition-colors"
            >
              {showPreview ? 'HTML Düzenle' : 'Önizleme'}
            </button>
          </div>

          {showPreview ? (
            <div className="p-4 bg-white rounded-lg border border-owl-border min-h-[200px]">
              <div dangerouslySetInnerHTML={{ __html: customHtml }} />
            </div>
          ) : (
            <textarea
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              className="w-full h-64 px-4 py-3 bg-owl-bg border border-owl-border rounded-lg text-owl-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-owl-accent resize-none"
              placeholder="HTML imza kodunuzu buraya yapıştırın..."
            />
          )}

          <p className="mt-2 text-xs text-owl-text-secondary">
            Değişkenler: {'{{name}}'}, {'{{email}}'}, {'{{title}}'}, {'{{phone}}'}, {'{{website}}'}
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSignature}
          className="px-6 py-3 bg-owl-accent hover:bg-owl-accent-hover text-white font-medium rounded-lg transition-colors"
        >
          İmzayı Kaydet
        </button>
      </div>
    </div>
  );
}

export default SignatureSettings;
