// ============================================================================
// Owlivion Mail - Filters Page
// ============================================================================

import { useState, useEffect } from 'react';
import { FilterList } from '../components/filters/FilterList';
import { FilterForm } from '../components/filters/FilterForm';
import { FilterTestModal } from '../components/filters/FilterTestModal';
import { filterList as fetchFilters, filterAdd, filterUpdate, filterDelete, filterToggle, filterApplyBatch, filterExport, filterImport } from '../services/filterService';
import { listAccounts, syncEmailsWithFilters } from '../services/mailService';
import type { EmailFilter, NewEmailFilter, Account } from '../types';

interface FiltersProps {
  onBack: () => void;
  defaultAccountId?: number;
}

const Icons = {
  ArrowLeft: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Play: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function Filters({ onBack, defaultAccountId }: FiltersProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(defaultAccountId || 0);
  const [filters, setFilters] = useState<EmailFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<EmailFilter | undefined>();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    emailsProcessed: number;
    filtersMatched: number;
    actionsExecuted: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    newEmailsCount: number;
    filtersAppliedCount: number;
  } | null>(null);
  const [testingFilterId, setTestingFilterId] = useState<number | null>(null);

  // Load accounts
  useEffect(() => {
    loadAccounts();
  }, []);

  // Load filters when account changes
  useEffect(() => {
    if (selectedAccountId > 0) {
      loadFilters();
    }
  }, [selectedAccountId]);

  // Load accounts
  const loadAccounts = async () => {
    try {
      const accountList = await listAccounts();
      setAccounts(accountList);

      // Select first account if no default
      if (!defaultAccountId && accountList.length > 0) {
        setSelectedAccountId(accountList[0].id);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
      showToast('error', 'Hesaplar yüklenemedi');
    }
  };

  // Load filters
  const loadFilters = async () => {
    if (selectedAccountId <= 0) return;

    setLoading(true);
    setError('');

    try {
      const filters = await fetchFilters(selectedAccountId);
      setFilters(filters);
    } catch (err) {
      console.error('Failed to load filters:', err);
      setError(err instanceof Error ? err.message : 'Filtreler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle create filter
  const handleCreateFilter = () => {
    setEditingFilter(undefined);
    setIsFormOpen(true);
  };

  // Handle edit filter
  const handleEditFilter = (filter: EmailFilter) => {
    setEditingFilter(filter);
    setIsFormOpen(true);
  };

  // Handle save filter
  const handleSaveFilter = async (filter: NewEmailFilter) => {
    try {
      if (editingFilter) {
        // Update existing
        await filterUpdate(editingFilter.id, filter);
        showToast('success', 'Filtre güncellendi');
      } else {
        // Create new
        await filterAdd(filter);
        showToast('success', 'Filtre oluşturuldu');
      }

      // Reload filters
      await loadFilters();
      setIsFormOpen(false);
    } catch (err) {
      throw err; // Let form handle the error
    }
  };

  // Handle delete filter
  const handleDeleteFilter = async (filterId: number) => {
    if (!confirm('Bu filtreyi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await filterDelete(filterId);
      showToast('success', 'Filtre silindi');
      await loadFilters();
    } catch (err) {
      console.error('Failed to delete filter:', err);
      showToast('error', 'Filtre silinemedi');
    }
  };

  // Handle toggle filter
  const handleToggleFilter = async (filterId: number) => {
    try {
      await filterToggle(filterId);
      showToast('success', 'Filtre durumu değiştirildi');
      await loadFilters();
    } catch (err) {
      console.error('Failed to toggle filter:', err);
      showToast('error', 'Filtre durumu değiştirilemedi');
    }
  };

  // Handle test filter
  const handleTestFilter = (filterId: number) => {
    setTestingFilterId(filterId);
  };

  // Handle apply filter to existing emails
  const handleApplyFilter = async (filterId: number) => {
    if (!confirm('Bu filtreyi mevcut tüm emaillere uygulamak istediğinizden emin misiniz?')) {
      return;
    }

    setIsBatchProcessing(true);
    setBatchResult(null);

    try {
      const result = await filterApplyBatch(selectedAccountId, filterId);
      setBatchResult(result);
      showToast('success', `${result.actionsExecuted} eylem uygulandı`);
    } catch (err) {
      console.error('Failed to apply filter:', err);
      showToast('error', 'Filtre uygulanamadı');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Handle apply all filters
  const handleApplyAllFilters = async () => {
    if (!confirm('Tüm aktif filtreleri mevcut emaillere uygulamak istediğinizden emin misiniz? Bu işlem uzun sürebilir.')) {
      return;
    }

    setIsBatchProcessing(true);
    setBatchResult(null);

    try {
      const result = await filterApplyBatch(selectedAccountId);
      setBatchResult(result);
      showToast('success', `${result.actionsExecuted} eylem uygulandı`);
    } catch (err) {
      console.error('Failed to apply filters:', err);
      showToast('error', 'Filtreler uygulanamadı');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Handle export filters
  const handleExportFilters = async () => {
    try {
      const jsonData = await filterExport(selectedAccountId);

      // Create blob and download
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `filters-${selectedAccountId}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('success', 'Filtreler dışa aktarıldı');
    } catch (err) {
      console.error('Failed to export filters:', err);
      showToast('error', 'Filtreler dışa aktarılamadı');
    }
  };

  // Handle import filters
  const handleImportFilters = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = await filterImport(selectedAccountId, text);
        showToast('success', `${count} filtre içe aktarıldı`);
        await loadFilters();
      } catch (err) {
        console.error('Failed to import filters:', err);
        showToast('error', 'Filtreler içe aktarılamadı');
      }
    };
    input.click();
  };

  // Handle sync emails with filters
  const handleSyncWithFilters = async () => {
    if (!confirm('Email senkronizasyonu yapılacak ve filtreler otomatik uygulanacak. Devam edilsin mi?')) {
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const account = accounts.find(a => a.id === selectedAccountId);
      if (!account) {
        showToast('error', 'Hesap bulunamadı');
        return;
      }

      const result = await syncEmailsWithFilters(
        selectedAccountId.toString(),
        0,
        50,
        'INBOX'
      );

      setSyncResult({
        newEmailsCount: result.newEmailsCount,
        filtersAppliedCount: result.filtersAppliedCount,
      });

      showToast('success', `${result.newEmailsCount} yeni email, ${result.filtersAppliedCount} filtre uygulandı`);
    } catch (err) {
      console.error('Failed to sync with filters:', err);
      showToast('error', 'Senkronizasyon başarısız');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Geri dön"
          >
            <Icons.ArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-100">Email Filtreleri</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Account Selector */}
          {accounts.length > 1 && (
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} ({account.email})
                </option>
              ))}
            </select>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadFilters}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Yenile"
          >
            <Icons.Refresh />
          </button>

          {/* Sync with Filters Button */}
          {filters.length > 0 && (
            <button
              onClick={handleSyncWithFilters}
              disabled={selectedAccountId <= 0 || isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Email senkronizasyonu yap ve filtreleri otomatik uygula"
            >
              <Icons.Refresh />
              {isSyncing ? 'Senkronize ediliyor...' : 'Filtrelerle Senkronize Et'}
            </button>
          )}

          {/* Import Button */}
          <button
            onClick={handleImportFilters}
            disabled={selectedAccountId <= 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            İçe Aktar
          </button>

          {/* Export Button */}
          {filters.length > 0 && (
            <button
              onClick={handleExportFilters}
              disabled={selectedAccountId <= 0}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dışa Aktar
            </button>
          )}

          {/* Apply All Button */}
          {filters.length > 0 && (
            <button
              onClick={handleApplyAllFilters}
              disabled={selectedAccountId <= 0 || isBatchProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons.Play />
              {isBatchProcessing ? 'Uygulanıyor...' : 'Tümünü Uygula'}
            </button>
          )}

          {/* Create Filter Button */}
          <button
            onClick={handleCreateFilter}
            disabled={selectedAccountId <= 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.Plus />
            Yeni Filtre
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {selectedAccountId <= 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-400 text-center">
              Filtre oluşturmak için bir hesap seçin
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <FilterList
              filters={filters}
              loading={loading}
              error={error}
              onEdit={handleEditFilter}
              onDelete={handleDeleteFilter}
              onToggle={handleToggleFilter}
              onTest={handleTestFilter}
              onApply={handleApplyFilter}
            />
          </div>
        )}
      </div>

      {/* Filter Form Modal */}
      <FilterForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        filter={editingFilter}
        accountId={selectedAccountId}
        onSave={handleSaveFilter}
      />

      {/* Filter Test Modal */}
      {testingFilterId && (
        <FilterTestModal
          isOpen={true}
          onClose={() => setTestingFilterId(null)}
          filterId={testingFilterId}
          accountId={selectedAccountId}
        />
      )}

      {/* Sync Result Modal */}
      {syncResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Senkronizasyon Sonuçları
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Yeni Email:</span>
                <span className="text-gray-100 font-medium">{syncResult.newEmailsCount}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-400">Filtre Uygulandı:</span>
                <span className="text-green-400 font-medium">{syncResult.filtersAppliedCount}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSyncResult(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Result Modal */}
      {batchResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Filtre Uygulama Sonuçları
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">İşlenen Email:</span>
                <span className="text-gray-100 font-medium">{batchResult.emailsProcessed}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Eşleşen Filtre:</span>
                <span className="text-gray-100 font-medium">{batchResult.filtersMatched}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-400">Uygulanan Eylem:</span>
                <span className="text-green-400 font-medium">{batchResult.actionsExecuted}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setBatchResult(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
