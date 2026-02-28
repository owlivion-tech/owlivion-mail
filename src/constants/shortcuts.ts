// ============================================================================
// Owlivion Mail - Keyboard Shortcuts Definitions
// ============================================================================

import type { ShortcutDefinition } from '../types';

type TranslateFn = (key: string) => string;

// Get shortcuts with translated descriptions
export function getShortcuts(t: TranslateFn): Record<string, ShortcutDefinition> {
  return {
    // Navigation
    NEXT_EMAIL: {
      key: 'j',
      description: t('shortcutDescriptions.nextEmail'),
      category: 'navigation',
    },
    PREV_EMAIL: {
      key: 'k',
      description: t('shortcutDescriptions.prevEmail'),
      category: 'navigation',
    },
    OPEN_EMAIL: {
      key: 'o',
      description: t('shortcutDescriptions.openEmail'),
      category: 'navigation',
    },
    BACK_TO_LIST: {
      key: 'Escape',
      description: t('shortcutDescriptions.backToList'),
      category: 'navigation',
    },
    GO_TO_INBOX: {
      key: 'g i',
      description: t('shortcutDescriptions.goToInbox'),
      category: 'navigation',
    },
    GO_TO_SENT: {
      key: 'g s',
      description: t('shortcutDescriptions.goToSent'),
      category: 'navigation',
    },
    GO_TO_DRAFTS: {
      key: 'g d',
      description: t('shortcutDescriptions.goToDrafts'),
      category: 'navigation',
    },
    GO_TO_STARRED: {
      key: 'g t',
      description: t('shortcutDescriptions.goToStarred'),
      category: 'navigation',
    },

    // Actions
    REPLY: {
      key: 'r',
      description: t('shortcutDescriptions.reply'),
      category: 'actions',
    },
    REPLY_ALL: {
      key: 'a',
      description: t('shortcutDescriptions.replyAll'),
      category: 'actions',
    },
    FORWARD: {
      key: 'f',
      description: t('shortcutDescriptions.forward'),
      category: 'actions',
    },
    ARCHIVE: {
      key: 'e',
      description: t('shortcutDescriptions.archive'),
      category: 'actions',
    },
    DELETE: {
      key: '#',
      description: t('shortcutDescriptions.delete'),
      category: 'actions',
    },
    STAR: {
      key: 's',
      description: t('shortcutDescriptions.star'),
      category: 'actions',
    },
    MARK_UNREAD: {
      key: 'u',
      description: t('shortcutDescriptions.markUnread'),
      category: 'actions',
    },
    MARK_READ: {
      key: 'Shift+i',
      description: t('shortcutDescriptions.markRead'),
      category: 'actions',
    },
    MARK_SPAM: {
      key: '!',
      description: t('shortcutDescriptions.markSpam'),
      category: 'actions',
    },
    MOVE_TO: {
      key: 'v',
      description: t('shortcutDescriptions.moveTo'),
      category: 'actions',
    },
    LABEL: {
      key: 'l',
      description: t('shortcutDescriptions.label'),
      category: 'actions',
    },
    SELECT: {
      key: 'x',
      description: t('shortcutDescriptions.select'),
      category: 'actions',
    },
    SELECT_ALL: {
      key: 'Ctrl+a',
      description: t('shortcutDescriptions.selectAll'),
      category: 'actions',
    },

    // Compose
    COMPOSE: {
      key: 'c',
      description: t('shortcutDescriptions.compose'),
      category: 'compose',
    },
    SEND: {
      key: 'Ctrl+Enter',
      description: t('shortcutDescriptions.send'),
      category: 'compose',
    },
    SAVE_DRAFT: {
      key: 'Ctrl+s',
      description: t('shortcutDescriptions.saveDraft'),
      category: 'compose',
    },
    DISCARD: {
      key: 'Ctrl+Shift+d',
      description: t('shortcutDescriptions.discard'),
      category: 'compose',
    },
    ADD_CC: {
      key: 'Ctrl+Shift+c',
      description: t('shortcutDescriptions.addCc'),
      category: 'compose',
    },
    ADD_BCC: {
      key: 'Ctrl+Shift+b',
      description: t('shortcutDescriptions.addBcc'),
      category: 'compose',
    },
    ATTACH_FILE: {
      key: 'Ctrl+Shift+a',
      description: t('shortcutDescriptions.attachFile'),
      category: 'compose',
    },

    // Search & Commands
    SEARCH: {
      key: '/',
      description: t('shortcutDescriptions.search'),
      category: 'search',
    },
    COMMAND_PALETTE: {
      key: 'Ctrl+k',
      description: t('shortcutDescriptions.commandPalette'),
      category: 'search',
    },
    CLEAR_SEARCH: {
      key: 'Escape',
      description: t('shortcutDescriptions.clearSearch'),
      category: 'search',
    },

    // AI
    AI_REPLY: {
      key: 'g',
      description: t('shortcutDescriptions.aiReply'),
      category: 'ai',
    },
    AI_SUMMARIZE: {
      key: 'Shift+g',
      description: t('shortcutDescriptions.aiSummarize'),
      category: 'ai',
    },

    // Help
    SHOW_SHORTCUTS: {
      key: '?',
      description: t('shortcutDescriptions.showShortcuts'),
      category: 'help',
    },
    SETTINGS: {
      key: ',',
      description: t('shortcutDescriptions.settings'),
      category: 'help',
    },
  };
}

// Get shortcut categories with translated labels
export function getShortcutCategories(t: TranslateFn) {
  return {
    navigation: {
      label: t('shortcutDescriptions.categories.navigation'),
      icon: 'navigation',
    },
    actions: {
      label: t('shortcutDescriptions.categories.actions'),
      icon: 'actions',
    },
    compose: {
      label: t('shortcutDescriptions.categories.compose'),
      icon: 'compose',
    },
    search: {
      label: t('shortcutDescriptions.categories.search'),
      icon: 'search',
    },
    ai: {
      label: t('shortcutDescriptions.categories.ai'),
      icon: 'ai',
    },
    help: {
      label: t('shortcutDescriptions.categories.help'),
      icon: 'help',
    },
  };
}

// Get shortcuts grouped by category
export function getShortcutsByCategory(t: TranslateFn): Record<string, ShortcutDefinition[]> {
  const shortcuts = getShortcuts(t);
  const grouped: Record<string, ShortcutDefinition[]> = {};

  Object.values(shortcuts).forEach((shortcut) => {
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
