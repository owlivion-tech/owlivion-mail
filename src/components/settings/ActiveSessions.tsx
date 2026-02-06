/**
 * Active Sessions Component
 * Display and manage active login sessions
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ActiveSession } from '../../types';

export const ActiveSessions = () => {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Load sessions
  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await invoke<{ success: boolean; sessions: ActiveSession[] }>(
        'sync_get_sessions'
      );

      if (response.success) {
        setSessions(response.sessions);
      } else {
        setError('Failed to load sessions');
      }
    } catch (err) {
      console.error('Load sessions error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  // Revoke session
  const revokeSession = async (deviceId: string) => {
    if (!confirm('Bu oturumu sonlandırmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setRevokingId(deviceId);
      setError(null);

      const response = await invoke<{ success: boolean }>(
        'sync_revoke_session',
        { deviceId }
      );

      if (response.success) {
        // Remove from list
        setSessions(prev => prev.filter(s => s.device_id !== deviceId));
      } else {
        setError('Failed to revoke session');
      }
    } catch (err) {
      console.error('Revoke session error:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  // Revoke all except current
  const revokeAll = async () => {
    if (!confirm('Mevcut cihaz hariç tüm oturumları sonlandırmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setError(null);

      const response = await invoke<{ success: boolean; revoked_count: number }>(
        'sync_revoke_all_sessions'
      );

      if (response.success) {
        // Reload sessions
        await loadSessions();
        alert(`${response.revoked_count} oturum sonlandırıldı.`);
      } else {
        setError('Failed to revoke sessions');
      }
    } catch (err) {
      console.error('Revoke all sessions error:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;

    return date.toLocaleDateString('tr-TR');
  };

  // Load on mount
  useEffect(() => {
    loadSessions();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aktif Oturumlar
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Hesabınıza giriş yapmış cihazları görüntüleyin ve yönetin
          </p>
        </div>

        {sessions.length > 1 && (
          <button
            onClick={revokeAll}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Diğer Oturumları Sonlandır
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Sessions list */}
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">Aktif oturum bulunamadı</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.device_id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                {/* Session info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Device icon */}
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>

                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {session.device_name}
                        {session.is_current && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            Bu Cihaz
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {session.platform}
                      </p>
                    </div>
                  </div>

                  {/* Location & IP */}
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{session.location}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Son aktivite: {formatDate(session.last_activity)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <span className="truncate">{session.ip_address}</span>
                    </div>
                  </div>
                </div>

                {/* Revoke button */}
                {!session.is_current && (
                  <button
                    onClick={() => revokeSession(session.device_id)}
                    disabled={revokingId === session.device_id}
                    className="ml-4 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {revokingId === session.device_id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 dark:border-red-400" />
                    ) : (
                      'Sonlandır'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Güvenlik İpucu</p>
            <p>Tanımadığınız bir cihaz görüyorsanız, hemen o oturumu sonlandırın ve şifrenizi değiştirin.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
