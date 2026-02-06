import { useState, useEffect } from 'react';
import { X, Search, Star, TrendingUp, FileText } from 'lucide-react';
import type { EmailTemplate } from '../../types';
import { templateList, templateSearch, templateGetFavorites } from '../../services';

interface TemplateSelectorProps {
  accountId: number;
  onSelect: (template: EmailTemplate) => void;
  onClose: () => void;
}

// Category colors and labels
const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  business: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'İş' },
  personal: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Kişisel' },
  customer_support: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Destek' },
  sales: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Satış' },
  marketing: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', label: 'Pazarlama' },
  internal: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', label: 'Dahili' },
  custom: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', label: 'Özel' },
};

export default function TemplateSelector({
  accountId,
  onSelect,
  onClose,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<number | null>(null);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, [accountId, favoritesOnly]);

  // Search debounce
  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    if (searchQuery.trim().length > 0) {
      const timeout = setTimeout(() => {
        performSearch();
      }, 300);
      setSearchDebounce(timeout);
    } else {
      loadTemplates();
    }

    return () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce);
      }
    };
  }, [searchQuery]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      let data: EmailTemplate[];
      if (favoritesOnly) {
        data = await templateGetFavorites(accountId);
      } else {
        data = await templateList(accountId);
      }
      // Filter only enabled templates
      setTemplates(data.filter(t => t.isEnabled));
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (searchQuery.trim().length === 0) {
      loadTemplates();
      return;
    }

    setLoading(true);
    try {
      const data = await templateSearch(accountId, searchQuery, 50);
      // Filter only enabled templates
      setTemplates(data.filter(t => t.isEnabled));
    } catch (error) {
      console.error('Failed to search templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (template: EmailTemplate) => {
    onSelect(template);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Email Şablonu Seç
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Şablon ara... (Ctrl+T)"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>

          {/* Favorites Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Sadece Favori Şablonlar
            </span>
          </label>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">
                {searchQuery
                  ? 'Şablon bulunamadı'
                  : favoritesOnly
                  ? 'Favori şablon yok'
                  : 'Henüz şablon oluşturulmamış'}
              </p>
              <p className="text-sm">
                Ayarlar → Şablonlar bölümünden yeni şablon oluşturabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const categoryStyle = CATEGORY_STYLES[template.category] || CATEGORY_STYLES.custom;

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      {template.isFavorite && (
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                      )}
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex-1 truncate">
                        {template.name}
                      </h3>
                      <span
                        className={`
                          px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0
                          ${categoryStyle.bg} ${categoryStyle.text}
                        `}
                      >
                        {categoryStyle.label}
                      </span>
                    </div>

                    {/* Description */}
                    {template.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                        {template.description}
                      </p>
                    )}

                    {/* Subject Preview */}
                    <div className="mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Konu:
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {template.subjectTemplate || '(Konu yok)'}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{template.usageCount} kullanım</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">ESC</kbd> tuşuna
            basarak kapat | Şablon seçmek için tıklayın
          </p>
        </div>
      </div>
    </div>
  );
}
