// ============================================================================
// Owlivion Mail - Label Service (Tauri API Wrapper)
// ============================================================================

import { invoke } from '@tauri-apps/api/core';
import type { Label } from '../types';

export async function labelCreate(accountId: number | null, name: string, color: string): Promise<Label> {
  return invoke<Label>('label_create', { accountId, name, color });
}

export async function labelList(accountId: number | null): Promise<Label[]> {
  return invoke<Label[]>('label_list', { accountId });
}

export async function labelUpdate(id: number, name?: string, color?: string): Promise<Label> {
  return invoke<Label>('label_update', { id, name, color });
}

export async function labelDelete(id: number): Promise<void> {
  return invoke<void>('label_delete', { id });
}

export async function emailAddLabel(emailId: number, labelId: number): Promise<void> {
  return invoke<void>('email_add_label', { emailId, labelId });
}

export async function emailRemoveLabel(emailId: number, labelId: number): Promise<void> {
  return invoke<void>('email_remove_label', { emailId, labelId });
}

export async function emailGetLabels(emailId: number): Promise<Label[]> {
  return invoke<Label[]>('email_get_labels', { emailId });
}

export async function labelGetEmailIds(labelId: number): Promise<number[]> {
  return invoke<number[]>('label_get_email_ids', { labelId });
}
