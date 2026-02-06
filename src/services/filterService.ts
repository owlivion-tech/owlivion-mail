// ============================================================================
// Owlivion Mail - Filter Service (Tauri API Wrapper)
// ============================================================================

import { invoke } from '@tauri-apps/api/core';
import type { EmailFilter, NewEmailFilter } from '../types';

// ============================================================================
// Filter Management
// ============================================================================

/**
 * Add a new email filter
 */
export async function filterAdd(filter: NewEmailFilter): Promise<number> {
  return invoke<number>('filter_add', { filter });
}

/**
 * Get all filters for an account
 */
export async function filterList(accountId: number): Promise<EmailFilter[]> {
  return invoke<EmailFilter[]>('filter_list', { accountId });
}

/**
 * Get a single filter by ID
 */
export async function filterGet(filterId: number): Promise<EmailFilter> {
  return invoke<EmailFilter>('filter_get', { filterId });
}

/**
 * Update an existing filter
 */
export async function filterUpdate(
  filterId: number,
  filter: NewEmailFilter
): Promise<void> {
  return invoke<void>('filter_update', { filterId, filter });
}

/**
 * Delete a filter
 */
export async function filterDelete(filterId: number): Promise<void> {
  return invoke<void>('filter_delete', { filterId });
}

/**
 * Toggle filter enabled state
 */
export async function filterToggle(filterId: number): Promise<void> {
  return invoke<void>('filter_toggle', { filterId });
}

/**
 * Test if a filter would match a specific email
 */
export async function filterTest(
  filterId: number,
  emailId: number
): Promise<boolean> {
  return invoke<boolean>('filter_test', { filterId, emailId });
}

/**
 * Apply filters to existing emails in batch
 */
export async function filterApplyBatch(
  accountId: number,
  filterId?: number,
  folderId?: number
): Promise<{
  emailsProcessed: number;
  filtersMatched: number;
  actionsExecuted: number;
}> {
  return invoke('filter_apply_batch', { accountId, filterId, folderId });
}

/**
 * Export filters as JSON
 */
export async function filterExport(accountId: number): Promise<string> {
  return invoke<string>('filter_export', { accountId });
}

/**
 * Import filters from JSON
 */
export async function filterImport(
  accountId: number,
  jsonData: string
): Promise<number> {
  return invoke<number>('filter_import', { accountId, jsonData });
}
