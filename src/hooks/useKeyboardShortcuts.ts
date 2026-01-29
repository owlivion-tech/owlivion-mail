// ============================================================================
// Owlivion Mail - Keyboard Shortcuts Hook
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { matchesShortcut } from '../constants/shortcuts';

type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutBinding {
  key: string;
  handler: ShortcutHandler;
  allowInInput?: boolean;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  allowInInput?: boolean;
}

/**
 * Hook for registering multiple keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutBinding[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, allowInInput = false } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in an input field
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]');

      for (const binding of shortcuts) {
        // Skip if we're in input and not allowed
        if (isInputField && !binding.allowInInput && !allowInInput) {
          continue;
        }

        if (matchesShortcut(event, binding.key)) {
          if (binding.preventDefault !== false) {
            event.preventDefault();
          }
          binding.handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled, allowInInput]);
}

/**
 * Hook for a single keyboard shortcut
 */
export function useShortcut(
  key: string,
  handler: ShortcutHandler,
  options: {
    enabled?: boolean;
    allowInInput?: boolean;
    preventDefault?: boolean;
  } = {}
): void {
  const { enabled = true, allowInInput = false, preventDefault = true } = options;
  const handlerRef = useRef(handler);

  // Update handler ref on each render
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in an input field
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]');

      if (isInputField && !allowInInput) {
        return;
      }

      if (matchesShortcut(event, key)) {
        if (preventDefault) {
          event.preventDefault();
        }
        handlerRef.current(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, enabled, allowInInput, preventDefault]);
}

/**
 * Hook for sequence shortcuts (e.g., 'g i' for go to inbox)
 */
export function useSequenceShortcut(
  sequence: string,
  handler: ShortcutHandler,
  options: {
    enabled?: boolean;
    timeout?: number;
  } = {}
): void {
  const { enabled = true, timeout = 1000 } = options;
  const sequenceRef = useRef<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keys = sequence.split(' ').map((k) => k.toLowerCase());

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't track in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputField) {
        return;
      }

      // Clear timeout and reset if expired
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Add key to sequence
      sequenceRef.current.push(event.key.toLowerCase());

      // Check if sequence matches
      const currentSequence = sequenceRef.current.join(' ');
      const targetSequence = keys.join(' ');

      if (currentSequence === targetSequence) {
        event.preventDefault();
        handler(event);
        sequenceRef.current = [];
        return;
      }

      // Check if we're on the right track
      const isPartialMatch = targetSequence.startsWith(currentSequence);
      if (!isPartialMatch) {
        sequenceRef.current = [];
        // Maybe the key starts a new sequence
        if (event.key.toLowerCase() === keys[0]) {
          sequenceRef.current.push(event.key.toLowerCase());
        }
      }

      // Set timeout to clear sequence
      timeoutRef.current = setTimeout(() => {
        sequenceRef.current = [];
      }, timeout);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, keys, handler, timeout]);
}

/**
 * Hook to get current platform modifier key
 */
export function usePlatformModifier(): {
  modifier: 'Ctrl' | 'Cmd';
  isMac: boolean;
} {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  return {
    modifier: isMac ? 'Cmd' : 'Ctrl',
    isMac,
  };
}

/**
 * Context for managing shortcut scope (e.g., different shortcuts for compose vs read)
 */
type ShortcutScope = 'global' | 'list' | 'read' | 'compose' | 'search';

interface ShortcutScopeState {
  currentScope: ShortcutScope;
  setScope: (scope: ShortcutScope) => void;
}

// This would typically be a React Context, but for simplicity:
let currentScope: ShortcutScope = 'global';
const scopeListeners: Set<(scope: ShortcutScope) => void> = new Set();

export function useShortcutScope(): ShortcutScopeState {
  const setScope = useCallback((scope: ShortcutScope) => {
    currentScope = scope;
    scopeListeners.forEach((listener) => listener(scope));
  }, []);

  useEffect(() => {
    const listener = () => {};
    scopeListeners.add(listener);
    return () => {
      scopeListeners.delete(listener);
    };
  }, []);

  return {
    currentScope,
    setScope,
  };
}

/**
 * Hook that only fires if in specified scope
 */
export function useScopedShortcut(
  key: string,
  handler: ShortcutHandler,
  scope: ShortcutScope,
  options: {
    enabled?: boolean;
    allowInInput?: boolean;
  } = {}
): void {
  const scopeState = useShortcutScope();

  useShortcut(key, handler, {
    ...options,
    enabled: options.enabled !== false && scopeState.currentScope === scope,
  });
}
