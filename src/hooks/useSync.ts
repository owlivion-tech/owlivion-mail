// ============================================================================
// Owlivion Mail - Sync Hooks
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { SyncConfig, SyncStatusItem, DeviceInfo, SyncResult } from '../types';
import {
  getSyncConfig,
  updateSyncConfig,
  getSyncStatus,
  listDevices,
  startSync,
  isSyncEnabled,
} from '../services/syncService';

// ============================================================================
// useSyncConfig - Sync Configuration Hook
// ============================================================================

export function useSyncConfig() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSyncConfig();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync config');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: SyncConfig) => {
    try {
      setError(null);
      await updateSyncConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sync config');
      throw err;
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    reload: loadConfig,
    update: updateConfig,
  };
}

// ============================================================================
// useSyncStatus - Sync Status Hook
// ============================================================================

export function useSyncStatus() {
  const [statuses, setStatuses] = useState<SyncStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSyncStatus();
      setStatuses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return {
    statuses,
    loading,
    error,
    reload: loadStatus,
  };
}

// ============================================================================
// useDevices - Device Management Hook
// ============================================================================

export function useDevices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listDevices();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return {
    devices,
    loading,
    error,
    reload: loadDevices,
  };
}

// ============================================================================
// useSyncTrigger - Manual Sync Trigger Hook
// ============================================================================

export function useSyncTrigger() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async (masterPassword: string) => {
    try {
      setSyncing(true);
      setError(null);
      setResult(null);

      const syncResult = await startSync(masterPassword);
      setResult(syncResult);

      if (syncResult.errors.length > 0) {
        setError(syncResult.errors.join(', '));
      }

      return syncResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMsg);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    syncing,
    result,
    error,
    trigger,
    reset,
  };
}

// ============================================================================
// useSyncEnabled - Check if Sync is Active
// ============================================================================

export function useSyncEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkEnabled = async () => {
      try {
        const isEnabled = await isSyncEnabled();
        setEnabled(isEnabled);
      } catch (err) {
        console.error('Failed to check sync status:', err);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkEnabled();
  }, []);

  return { enabled, loading };
}
