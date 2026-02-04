// ============================================================================
// Owlivion Mail - Mail Service (Tauri API Wrapper)
// ============================================================================

import { invoke } from '@tauri-apps/api/core';
import type {
  Account,
  NewAccount,
  AutoConfig,
  ImapFolder,
  EmailSummary,
  Email,
  DraftEmail,
  Settings,
} from '../types';

// ============================================================================
// Account Management
// ============================================================================

/**
 * Auto-detect email server configuration
 */
export async function detectConfig(email: string): Promise<AutoConfig> {
  return invoke<AutoConfig>('autoconfig_detect', { email });
}

/**
 * Add a new email account
 */
export async function addAccount(account: NewAccount): Promise<string> {
  return invoke<string>('account_add', {
    email: account.email,
    displayName: account.displayName,
    password: account.password,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecurity: account.imapSecurity,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecurity: account.smtpSecurity,
    isDefault: true,
    acceptInvalidCerts: account.acceptInvalidCerts,
  });
}

/**
 * Connect to an account (used when app starts or reconnecting)
 */
export async function connectAccount(accountId: string): Promise<void> {
  return invoke('account_connect', { accountId });
}

/**
 * Test IMAP connection
 */
export async function testImapConnection(
  host: string,
  port: number,
  security: string,
  email: string,
  password: string
): Promise<void> {
  return invoke('account_test_imap', {
    host,
    port,
    security,
    email,
    password,
  });
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(
  host: string,
  port: number,
  security: string,
  email: string,
  password: string
): Promise<void> {
  return invoke('account_test_smtp', {
    host,
    port,
    security,
    email,
    password,
  });
}

/**
 * Send a test email to verify SMTP configuration
 */
export async function sendTestEmail(
  host: string,
  port: number,
  security: string,
  email: string,
  password: string,
  toEmail: string
): Promise<void> {
  return invoke('send_test_email', {
    host,
    port,
    security,
    email,
    password,
    toEmail,
  });
}

/**
 * List all accounts
 */
export async function listAccounts(): Promise<Account[]> {
  return invoke<Account[]>('account_list');
}

/**
 * Update account signature
 */
export async function updateAccountSignature(accountId: number, signature: string): Promise<void> {
  return invoke('account_update_signature', { accountId: accountId.toString(), signature });
}

/**
 * Fetch content from a URL (for signatures)
 * Uses Rust backend to bypass CSP restrictions
 */
export async function fetchUrlContent(url: string): Promise<string> {
  return invoke<string>('fetch_url_content', { url });
}

/**
 * Delete an account
 */
export async function deleteAccount(accountId: number): Promise<void> {
  return invoke('account_delete', { accountId });
}

/**
 * Set default account
 */
export async function setDefaultAccount(accountId: number): Promise<void> {
  return invoke('account_set_default', { accountId });
}

// ============================================================================
// Folder Management
// ============================================================================

/**
 * List folders for an account (from IMAP server)
 */
export async function listFolders(accountId: string): Promise<ImapFolder[]> {
  return invoke<ImapFolder[]>('folder_list', { accountId });
}

/**
 * Select a folder
 */
export async function selectFolder(
  accountId: string,
  folderPath: string
): Promise<number> {
  return invoke<number>('folder_select', { accountId, folderPath });
}

// ============================================================================
// Email Operations
// ============================================================================

/**
 * Fetch emails with pagination
 */
export async function listEmails(
  accountId: string,
  page: number,
  pageSize: number,
  folder?: string
): Promise<{ emails: EmailSummary[]; total: number; hasMore: boolean }> {
  return invoke('email_list', { accountId, folder, page, pageSize });
}

/**
 * Get full email content
 */
export async function getEmail(accountId: string, uid: number, folder?: string): Promise<Email> {
  return invoke<Email>('email_get', { accountId, uid, folder });
}

/**
 * Search emails
 */
export async function searchEmails(
  accountId: string,
  query: string,
  folder?: string
): Promise<number[]> {
  return invoke<number[]>('email_search', { accountId, query, folder });
}

/**
 * Mark email as read/unread
 */
export async function markEmailRead(
  accountId: string,
  uid: number,
  read: boolean,
  folder?: string
): Promise<void> {
  return invoke('email_mark_read', { accountId, uid, read, folder });
}

/**
 * Mark email as starred/unstarred
 */
export async function markEmailStarred(
  accountId: string,
  uid: number,
  starred: boolean,
  folder?: string
): Promise<void> {
  return invoke('email_mark_starred', { accountId, uid, starred, folder });
}

/**
 * Move email to a folder
 */
export async function moveEmail(
  accountId: string,
  uid: number,
  targetFolder: string,
  folder?: string
): Promise<void> {
  return invoke('email_move', { accountId, uid, targetFolder, folder });
}

/**
 * Delete email
 */
export async function deleteEmail(
  accountId: string,
  uid: number,
  permanent: boolean = false,
  folder?: string
): Promise<void> {
  return invoke('email_delete', { accountId, uid, permanent, folder });
}

/**
 * Send email
 */
export async function sendEmail(draft: DraftEmail): Promise<void> {
  return invoke('email_send', {
    accountId: draft.accountId.toString(),
    to: draft.to.map((r) => r.email),
    cc: draft.cc.map((r) => r.email),
    bcc: draft.bcc.map((r) => r.email),
    subject: draft.subject,
    textBody: draft.bodyText,
    htmlBody: draft.bodyHtml,
  });
}

/**
 * Archive email
 */
export async function archiveEmail(
  accountId: string,
  uid: number
): Promise<void> {
  return moveEmail(accountId, uid, 'Archive');
}

/**
 * Move email to trash
 */
export async function trashEmail(
  accountId: string,
  uid: number
): Promise<void> {
  return moveEmail(accountId, uid, 'Trash');
}

// ============================================================================
// Settings
// ============================================================================

/**
 * Get a setting value
 */
export async function getSetting<T>(key: string): Promise<T | null> {
  return invoke<T | null>('setting_get', { key });
}

/**
 * Set a setting value
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  return invoke('setting_set', { key, value: JSON.stringify(value) });
}

/**
 * Get all settings
 */
export async function getSettings(): Promise<Settings> {
  return invoke<Settings>('settings_get_all');
}

/**
 * Save all settings
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return invoke('settings_save_all', { settings });
}

// ============================================================================
// Trusted Senders
// ============================================================================

/**
 * Add trusted sender
 */
export async function addTrustedSender(
  email: string,
  domain?: string
): Promise<void> {
  return invoke('trusted_sender_add', { email, domain });
}

/**
 * Check if sender is trusted
 */
export async function isTrustedSender(email: string): Promise<boolean> {
  return invoke<boolean>('trusted_sender_check', { email });
}

/**
 * Remove trusted sender
 */
export async function removeTrustedSender(id: number): Promise<void> {
  return invoke('trusted_sender_remove', { id });
}

// ============================================================================
// Contacts
// ============================================================================

/**
 * Search contacts
 */
export async function searchContacts(
  query: string,
  accountId?: number
): Promise<{ email: string; name?: string }[]> {
  return invoke('contacts_search', { query, accountId });
}

// ============================================================================
// Sync
// ============================================================================

/**
 * Start sync for an account
 */
export async function startSync(accountId: string): Promise<void> {
  return invoke('sync_start', { accountId });
}

/**
 * Stop sync for an account
 */
export async function stopSync(accountId: string): Promise<void> {
  return invoke('sync_stop', { accountId });
}

/**
 * Get sync status
 */
export async function getSyncStatus(
  accountId: string
): Promise<{ status: string; lastSync?: string; error?: string }> {
  return invoke('sync_status', { accountId });
}
