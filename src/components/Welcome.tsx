// ============================================================================
// Owlivion Mail - Welcome/Onboarding Screen
// ============================================================================

import owlivionLogo from '../assets/owlivion-logo.svg';

interface WelcomeProps {
  onAddAccount: () => void;
  onOpenSettings: () => void;
}

export function Welcome({ onAddAccount, onOpenSettings }: WelcomeProps) {
  return (
    <div className="h-screen bg-owl-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-owl-border">
        <div className="flex items-center gap-3">
          <img src={owlivionLogo} alt="Owlivion" className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-semibold text-owl-text">
              Owlivion <span className="text-owl-accent">Mail</span>
            </h1>
            <p className="text-xs text-owl-text-secondary">AI-Powered Email Client</p>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface rounded-lg transition-colors"
          title="Ayarlar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          {/* Icon */}
          <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-owl-accent to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-owl-accent/20">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-owl-text mb-4">
            Owlivion Mail'e Hoş Geldiniz
          </h2>

          {/* Description */}
          <p className="text-owl-text-secondary mb-8 leading-relaxed">
            Modern, hızlı ve yapay zeka destekli e-posta deneyimi için
            hesabınızı ekleyerek başlayın. Gmail, Outlook, Yahoo ve diğer
            IMAP destekli tüm e-posta sağlayıcılarıyla çalışır.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-owl-surface rounded-xl border border-owl-border">
              <div className="w-10 h-10 mx-auto mb-3 bg-owl-accent/20 rounded-lg flex items-center justify-center text-owl-accent">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-owl-text mb-1">AI Destekli</h3>
              <p className="text-xs text-owl-text-secondary">Akıllı yanıtlar ve özetleme</p>
            </div>

            <div className="p-4 bg-owl-surface rounded-xl border border-owl-border">
              <div className="w-10 h-10 mx-auto mb-3 bg-owl-accent/20 rounded-lg flex items-center justify-center text-owl-accent">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-owl-text mb-1">Hızlı</h3>
              <p className="text-xs text-owl-text-secondary">Klavye kısayolları</p>
            </div>

            <div className="p-4 bg-owl-surface rounded-xl border border-owl-border">
              <div className="w-10 h-10 mx-auto mb-3 bg-owl-accent/20 rounded-lg flex items-center justify-center text-owl-accent">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-owl-text mb-1">Güvenli</h3>
              <p className="text-xs text-owl-text-secondary">Yerel veri saklama</p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onAddAccount}
            className="inline-flex items-center gap-3 px-8 py-4 bg-owl-accent hover:bg-owl-accent-hover text-white font-medium rounded-xl transition-all shadow-lg shadow-owl-accent/20 hover:shadow-xl hover:shadow-owl-accent/30 hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            E-posta Hesabı Ekle
          </button>

          {/* Supported Providers */}
          <div className="mt-8 pt-8 border-t border-owl-border">
            <p className="text-xs text-owl-text-secondary mb-4">Desteklenen sağlayıcılar</p>
            <div className="flex items-center justify-center gap-6 text-owl-text-secondary">
              <span className="text-sm">Gmail</span>
              <span className="text-owl-border">•</span>
              <span className="text-sm">Outlook</span>
              <span className="text-owl-border">•</span>
              <span className="text-sm">Yahoo</span>
              <span className="text-owl-border">•</span>
              <span className="text-sm">iCloud</span>
              <span className="text-owl-border">•</span>
              <span className="text-sm">IMAP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-owl-border text-center">
        <p className="text-xs text-owl-text-secondary">
          Owlivion Mail v1.0.0 • Made with{' '}
          <span className="text-owl-accent">♥</span> by Owlivion
        </p>
      </div>
    </div>
  );
}

export default Welcome;
