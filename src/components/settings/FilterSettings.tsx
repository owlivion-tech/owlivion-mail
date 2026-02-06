// ============================================================================
// Owlivion Mail - Filter Settings Component
// ============================================================================

import { useState, useEffect } from 'react';
import type { EmailFilter, NewEmailFilter, Account } from '../../types';
import { filterList, filterAdd, filterUpdate, filterDelete, filterToggle, filterApplyBatch } from '../../services';
import { FilterForm } from '../filters/FilterForm';
import { FilterList } from '../filters/FilterList';
import { FilterTestModal } from '../filters/FilterTestModal';

interface FilterSettingsProps {
  accounts: Account[];
}

export function FilterSettings({ accounts }: FilterSettingsProps) {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [filters, setFilters] = useState<EmailFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<EmailFilter | undefined>();
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testFilterId, setTestFilterId] = useState<number | null>(null);

  // Select first account by default
  useEffect(() => {
    if (accounts.length > 0 && selectedAccount === null) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  // Load filters when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadFilters();
    }
  }, [selectedAccount]);

  const loadFilters = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    setError(undefined);
    try {
      const data = await filterList(selectedAccount);
      setFilters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filtreler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFilter = async (filter: NewEmailFilter) => {
    try {
      if (editingFilter) {
        await filterUpdate(editingFilter.id, filter);
      } else {
        await filterAdd(filter);
      }
      await loadFilters();
      setIsFormOpen(false);
      setEditingFilter(undefined);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Filtre kaydedilemedi');
    }
  };

  const handleDeleteFilter = async (filterId: number) => {
    if (!confirm('Bu filtreyi silmek istediğinizden emin misiniz?')) return;

    try {
      await filterDelete(filterId);
      await loadFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filtre silinemedi');
    }
  };

  const handleToggleFilter = async (filterId: number) => {
    try {
      await filterToggle(filterId);
      await loadFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filtre durumu değiştirilemedi');
    }
  };

  const handleTestFilter = (filterId: number) => {
    setTestFilterId(filterId);
    setIsTestModalOpen(true);
  };

  const handleApplyFilter = async (filterId: number) => {
    if (!selectedAccount) return;
    if (!confirm('Bu filtreyi mevcut tüm emaillere uygulamak istediğinizden emin misiniz?')) return;

    setError(undefined);

    try {
      const result = await filterApplyBatch(selectedAccount, filterId);
      alert(
        `Filtre uygulandı:\n` +
        `- İşlenen email: ${result.emailsProcessed}\n` +
        `- Eşleşen email: ${result.filtersMatched}\n` +
        `- Uygulanan eylem: ${result.actionsExecuted}`
      );
      await loadFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filtre uygulanamadı');
    }
  };

  const handleEditFilter = (filter: EmailFilter) => {
    setEditingFilter(filter);
    setIsFormOpen(true);
  };

  const handleNewFilter = () => {
    setEditingFilter(undefined);
    setIsFormOpen(true);
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400">
          Filtre oluşturmak için önce bir hesap ekleyin
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Email Filtreleri</h2>
        <p className="text-gray-400">
          Gelen kutunuzu organize etmek için otomatik filtreler oluşturun
        </p>
      </div>

      {/* Account Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-300">Hesap:</label>
        <select
          value={selectedAccount || ''}
          onChange={(e) => setSelectedAccount(Number(e.target.value))}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName} ({account.email})
            </option>
          ))}
        </select>

        <button
          onClick={handleNewFilter}
          disabled={!selectedAccount}
          className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Filtre
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Filter List */}
      {selectedAccount && (
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
      )}

      {/* Filter Form Modal */}
      {isFormOpen && selectedAccount && (
        <FilterForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingFilter(undefined);
          }}
          filter={editingFilter}
          accountId={selectedAccount}
          onSave={handleSaveFilter}
        />
      )}

      {/* Test Modal */}
      {isTestModalOpen && testFilterId && selectedAccount && (
        <FilterTestModal
          isOpen={isTestModalOpen}
          onClose={() => {
            setIsTestModalOpen(false);
            setTestFilterId(null);
          }}
          filterId={testFilterId}
          accountId={selectedAccount}
        />
      )}
    </div>
  );
}
