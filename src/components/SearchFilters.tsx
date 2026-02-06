import { useState } from 'react';
import { SearchFilters as SearchFiltersType, DateRange, DateRangePreset, FolderType } from '../types';
import { Calendar, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onChange: (filters: SearchFiltersType) => void;
  onSearch: () => void;
  folders?: Array<{ id: number; name: string; folderType: FolderType }>;
}

export default function SearchFilters({ filters, onChange, onSearch, folders }: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Date range presets
  const datePresets: Array<{ value: DateRangePreset; label: string }> = [
    { value: 'last_7_days', label: 'Son 7 Gün' },
    { value: 'last_30_days', label: 'Son 30 Gün' },
    { value: 'last_3_months', label: 'Son 3 Ay' },
    { value: 'last_year', label: 'Son 1 Yıl' },
    { value: 'custom', label: 'Özel Tarih' },
  ];

  // Calculate date range from preset
  const getDateFromPreset = (preset: DateRangePreset): DateRange | undefined => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (preset) {
      case 'last_7_days': {
        const date = new Date(now);
        date.setDate(date.getDate() - 7);
        return { startDate: date.toISOString().split('T')[0], endDate: today };
      }
      case 'last_30_days': {
        const date = new Date(now);
        date.setDate(date.getDate() - 30);
        return { startDate: date.toISOString().split('T')[0], endDate: today };
      }
      case 'last_3_months': {
        const date = new Date(now);
        date.setMonth(date.getMonth() - 3);
        return { startDate: date.toISOString().split('T')[0], endDate: today };
      }
      case 'last_year': {
        const date = new Date(now);
        date.setFullYear(date.getFullYear() - 1);
        return { startDate: date.toISOString().split('T')[0], endDate: today };
      }
      case 'custom':
        return filters.dateRange || { startDate: undefined, endDate: undefined };
      default:
        return undefined;
    }
  };

  // Handle date preset change
  const handleDatePresetChange = (preset: DateRangePreset) => {
    const dateRange = getDateFromPreset(preset);
    onChange({ ...filters, dateRange: { ...dateRange, preset } });
  };

  // Handle custom date change
  const handleCustomDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const dateRange = filters.dateRange || { preset: 'custom' };
    onChange({
      ...filters,
      dateRange: {
        ...dateRange,
        preset: 'custom',
        [field]: value || undefined,
      },
    });
  };

  // Clear a specific filter
  const clearFilter = (field: keyof SearchFiltersType) => {
    const newFilters = { ...filters };
    delete newFilters[field];
    onChange(newFilters);
  };

  // Count active filters (excluding query)
  const activeFiltersCount = Object.keys(filters).filter(
    (key) => key !== 'query' && filters[key as keyof SearchFiltersType] !== undefined
  ).length;

  return (
    <div className="border-b border-owl-border bg-owl-bg-secondary">
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-owl-bg-tertiary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-owl-text-secondary" />
          <span className="text-owl-text-primary">Gelişmiş Filtreler</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-owl-accent text-white rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-owl-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-owl-text-secondary" />
        )}
      </button>

      {/* Filter Panel */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-owl-border">
          {/* Date Range Filter */}
          <div>
            <label className="block text-xs font-medium text-owl-text-secondary mb-2">
              <Calendar className="w-3 h-3 inline mr-1" />
              Tarih Aralığı
            </label>
            <div className="space-y-2">
              {/* Date Presets */}
              <div className="flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleDatePresetChange(preset.value)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      filters.dateRange?.preset === preset.value
                        ? 'bg-owl-accent text-white'
                        : 'bg-owl-bg-tertiary text-owl-text-primary hover:bg-owl-bg-hover'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                {filters.dateRange && (
                  <button
                    onClick={() => clearFilter('dateRange')}
                    className="px-2 py-1 text-xs text-owl-text-secondary hover:text-owl-danger transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Custom Date Inputs */}
              {filters.dateRange?.preset === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={filters.dateRange.startDate || ''}
                    onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                    className="px-3 py-1.5 text-sm bg-owl-bg-tertiary border border-owl-border rounded-lg text-owl-text-primary focus:outline-none focus:ring-2 focus:ring-owl-accent"
                    placeholder="Başlangıç"
                  />
                  <span className="text-owl-text-secondary text-sm">-</span>
                  <input
                    type="date"
                    value={filters.dateRange.endDate || ''}
                    onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                    className="px-3 py-1.5 text-sm bg-owl-bg-tertiary border border-owl-border rounded-lg text-owl-text-primary focus:outline-none focus:ring-2 focus:ring-owl-accent"
                    placeholder="Bitiş"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sender Filter */}
          <div>
            <label className="block text-xs font-medium text-owl-text-secondary mb-2">
              Gönderen
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={filters.fromEmail || ''}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    fromEmail: e.target.value || undefined,
                  })
                }
                className="flex-1 px-3 py-1.5 text-sm bg-owl-bg-tertiary border border-owl-border rounded-lg text-owl-text-primary placeholder:text-owl-text-tertiary focus:outline-none focus:ring-2 focus:ring-owl-accent"
                placeholder="email@example.com"
              />
              {filters.fromEmail && (
                <button
                  onClick={() => clearFilter('fromEmail')}
                  className="px-2 py-1 text-owl-text-secondary hover:text-owl-danger transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Folder Filter */}
          {folders && folders.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-owl-text-secondary mb-2">
                Klasör
              </label>
              <div className="flex gap-2">
                <select
                  value={filters.folderId || ''}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      folderId: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="flex-1 px-3 py-1.5 text-sm bg-owl-bg-tertiary border border-owl-border rounded-lg text-owl-text-primary focus:outline-none focus:ring-2 focus:ring-owl-accent"
                >
                  <option value="">Tüm Klasörler</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                {filters.folderId && (
                  <button
                    onClick={() => clearFilter('folderId')}
                    className="px-2 py-1 text-owl-text-secondary hover:text-owl-danger transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Filters (Checkboxes) */}
          <div>
            <label className="block text-xs font-medium text-owl-text-secondary mb-2">
              Hızlı Filtreler
            </label>
            <div className="flex flex-wrap gap-2">
              {/* Has Attachments */}
              <label className="flex items-center gap-2 px-3 py-1.5 bg-owl-bg-tertiary rounded-lg cursor-pointer hover:bg-owl-bg-hover transition-colors">
                <input
                  type="checkbox"
                  checked={filters.hasAttachments === true}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      hasAttachments: e.target.checked ? true : undefined,
                    })
                  }
                  className="w-4 h-4 text-owl-accent bg-owl-bg-primary border-owl-border rounded focus:ring-owl-accent focus:ring-2"
                />
                <span className="text-sm text-owl-text-primary">Ekli Dosyalı</span>
              </label>

              {/* Is Unread */}
              <label className="flex items-center gap-2 px-3 py-1.5 bg-owl-bg-tertiary rounded-lg cursor-pointer hover:bg-owl-bg-hover transition-colors">
                <input
                  type="checkbox"
                  checked={filters.isRead === false}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      isRead: e.target.checked ? false : undefined,
                    })
                  }
                  className="w-4 h-4 text-owl-accent bg-owl-bg-primary border-owl-border rounded focus:ring-owl-accent focus:ring-2"
                />
                <span className="text-sm text-owl-text-primary">Okunmamış</span>
              </label>

              {/* Is Starred */}
              <label className="flex items-center gap-2 px-3 py-1.5 bg-owl-bg-tertiary rounded-lg cursor-pointer hover:bg-owl-bg-hover transition-colors">
                <input
                  type="checkbox"
                  checked={filters.isStarred === true}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      isStarred: e.target.checked ? true : undefined,
                    })
                  }
                  className="w-4 h-4 text-owl-accent bg-owl-bg-primary border-owl-border rounded focus:ring-owl-accent focus:ring-2"
                />
                <span className="text-sm text-owl-text-primary">Yıldızlı</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-owl-border">
            <button
              onClick={onSearch}
              className="px-4 py-2 bg-owl-accent text-white text-sm font-medium rounded-lg hover:bg-owl-accent-hover transition-colors"
            >
              Ara
            </button>
            <button
              onClick={() => {
                onChange({ query: filters.query }); // Keep only the text query
                onSearch();
              }}
              className="px-4 py-2 bg-owl-bg-tertiary text-owl-text-primary text-sm font-medium rounded-lg hover:bg-owl-bg-hover transition-colors"
            >
              Filtreleri Temizle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
