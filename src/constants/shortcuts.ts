// ============================================================================
// Owlivion Mail - Keyboard Shortcuts Definitions
// ============================================================================

import type { ShortcutDefinition } from '../types';

export const SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Navigation
  NEXT_EMAIL: {
    key: 'j',
    description: 'Sonraki e-posta',
    category: 'navigation',
  },
  PREV_EMAIL: {
    key: 'k',
    description: 'Önceki e-posta',
    category: 'navigation',
  },
  OPEN_EMAIL: {
    key: 'o',
    description: 'E-postayı aç',
    category: 'navigation',
  },
  BACK_TO_LIST: {
    key: 'Escape',
    description: 'Listeye dön',
    category: 'navigation',
  },
  GO_TO_INBOX: {
    key: 'g i',
    description: 'Gelen kutusuna git',
    category: 'navigation',
  },
  GO_TO_SENT: {
    key: 'g s',
    description: 'Gönderilenlere git',
    category: 'navigation',
  },
  GO_TO_DRAFTS: {
    key: 'g d',
    description: 'Taslaklara git',
    category: 'navigation',
  },
  GO_TO_STARRED: {
    key: 'g t',
    description: 'Yıldızlılara git',
    category: 'navigation',
  },

  // Actions
  REPLY: {
    key: 'r',
    description: 'Yanıtla',
    category: 'actions',
  },
  REPLY_ALL: {
    key: 'a',
    description: 'Tümünü yanıtla',
    category: 'actions',
  },
  FORWARD: {
    key: 'f',
    description: 'İlet',
    category: 'actions',
  },
  ARCHIVE: {
    key: 'e',
    description: 'Arşivle',
    category: 'actions',
  },
  DELETE: {
    key: '#',
    description: 'Sil',
    category: 'actions',
  },
  STAR: {
    key: 's',
    description: 'Yıldızla',
    category: 'actions',
  },
  MARK_UNREAD: {
    key: 'u',
    description: 'Okunmadı işaretle',
    category: 'actions',
  },
  MARK_READ: {
    key: 'Shift+i',
    description: 'Okundu işaretle',
    category: 'actions',
  },
  MARK_SPAM: {
    key: '!',
    description: 'Spam olarak işaretle',
    category: 'actions',
  },
  MOVE_TO: {
    key: 'v',
    description: 'Klasöre taşı',
    category: 'actions',
  },
  LABEL: {
    key: 'l',
    description: 'Etiket ekle',
    category: 'actions',
  },
  SELECT: {
    key: 'x',
    description: 'Seç/Seçimi kaldır',
    category: 'actions',
  },
  SELECT_ALL: {
    key: 'Ctrl+a',
    description: 'Tümünü seç',
    category: 'actions',
  },

  // Compose
  COMPOSE: {
    key: 'c',
    description: 'Yeni e-posta',
    category: 'compose',
  },
  SEND: {
    key: 'Ctrl+Enter',
    description: 'Gönder',
    category: 'compose',
  },
  SAVE_DRAFT: {
    key: 'Ctrl+s',
    description: 'Taslak kaydet',
    category: 'compose',
  },
  DISCARD: {
    key: 'Ctrl+Shift+d',
    description: 'Sil ve kapat',
    category: 'compose',
  },
  ADD_CC: {
    key: 'Ctrl+Shift+c',
    description: 'CC ekle',
    category: 'compose',
  },
  ADD_BCC: {
    key: 'Ctrl+Shift+b',
    description: 'BCC ekle',
    category: 'compose',
  },
  ATTACH_FILE: {
    key: 'Ctrl+Shift+a',
    description: 'Dosya ekle',
    category: 'compose',
  },

  // Search & Commands
  SEARCH: {
    key: '/',
    description: 'Ara',
    category: 'search',
  },
  COMMAND_PALETTE: {
    key: 'Ctrl+k',
    description: 'Komut paleti',
    category: 'search',
  },
  CLEAR_SEARCH: {
    key: 'Escape',
    description: 'Aramayı temizle',
    category: 'search',
  },

  // AI
  AI_REPLY: {
    key: 'g',
    description: 'AI yanıt oluştur',
    category: 'ai',
  },
  AI_SUMMARIZE: {
    key: 'Shift+g',
    description: 'AI ile özetle',
    category: 'ai',
  },

  // Help
  SHOW_SHORTCUTS: {
    key: '?',
    description: 'Kısayol yardımı',
    category: 'help',
  },
  SETTINGS: {
    key: ',',
    description: 'Ayarlar',
    category: 'help',
  },
} as const;

// Group shortcuts by category for help modal
export const SHORTCUT_CATEGORIES = {
  navigation: {
    label: 'Gezinme',
    icon: 'navigation',
  },
  actions: {
    label: 'İşlemler',
    icon: 'actions',
  },
  compose: {
    label: 'Yazma',
    icon: 'compose',
  },
  search: {
    label: 'Arama',
    icon: 'search',
  },
  ai: {
    label: 'Yapay Zeka',
    icon: 'ai',
  },
  help: {
    label: 'Yardım',
    icon: 'help',
  },
} as const;

// Get shortcuts grouped by category
export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const grouped: Record<string, ShortcutDefinition[]> = {};

  Object.values(SHORTCUTS).forEach((shortcut) => {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  });

  return grouped;
}

// Format shortcut key for display
export function formatShortcutKey(key: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  return key
    .replace('Ctrl', isMac ? '⌘' : 'Ctrl')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Enter', '↵')
    .replace('Escape', 'Esc')
    .replace('+', ' + ')
    .replace(' ', ' ');
}

// Parse shortcut key into components
export function parseShortcutKey(key: string): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
} {
  const parts = key.toLowerCase().split('+').map((p) => p.trim());
  const mainKey = parts.pop() || '';

  return {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: mainKey,
  };
}

// Check if a keyboard event matches a shortcut
export function matchesShortcut(event: KeyboardEvent, shortcutKey: string): boolean {
  const parsed = parseShortcutKey(shortcutKey);

  // Handle both Ctrl and Meta (Cmd on Mac)
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  if (parsed.ctrl && !ctrlOrMeta) return false;
  if (parsed.alt && !event.altKey) return false;
  if (parsed.shift && !event.shiftKey) return false;

  // Normalize the key
  const eventKey = event.key.toLowerCase();
  const targetKey = parsed.key.toLowerCase();

  // Special handling for symbols
  if (targetKey === '#' && eventKey === '#') return true;
  if (targetKey === '/' && eventKey === '/') return true;
  if (targetKey === '?' && event.shiftKey && eventKey === '/') return true;
  if (targetKey === '!' && event.shiftKey && eventKey === '1') return true;

  return eventKey === targetKey;
}
