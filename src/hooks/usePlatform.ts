import { useState, useEffect } from 'react';

export type PlatformType = 'android' | 'ios' | 'desktop';

let cachedPlatform: PlatformType | null = null;

/**
 * Detect current platform using Tauri API and user agent fallback
 */
export function detectPlatform(): PlatformType {
  if (cachedPlatform) return cachedPlatform;

  // Check Tauri's __TAURI_INTERNALS__ for platform info
  const tauriInternals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as
    | { metadata?: { currentDevice?: { platform?: string } } }
    | undefined;

  const platform = tauriInternals?.metadata?.currentDevice?.platform;

  if (platform === 'android') {
    cachedPlatform = 'android';
  } else if (platform === 'ios') {
    cachedPlatform = 'ios';
  } else {
    // Fallback: check user agent
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      cachedPlatform = 'android';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      cachedPlatform = 'ios';
    } else {
      cachedPlatform = 'desktop';
    }
  }

  return cachedPlatform;
}

export function isMobile(): boolean {
  const platform = detectPlatform();
  return platform === 'android' || platform === 'ios';
}

export function usePlatform(): PlatformType {
  const [platform, setPlatform] = useState<PlatformType>(() => detectPlatform());

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return platform;
}
