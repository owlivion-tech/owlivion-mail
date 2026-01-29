// ============================================================================
// Owlivion Mail - AI Settings Component
// ============================================================================

import type { Settings } from '../../types';

interface AISettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function AISettings({ settings, onSettingsChange }: AISettingsProps) {
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-owl-text">Yapay Zeka Ayarları</h2>
        <p className="text-owl-text-secondary mt-1">
          AI destekli e-posta yanıtlama ve özetleme özelliklerini yapılandırın
        </p>
      </div>

      {/* AI Features */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">AI Özellikleri</h3>

        <div className="space-y-4">
          {/* Reply Tone */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Yanıt Tonu</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                AI yanıtlarında kullanılacak varsayılan ton
              </p>
            </div>
            <select
              value={settings.aiReplyTone}
              onChange={(e) => updateSetting('aiReplyTone', e.target.value as Settings['aiReplyTone'])}
              className="px-4 py-2 bg-owl-bg border border-owl-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owl-accent text-sm text-owl-text appearance-none cursor-pointer"
            >
              <option value="professional" className="bg-owl-bg text-owl-text">Profesyonel</option>
              <option value="friendly" className="bg-owl-bg text-owl-text">Samimi</option>
              <option value="formal" className="bg-owl-bg text-owl-text">Resmi</option>
              <option value="casual" className="bg-owl-bg text-owl-text">Günlük</option>
            </select>
          </div>

          {/* Auto Summarize */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-owl-text">Otomatik Özetleme</label>
              <p className="text-xs text-owl-text-secondary mt-0.5">
                Uzun e-postaları otomatik özetle
              </p>
            </div>
            <Toggle
              enabled={settings.aiAutoSummarize}
              onChange={(value) => updateSetting('aiAutoSummarize', value)}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Nasıl Çalışır?</h3>

        <div className="space-y-4 text-sm text-owl-text-secondary">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-owl-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-owl-accent font-semibold">1</span>
            </div>
            <div>
              <p className="font-medium text-owl-text">AI Yanıt</p>
              <p>
                E-posta görüntülerken "AI Yanıt" butonuna tıklayın veya{' '}
                <kbd className="px-1.5 py-0.5 bg-owl-surface-2 border border-owl-border rounded text-xs">G</kbd>{' '}
                tuşuna basın.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-owl-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-owl-accent font-semibold">2</span>
            </div>
            <div>
              <p className="font-medium text-owl-text">Ton Seçimi</p>
              <p>
                Yanıt için istediğiniz tonu seçin: profesyonel, samimi, resmi veya günlük.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-owl-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-owl-accent font-semibold">3</span>
            </div>
            <div>
              <p className="font-medium text-owl-text">Düzenleme</p>
              <p>
                Oluşturulan yanıtı gözden geçirin, düzenleyin ve gönderin.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mt-4 p-3 bg-owl-accent/10 border border-owl-accent/20 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-owl-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-owl-accent">Bilgi</p>
              <p className="text-xs text-owl-accent/80 mt-0.5">
                AI özelliklerini kullandığınızda e-posta içeriği Google'ın Gemini API'sine gönderilir.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Toggle switch component
function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-owl-accent' : 'bg-owl-surface-2 border border-owl-border'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
          enabled ? 'translate-x-6 bg-white' : 'translate-x-1 bg-owl-text-secondary'
        }`}
      />
    </button>
  );
}

export default AISettings;
