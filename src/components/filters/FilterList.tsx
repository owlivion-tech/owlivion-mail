// ============================================================================
// Owlivion Mail - Filter List Component
// ============================================================================

import type { EmailFilter } from '../../types';

// Icons
const Icons = {
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Toggle: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  TestTube: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  Play: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Filter: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
};

interface FilterListProps {
  filters: EmailFilter[];
  loading: boolean;
  error?: string;
  onEdit: (filter: EmailFilter) => void;
  onDelete: (filterId: number) => void;
  onToggle: (filterId: number) => void;
  onTest: (filterId: number) => void;
  onApply: (filterId: number) => void;
}

export function FilterList({
  filters,
  loading,
  error,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  onApply,
}: FilterListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-500 font-medium mb-2">Hata</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (filters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Icons.Filter />
        <h3 className="mt-4 text-lg font-medium text-gray-300">
          Henüz filtre oluşturulmamış
        </h3>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-md">
          Email'lerinizi otomatik olarak organize etmek için filtreler oluşturun.
          Gelen kutusundaki karmaşayı azaltın ve önemli mesajları kaçırmayın.
        </p>
      </div>
    );
  }

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Hiç';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-3">
      {filters.map((filter) => (
        <div
          key={filter.id}
          className={`border rounded-lg p-4 transition-all ${
            filter.isEnabled
              ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
              : 'bg-gray-800/50 border-gray-700/50 opacity-60'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-100 truncate">
                  {filter.name}
                </h3>
                {!filter.isEnabled && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-400 rounded">
                    Pasif
                  </span>
                )}
              </div>
              {filter.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {filter.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => onApply(filter.id)}
                className="p-2 hover:bg-gray-700 rounded transition-colors text-green-400"
                title="Mevcut emaillere uygula"
              >
                <Icons.Play />
              </button>
              <button
                onClick={() => onToggle(filter.id)}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title={filter.isEnabled ? 'Pasif yap' : 'Aktif yap'}
              >
                <Icons.Toggle />
              </button>
              <button
                onClick={() => onTest(filter.id)}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Filtreyi test et"
              >
                <Icons.TestTube />
              </button>
              <button
                onClick={() => onEdit(filter)}
                className="p-2 hover:bg-gray-700 rounded transition-colors text-blue-400"
                title="Düzenle"
              >
                <Icons.Edit />
              </button>
              <button
                onClick={() => onDelete(filter.id)}
                className="p-2 hover:bg-gray-700 rounded transition-colors text-red-400"
                title="Sil"
              >
                <Icons.Trash />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-700">
            <div>
              <div className="text-xs text-gray-500">Öncelik</div>
              <div className="text-sm font-medium text-gray-300">
                {filter.priority}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Eşleşme</div>
              <div className="text-sm font-medium text-gray-300">
                {filter.matchedCount} email
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Son eşleşme</div>
              <div className="text-sm font-medium text-gray-300">
                {formatDate(filter.lastMatchedAt)}
              </div>
            </div>
          </div>

          {/* Conditions & Actions Summary */}
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 min-w-[80px]">
                Koşullar:
              </span>
              <span className="text-xs text-gray-400">
                {filter.conditions.length} koşul ({filter.matchLogic === 'all' ? 'Tümü' : 'Herhangi biri'})
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 min-w-[80px]">
                Eylemler:
              </span>
              <span className="text-xs text-gray-400">
                {filter.actions.length} eylem
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
