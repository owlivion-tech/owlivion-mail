// ============================================================================
// Owlivion Mail - License Service
// Manages Pro/Team license activation and validation
// ============================================================================

import { invoke } from '@tauri-apps/api/core';

export interface LicenseInfo {
  plan: 'free' | 'pro' | 'team';
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  license_key?: string;
  max_devices?: number;
  active_devices?: number;
  activated_at?: string;
  expires_at?: string;
  expired_plan?: string;
}

interface LicenseResponse {
  success: boolean;
  license: LicenseInfo;
  message?: string;
  error?: string;
}

const SYNC_SERVER_URL = 'https://sync.owlivion.com';

async function getAuthToken(): Promise<string | null> {
  try {
    return await invoke<string>('sync_get_token');
  } catch {
    return null;
  }
}

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<LicenseResponse> {
  const token = await getAuthToken();
  if (!token) {
    return {
      success: false,
      license: { plan: 'free', status: 'active' },
      error: 'Not logged in to Owlivion Account',
    };
  }

  const response = await fetch(`${SYNC_SERVER_URL}/api/v1/license${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  return response.json();
}

/**
 * Get current license status
 */
export async function getLicenseStatus(): Promise<LicenseInfo> {
  try {
    const result = await apiRequest('/status');
    if (result.success) {
      return result.license;
    }
    return { plan: 'free', status: 'active' };
  } catch {
    return { plan: 'free', status: 'active' };
  }
}

/**
 * Activate a license key
 */
export async function activateLicense(licenseKey: string): Promise<{ success: boolean; message?: string; error?: string; license?: LicenseInfo }> {
  try {
    const result = await apiRequest('/activate', {
      method: 'POST',
      body: JSON.stringify({ license_key: licenseKey }),
    });
    return {
      success: result.success,
      message: result.message,
      error: result.error,
      license: result.license,
    };
  } catch (error) {
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Deactivate license on current device
 */
export async function deactivateLicense(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await apiRequest('/deactivate', { method: 'POST' });
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Check if user has Pro or Team plan
 */
export function isPro(license: LicenseInfo): boolean {
  return license.plan === 'pro' || license.plan === 'team';
}

/**
 * Check if user has Team plan
 */
export function isTeam(license: LicenseInfo): boolean {
  return license.plan === 'team';
}
