// ============================================================================
// Owlivion Mail - Draft Service
// ============================================================================

import { invoke } from '@tauri-apps/api/core';
import type { DraftEmail, Attachment, DraftListItem, DraftDetail } from '../types';

export async function saveDraft(draft: DraftEmail, attachments: Attachment[]): Promise<number> {
  const draftData = {
    id: draft.id,
    account_id: draft.accountId,
    to_addresses: JSON.stringify(draft.to),
    cc_addresses: JSON.stringify(draft.cc),
    bcc_addresses: JSON.stringify(draft.bcc),
    subject: draft.subject,
    body_text: draft.bodyText,
    body_html: draft.bodyHtml,
    reply_to_email_id: draft.replyToEmailId,
    forward_email_id: draft.forwardEmailId,
    compose_type: draft.composeType,
  };

  const attachmentData = attachments
    .filter(att => att._file)
    .map(att => ({
      filename: att.filename,
      content_type: att.contentType,
      size: att.size,
      local_path: att.localPath || '',
    }));

  return await invoke<number>('draft_save', {
    draft: draftData,
    attachments: attachmentData,
  });
}

export async function deleteDraft(draftId: number): Promise<void> {
  await invoke('draft_delete', { draftId });
}

export async function listDrafts(accountId: number): Promise<DraftListItem[]> {
  return await invoke<DraftListItem[]>('draft_list', { accountId });
}

export async function getDraft(draftId: number): Promise<DraftDetail> {
  return await invoke<DraftDetail>('draft_get', { draftId });
}
