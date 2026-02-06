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
  SearchFilters,
  SearchResult,
  MultiAccountFetchResult,
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

// Alias for backwards compatibility
export const emailList = listEmails;

/**
 * Fetch emails from all active accounts (unified inbox)
 */
export async function listAllAccountsEmails(
  page: number,
  pageSize: number,
  folder?: string,
  sortBy?: 'date' | 'account' | 'unread' | 'priority'
): Promise<MultiAccountFetchResult> {
  return invoke('email_list_all_accounts', {
    folder,
    page,
    pageSize,
    sortBy: sortBy || 'priority'
  });
}

/**
 * Sync emails with automatic filter application
 */
export async function syncEmailsWithFilters(
  accountId: string,
  page: number,
  pageSize: number,
  folder?: string
): Promise<{
  fetchResult: { emails: EmailSummary[]; total: number; hasMore: boolean };
  newEmailsCount: number;
  filtersAppliedCount: number;
}> {
  return invoke('email_sync_with_filters', { accountId, folder, page, pageSize });
}

/**
 * Get full email content
 */
export async function getEmail(accountId: string, uid: number, folder?: string): Promise<Email> {
  return invoke<Email>('email_get', { accountId, uid, folder });
}

/**
 * Search emails using local FTS5
 */
export async function searchEmails(
  accountId: string,
  query: string,
  folder?: string
): Promise<EmailSummary[]> {
  return invoke<EmailSummary[]>('email_search', { accountId, query, folder });
}

/**
 * Advanced email search with filters
 */
export async function searchEmailsAdvanced(
  accountId: string,
  filters: SearchFilters,
  limit: number = 100,
  offset: number = 0
): Promise<SearchResult> {
  return invoke('email_search_advanced', { accountId, filters, limit, offset });
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
  // Process attachments if present
  let attachmentPaths: Array<{ path: string; filename: string; contentType: string }> | undefined;

  if (draft.attachments && draft.attachments.length > 0) {
    // Check if attachments have _file property (File objects from frontend)
    const attachmentsWithFiles = draft.attachments as Array<{
      filename: string;
      contentType: string;
      size: number;
      localPath?: string;
      _file?: File;
    }>;

    // Process each attachment with File object
    attachmentPaths = await Promise.all(
      attachmentsWithFiles.map(async (att) => {
        if (att._file) {
          // Read File as ArrayBuffer
          const buffer = await att._file.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);

          // Write to temp file using Tauri
          try {
            // Use Tauri command to write temp file
            const result = await invoke<{ path: string; filename: string; contentType: string }>(
              'write_temp_attachment',
              {
                filename: att.filename,
                contentType: att.contentType,
                data: Array.from(uint8Array),
              }
            );

            return result;
          } catch (err) {
            console.error('Failed to write temp file:', err);
            throw new Error(`Failed to prepare attachment: ${att.filename}`);
          }
        } else if (att.localPath) {
          // Already has a path (e.g., from draft)
          return {
            path: att.localPath,
            filename: att.filename,
            contentType: att.contentType,
          };
        } else {
          throw new Error(`Attachment missing file data: ${att.filename}`);
        }
      })
    );
  }

  return invoke('email_send', {
    accountId: draft.accountId.toString(),
    to: draft.to.map((r) => r.email),
    cc: draft.cc.map((r) => r.email),
    bcc: draft.bcc.map((r) => r.email),
    subject: draft.subject,
    textBody: draft.bodyText,
    htmlBody: draft.bodyHtml,
    attachmentPaths,
  });
}

/**
 * Download attachment from email
 */
export async function downloadAttachment(
  accountId: string,
  folder: string,
  uid: number,
  attachmentIndex: number
): Promise<{ filename: string; contentType: string; size: number; data: string }> {
  return invoke('email_download_attachment', {
    accountId,
    folder,
    uid,
    attachmentIndex,
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

// ============================================================================
// Account Priority Settings
// ============================================================================

/**
 * Get priority fetching setting for an account
 */
export async function getAccountPriorityFetch(accountId: number): Promise<boolean> {
  return invoke<boolean>('account_get_priority_fetch', { accountId });
}

/**
 * Set priority fetching setting for an account
 */
export async function setAccountPriorityFetch(accountId: number, enabled: boolean): Promise<void> {
  return invoke('account_set_priority_fetch', { accountId, enabled });
}
