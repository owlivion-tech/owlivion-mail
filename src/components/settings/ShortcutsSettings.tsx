// ============================================================================
// Owlivion Mail - Shortcuts Settings Component
// ============================================================================

import {
  SHORTCUT_CATEGORIES,
  getShortcutsByCategory,
  formatShortcutKey,
} from '../../constants/shortcuts';

export function ShortcutsSettings() {
  const groupedShortcuts = getShortcutsByCategory();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-owl-text">Klavye Kısayolları</h2>
        <p className="text-owl-text-secondary mt-1">
          Owlivion Mail'i daha hızlı kullanmak için klavye kısayollarını öğrenin
        </p>
      </div>

      {/* Quick Tip */}
      <div className="bg-owl-accent/10 border border-owl-accent/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-owl-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-owl-accent">Hızlı İpucu</p>
            <p className="text-sm text-owl-text-secondary mt-1">
              Kısayolları görmek için herhangi bir ekranda{' '}
              <kbd className="px-1.5 py-0.5 bg-owl-surface-2 border border-owl-border rounded text-xs font-mono">?</kbd>{' '}
              tuşuna basın.
            </p>
          </div>
        </div>
      </div>

      {/* Shortcut Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(SHORTCUT_CATEGORIES).map(([categoryKey, category]) => {
          const shortcuts = groupedShortcuts[categoryKey];
          if (!shortcuts || shortcuts.length === 0) return null;

          return (
            <section
              key={categoryKey}
              className="bg-owl-surface border border-owl-border rounded-xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-owl-border bg-owl-surface-2/50">
                <h3 className="font-medium text-owl-text flex items-center gap-2">
                  <CategoryIcon category={categoryKey} />
                  {category.label}
                </h3>
              </div>
              <div className="divide-y divide-owl-border">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-5 py-3 hover:bg-owl-surface-2/30 transition-colors"
                  >
                    <span className="text-sm text-owl-text">{shortcut.description}</span>
                    <kbd className="px-2.5 py-1 text-xs font-mono bg-owl-surface-2 border border-owl-border rounded text-owl-text-secondary">
                      {formatShortcutKey(shortcut.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Vim-style Navigation */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Vim Tarzı Gezinme</h3>
        <p className="text-sm text-owl-text-secondary mb-4">
          Owlivion Mail, Vim editöründen ilham alan klavye kısayollarını destekler.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-owl-surface-2 rounded-lg">
            <kbd className="px-3 py-1.5 text-lg font-mono bg-owl-bg border border-owl-border rounded">j</kbd>
            <p className="text-xs text-owl-text-secondary mt-2">Aşağı</p>
          </div>
          <div className="text-center p-4 bg-owl-surface-2 rounded-lg">
            <kbd className="px-3 py-1.5 text-lg font-mono bg-owl-bg border border-owl-border rounded">k</kbd>
            <p className="text-xs text-owl-text-secondary mt-2">Yukarı</p>
          </div>
          <div className="text-center p-4 bg-owl-surface-2 rounded-lg">
            <kbd className="px-3 py-1.5 text-lg font-mono bg-owl-bg border border-owl-border rounded">o</kbd>
            <p className="text-xs text-owl-text-secondary mt-2">Aç</p>
          </div>
          <div className="text-center p-4 bg-owl-surface-2 rounded-lg">
            <kbd className="px-3 py-1.5 text-lg font-mono bg-owl-bg border border-owl-border rounded">Esc</kbd>
            <p className="text-xs text-owl-text-secondary mt-2">Geri</p>
          </div>
        </div>
      </section>

      {/* Go Commands */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Go (Git) Komutları</h3>
        <p className="text-sm text-owl-text-secondary mb-4">
          Hızlı klasör gezinmesi için <kbd className="px-1.5 py-0.5 bg-owl-surface-2 border border-owl-border rounded text-xs font-mono">g</kbd> ile başlayan iki tuşlu kombinasyonlar:
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-owl-surface-2 rounded-lg">
            <div className="flex gap-1">
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">g</kbd>
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">i</kbd>
            </div>
            <span className="text-sm text-owl-text">Gelen Kutusu</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-owl-surface-2 rounded-lg">
            <div className="flex gap-1">
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">g</kbd>
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">s</kbd>
            </div>
            <span className="text-sm text-owl-text">Gönderilenler</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-owl-surface-2 rounded-lg">
            <div className="flex gap-1">
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">g</kbd>
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">d</kbd>
            </div>
            <span className="text-sm text-owl-text">Taslaklar</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-owl-surface-2 rounded-lg">
            <div className="flex gap-1">
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">g</kbd>
              <kbd className="px-2 py-1 text-xs font-mono bg-owl-bg border border-owl-border rounded">t</kbd>
            </div>
            <span className="text-sm text-owl-text">Yıldızlılar</span>
          </div>
        </div>
      </section>

      {/* Command Palette */}
      <section className="bg-owl-surface border border-owl-border rounded-xl p-6">
        <h3 className="text-lg font-medium text-owl-text mb-4">Komut Paleti</h3>
        <p className="text-sm text-owl-text-secondary mb-4">
          Tüm komutlara erişmek için{' '}
          <kbd className="px-1.5 py-0.5 bg-owl-surface-2 border border-owl-border rounded text-xs font-mono">Ctrl</kbd>
          {' + '}
          <kbd className="px-1.5 py-0.5 bg-owl-surface-2 border border-owl-border rounded text-xs font-mono">K</kbd>
          {' '}tuşlarına basın.
        </p>

        <div className="bg-owl-bg border border-owl-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-5 h-5 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-owl-text-secondary">Komut ara...</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-owl-surface rounded">
              <span className="text-owl-text">Yeni e-posta yaz</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-owl-surface-2 border border-owl-border rounded">C</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded">
              <span className="text-owl-text-secondary">E-postaları ara</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-owl-surface-2 border border-owl-border rounded">/</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded">
              <span className="text-owl-text-secondary">Arşivle</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-owl-surface-2 border border-owl-border rounded">E</kbd>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Category icons
function CategoryIcon({ category }: { category: string }) {
  const iconClass = "w-5 h-5 text-owl-accent";

  switch (category) {
    case 'navigation':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      );
    case 'actions':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'compose':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'search':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'ai':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'help':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export default ShortcutsSettings;
