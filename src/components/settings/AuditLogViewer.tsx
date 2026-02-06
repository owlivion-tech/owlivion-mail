/**
 * Audit Log Viewer Component
 * Display sync history with filtering and pagination
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AuditLog, AuditLogFilters } from '../../types';

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Load logs
  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await invoke<{
        success: boolean;
        logs: AuditLog[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>('sync_get_audit_logs', { filters });

      if (response.success) {
        setLogs(response.logs);
        setTotalPages(response.pagination.pages);
        setTotalCount(response.pagination.total);
      } else {
        setError('Failed to load audit logs');
      }
    } catch (err) {
      console.error('Load audit logs error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV
  const exportLogs = async () => {
    try {
      const response = await invoke<{ success: boolean; csv_path: string }>(
        'sync_export_audit_logs',
        {
          startDate: filters.start_date,
          endDate: filters.end_date,
        }
      );

      if (response.success) {
        alert(`Audit logları başarıyla dışa aktarıldı:\n${response.csv_path}`);
      } else {
        alert('Dışa aktarma başarısız oldu');
      }
    } catch (err) {
      console.error('Export audit logs error:', err);
      alert(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  // Get status badge
  const getStatusBadge = (success: boolean) => {
    if (success) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
          Başarılı
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
        Başarısız
      </span>
    );
  };

  // Load logs on filter change
  useEffect(() => {
    loadLogs();
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aktivite Günlüğü
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Senkronizasyon geçmişinizi görüntüleyin ({totalCount} kayıt)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtrele
          </button>

          <button
            onClick={exportLogs}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV İndir
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Veri Tipi
              </label>
              <select
                value={filters.data_type || ''}
                onChange={(e) => setFilters({ ...filters, data_type: e.target.value || undefined, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Tümü</option>
                <option value="contacts">Kişiler</option>
                <option value="signatures">İmzalar</option>
                <option value="settings">Ayarlar</option>
                <option value="filters">Filtreler</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                İşlem
              </label>
              <select
                value={filters.action || ''}
                onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Tümü</option>
                <option value="upload">Yükleme</option>
                <option value="download">İndirme</option>
                <option value="delete">Silme</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Durum
              </label>
              <select
                value={filters.success === undefined ? '' : filters.success.toString()}
                onChange={(e) => setFilters({ ...filters, success: e.target.value === '' ? undefined : e.target.value === 'true', page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Tümü</option>
                <option value="true">Başarılı</option>
                <option value="false">Başarısız</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setFilters({ page: 1, limit: 50 });
                setShowFilters(false);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Filtreleri Temizle
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
        </div>
      ) : (
        <>
          {/* Logs table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Zaman
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Veri Tipi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İşlem
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cihaz
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IP Adresi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                        Kayıt bulunamadı
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        title={log.error_message || undefined}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {log.data_type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                          {log.device_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {log.ip_address || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(log.success)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sayfa {filters.page} / {totalPages}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                  disabled={filters.page === 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Önceki
                </button>

                <button
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                  disabled={filters.page === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
