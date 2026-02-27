import { invoke } from '@tauri-apps/api/core';

let lastUnreadCount = -1;

export async function updateTrayUnreadCount(count: number): Promise<void> {
  if (count === lastUnreadCount) return;
  lastUnreadCount = count;
  try {
    await invoke('update_tray_badge', { unreadCount: count });
  } catch (err) {
    console.warn('Failed to update tray badge:', err);
  }
}

export function computeInboxUnreadCount(
  folders: Array<{ folder_type: string; unread_count: number }>
): number {
  return folders
    .filter(f => f.folder_type === 'Inbox')
    .reduce((sum, f) => sum + f.unread_count, 0);
}
