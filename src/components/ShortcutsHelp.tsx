// ============================================================================
// Owlivion Mail - Keyboard Shortcuts Help Modal
// ============================================================================

import { useShortcut } from '../hooks/useKeyboardShortcuts';
import {
  SHORTCUT_CATEGORIES,
  getShortcutsByCategory,
  formatShortcutKey,
} from '../constants/shortcuts';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  // Close on Escape
  useShortcut('Escape', onClose, { enabled: isOpen });

  if (!isOpen) return null;

  const groupedShortcuts = getShortcutsByCategory();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-owl-surface border border-owl-border rounded-xl shadow-owl-lg w-full max-w-3xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-owl-border">
          <h2 className="text-lg font-semibold text-owl-text">
            Klavye Kısayolları
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-owl-text-secondary hover:text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-2 gap-8">
            {Object.entries(SHORTCUT_CATEGORIES).map(([categoryKey, category]) => {
              const shortcuts = groupedShortcuts[categoryKey];
              if (!shortcuts || shortcuts.length === 0) return null;

              return (
                <div key={categoryKey}>
                  <h3 className="text-sm font-medium text-owl-accent mb-3 flex items-center gap-2">
                    <CategoryIcon category={categoryKey} />
                    {category.label}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-owl-text-secondary">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-owl-surface-2 border border-owl-border rounded text-owl-text">
                          {formatShortcutKey(shortcut.key)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-owl-border bg-owl-surface-2/50">
          <p className="text-xs text-owl-text-secondary text-center">
            Kısayolları açmak için <kbd className="px-1.5 py-0.5 text-xs font-mono bg-owl-surface border border-owl-border rounded">?</kbd> tuşuna basın
          </p>
        </div>
      </div>
    </div>
  );
}

// Category icons
function CategoryIcon({ category }: { category: string }) {
  const iconClass = "w-4 h-4";

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

export default ShortcutsHelp;
