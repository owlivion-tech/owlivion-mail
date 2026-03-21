// ============================================================================
// Owlivion Mail - Notification Service
// ============================================================================

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { playNotificationSound as playSoundFromUtils, type NotificationSoundType } from '../utils/notificationSounds';

/**
 * Play notification sound using the user's selected sound type from settings
 */
export function playNotificationSound(soundType?: NotificationSoundType): void {
  try {
    // Read user's preferred sound from settings
    const savedSettings = localStorage.getItem('owlivion-settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    const type: NotificationSoundType = soundType || settings.notificationSoundType || 'gentle';
    playSoundFromUtils(type, 0.7);
  } catch (err) {
    console.warn('Failed to play notification sound:', err);
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    return permissionGranted;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return false;
  }
}

/**
 * Check if notification permission is granted
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    return await isPermissionGranted();
  } catch (err) {
    console.error('Failed to check notification permission:', err);
    return false;
  }
}

/**
 * Show a desktop notification for new email
 */
export async function showNewEmailNotification(
  senderName: string,
  subject: string,
  preview?: string
): Promise<void> {
  try {
    const permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      console.log('Notification permission not granted');
      return;
    }

    // Send notification via Tauri
    await sendNotification({
      title: `Yeni E-posta: ${senderName}`,
      body: subject + (preview ? `\n${preview.substring(0, 100)}...` : ''),
      icon: 'icons/icon.png',
    });

    // Also play sound
    await playNotificationSound();
  } catch (err) {
    console.error('Failed to show notification:', err);
  }
}

/**
 * Show a generic notification
 */
export async function showNotification(title: string, body: string): Promise<void> {
  try {
    const permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      console.log('Notification permission not granted');
      return;
    }

    await sendNotification({
      title,
      body,
      icon: 'icons/icon.png',
    });
  } catch (err) {
    console.error('Failed to show notification:', err);
  }
}
