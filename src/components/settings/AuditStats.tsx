/**
 * Audit Statistics Component
 * Display audit log statistics and insights
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AuditStats } from '../../types';

export const AuditStatsComponent = () => {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load stats
  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await invoke<{ success: boolean; stats: AuditStats }>(
        'sync_get_audit_stats'
      );

      if (response.success) {
        setStats(response.stats);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err) {
      console.error('Load audit stats error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  // Calculate success rate
  const getSuccessRate = () => {
    if (!stats) return 0;
    const { total_operations, successful } = stats.overall;
    if (total_operations === 0) return 0;
    return Math.round((successful / total_operations) * 100);
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'No data available'}</p>
      </div>
    );
  }

  const successRate = getSuccessRate();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Toplam İşlem
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.overall.total_operations}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Başarı Oranı
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                %{successRate}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Cihaz Sayısı
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.overall.unique_devices}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Başarısız İşlem
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.overall.failed}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Son 30 Gün Aktivite
        </h4>

        {stats.recent_activity.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            Son 30 günde aktivite yok
          </p>
        ) : (
          <div className="space-y-2">
            {stats.recent_activity.slice(0, 10).map((activity) => (
              <div
                key={activity.date}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(activity.date)}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {activity.successful} başarılı
                  </span>
                  {activity.failed > 0 && (
                    <span className="text-sm text-red-600 dark:text-red-400">
                      {activity.failed} başarısız
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Toplam: {activity.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Data Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Veri Tiplerine Göre
          </h4>

          {stats.by_data_type.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              Veri yok
            </p>
          ) : (
            <div className="space-y-3">
              {stats.by_data_type.map((item) => (
                <div key={item.data_type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {item.data_type}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            İşlemlere Göre
          </h4>

          {stats.by_action.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              Veri yok
            </p>
          ) : (
            <div className="space-y-3">
              {stats.by_action.map((item) => (
                <div key={item.action} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {item.action}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Failures */}
      {stats.recent_failures.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Son Başarısız İşlemler
          </h4>

          <div className="space-y-2">
            {stats.recent_failures.map((failure) => (
              <div
                key={failure.id}
                className="flex items-start justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {failure.data_type} - {failure.action}
                  </p>
                  {failure.error_message && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {failure.error_message}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(failure.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
