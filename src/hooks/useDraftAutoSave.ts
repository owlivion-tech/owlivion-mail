// ============================================================================
// Owlivion Mail - Draft Auto-Save Hook
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { saveDraft } from '../services/draftService';
import type { DraftEmail, Attachment } from '../types';

interface AutoSaveOptions {
  enabled: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: (draftId: number) => void;
  onSaveError?: (error: string) => void;
}

export function useDraftAutoSave(
  draft: DraftEmail | null,
  attachments: Attachment[],
  options: AutoSaveOptions
) {
  const { enabled, debounceMs = 2000, onSaveStart, onSaveSuccess, onSaveError } = options;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedRef = useRef<string>('');

  const getDraftHash = useCallback((draft: DraftEmail) => {
    return JSON.stringify({
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      bodyHtml: draft.bodyHtml,
      attachmentCount: attachments.length,
    });
  }, [attachments.length]);

  const isDraftEmpty = useCallback((draft: DraftEmail) => {
    return (
      draft.to.length === 0 &&
      draft.subject.trim() === '' &&
      draft.bodyHtml.trim() === ''
    );
  }, []);

  const save = useCallback(async () => {
    if (!draft || isSavingRef.current || !enabled || isDraftEmpty(draft)) {
      return;
    }

    const currentHash = getDraftHash(draft);
    if (currentHash === lastSavedRef.current) {
      return;
    }

    isSavingRef.current = true;
    onSaveStart?.();

    try {
      const draftId = await saveDraft(draft, attachments);
      lastSavedRef.current = currentHash;
      onSaveSuccess?.(draftId);
    } catch (err) {
      console.error('Auto-save failed:', err);
      onSaveError?.(String(err));
    } finally {
      isSavingRef.current = false;
    }
  }, [draft, attachments, enabled, isDraftEmpty, getDraftHash, onSaveStart, onSaveSuccess, onSaveError]);

  useEffect(() => {
    if (!draft || !enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(save, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [draft, attachments, enabled, debounceMs, save]);

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await save();
  }, [save]);

  return { saveNow };
}
