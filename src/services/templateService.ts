import { invoke } from '@tauri-apps/api/core';
import type { EmailTemplate, NewEmailTemplate } from '../types';

/**
 * Add a new email template
 */
export async function templateAdd(template: NewEmailTemplate): Promise<number> {
  return await invoke<number>('template_add', { template });
}

/**
 * Get all templates for an account
 */
export async function templateList(accountId: number): Promise<EmailTemplate[]> {
  return await invoke<EmailTemplate[]>('template_list', { accountId });
}

/**
 * Get a single template by ID
 */
export async function templateGet(templateId: number): Promise<EmailTemplate> {
  return await invoke<EmailTemplate>('template_get', { templateId });
}

/**
 * Update an existing template
 */
export async function templateUpdate(
  templateId: number,
  template: NewEmailTemplate
): Promise<void> {
  await invoke('template_update', { templateId, template });
}

/**
 * Delete a template
 */
export async function templateDelete(templateId: number): Promise<void> {
  await invoke('template_delete', { templateId });
}

/**
 * Toggle template enabled status
 */
export async function templateToggle(templateId: number): Promise<void> {
  await invoke('template_toggle', { templateId });
}

/**
 * Toggle template favorite status
 */
export async function templateToggleFavorite(templateId: number): Promise<void> {
  await invoke('template_toggle_favorite', { templateId });
}

/**
 * Increment template usage count
 */
export async function templateIncrementUsage(templateId: number): Promise<void> {
  await invoke('template_increment_usage', { templateId });
}

/**
 * Search templates using FTS5
 */
export async function templateSearch(
  accountId: number,
  query: string,
  limit: number = 50
): Promise<EmailTemplate[]> {
  return await invoke<EmailTemplate[]>('template_search', { accountId, query, limit });
}

/**
 * Get templates by category
 */
export async function templateGetByCategory(
  accountId: number,
  category: string
): Promise<EmailTemplate[]> {
  return await invoke<EmailTemplate[]>('template_get_by_category', { accountId, category });
}

/**
 * Get favorite templates
 */
export async function templateGetFavorites(accountId: number): Promise<EmailTemplate[]> {
  return await invoke<EmailTemplate[]>('template_get_favorites', { accountId });
}

/**
 * Get available template categories
 */
export async function templateGetCategories(): Promise<string[]> {
  return await invoke<string[]>('template_get_categories');
}
