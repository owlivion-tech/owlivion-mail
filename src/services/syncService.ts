// ============================================================================
// Owlivion Mail - Sync Service (Tauri API Wrapper)
// ============================================================================

import { invoke } from '@tauri-apps/api/core';
import type { SyncConfig, SyncStatusItem, DeviceInfo, SyncResult } from '../types';

// ============================================================================
// Authentication
// ============================================================================

/**
 * Register new Owlivion Account
 */
export async function registerAccount(
  email: string,
  password: string,
  masterPassword: string
): Promise<void> {
  return invoke('sync_register', { email, password, masterPassword });
}

/**
 * Login to Owlivion Account
 */
export async function loginAccount(email: string, password: string): Promise<void> {
  return invoke('sync_login', { email, password });
}

/**
 * Logout from Owlivion Account
 */
export async function logoutAccount(): Promise<void> {
  return invoke('sync_logout');
}

// ============================================================================
// Sync Operations
// ============================================================================

/**
 * Start manual sync (requires master password)
 */
export async function startSync(masterPassword: string): Promise<SyncResult> {
  const result = await invoke<{
    accounts_synced: boolean;
    contacts_synced: boolean;
    preferences_synced: boolean;
    signatures_synced: boolean;
    errors: string[];
  }>('sync_start', { masterPassword });

  return {
    accountsSynced: result.accounts_synced,
    contactsSynced: result.contacts_synced,
    preferencesSynced: result.preferences_synced,
    signaturesSynced: result.signatures_synced,
    errors: result.errors,
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get current sync configuration
 */
export async function getSyncConfig(): Promise<SyncConfig> {
  const config = await invoke<{
    enabled: boolean;
    user_id?: string;
    device_id: string;
    device_name: string;
    platform: string;
    last_sync_at?: string;
    sync_accounts: boolean;
    sync_contacts: boolean;
    sync_preferences: boolean;
    sync_signatures: boolean;
  }>('sync_get_config');

  return {
    enabled: config.enabled,
    userId: config.user_id,
    deviceId: config.device_id,
    deviceName: config.device_name,
    platform: config.platform as 'windows' | 'macos' | 'linux',
    lastSyncAt: config.last_sync_at,
    syncAccounts: config.sync_accounts,
    syncContacts: config.sync_contacts,
    syncPreferences: config.sync_preferences,
    syncSignatures: config.sync_signatures,
  };
}

/**
 * Update sync configuration
 */
export async function updateSyncConfig(config: SyncConfig): Promise<void> {
  return invoke('sync_update_config', {
    config: {
      enabled: config.enabled,
      user_id: config.userId,
      device_id: config.deviceId,
      device_name: config.deviceName,
      platform: config.platform,
      last_sync_at: config.lastSyncAt,
      sync_accounts: config.syncAccounts,
      sync_contacts: config.syncContacts,
      sync_preferences: config.syncPreferences,
      sync_signatures: config.syncSignatures,
    },
  });
}

// ============================================================================
// Status
// ============================================================================

/**
 * Get sync status for all data types
 */
export async function getSyncStatus(): Promise<SyncStatusItem[]> {
  const statuses = await invoke<
    {
      data_type: string;
      version: number;
      last_sync_at?: string;
      status: string;
    }[]
  >('sync_get_status');

  return statuses.map((s) => ({
    dataType: s.data_type as 'accounts' | 'contacts' | 'preferences' | 'signatures',
    version: s.version,
    lastSyncAt: s.last_sync_at,
    status: s.status as 'idle' | 'syncing' | 'error',
  }));
}

// ============================================================================
// Device Management
// ============================================================================

/**
 * List all devices for this account
 */
export async function listDevices(): Promise<DeviceInfo[]> {
  const devices = await invoke<
    {
      device_id: string;
      device_name: string;
      platform: string;
      last_seen_at: string;
    }[]
  >('sync_list_devices');

  return devices.map((d) => ({
    deviceId: d.device_id,
    deviceName: d.device_name,
    platform: d.platform,
    lastSeenAt: d.last_seen_at,
  }));
}

/**
 * Revoke device access (logout device)
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  return invoke('sync_revoke_device', { deviceId });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if sync is enabled
 */
export async function isSyncEnabled(): Promise<boolean> {
  const config = await getSyncConfig();
  return config.enabled && config.userId !== undefined;
}

/**
 * Get formatted last sync time
 */
export function formatLastSync(lastSyncAt?: string): string {
  if (!lastSyncAt) return 'Hiç senkronize edilmedi';

  const date = new Date(lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dakika önce`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;

  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get platform icon name
 */
export function getPlatformIcon(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'windows':
      return '🪟';
    case 'macos':
      return '🍎';
    case 'linux':
      return '🐧';
    default:
      return '💻';
  }
}
