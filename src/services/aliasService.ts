// ============================================================================
// Owlivion Mail - Alias Service
// CRUD operations for email aliases
// ============================================================================

import { invoke } from '@tauri-apps/api/core';

export interface EmailAlias {
  id: number;
  account_id: number;
  alias_email: string;
  alias_name: string | null;
  is_default: boolean;
  is_enabled: boolean;
  created_at: string;
}

export async function addAlias(
  accountId: number,
  aliasEmail: string,
  aliasName?: string,
): Promise<number> {
  return invoke('alias_add', { accountId, aliasEmail, aliasName: aliasName || null });
}

export async function listAliases(accountId: number): Promise<EmailAlias[]> {
  return invoke('alias_list', { accountId });
}

export async function updateAlias(
  aliasId: number,
  aliasEmail?: string,
  aliasName?: string,
): Promise<void> {
  return invoke('alias_update', {
    aliasId,
    aliasEmail: aliasEmail || null,
    aliasName: aliasName !== undefined ? aliasName : null,
  });
}

export async function deleteAlias(aliasId: number): Promise<void> {
  return invoke('alias_delete', { aliasId });
}

export async function toggleAlias(aliasId: number): Promise<void> {
  return invoke('alias_toggle', { aliasId });
}

export async function setDefaultAlias(aliasId: number, accountId: number): Promise<void> {
  return invoke('alias_set_default', { aliasId, accountId });
}
