import {
  Star,
  StarOff,
  Edit2,
  Trash2,
  Copy,
  Power,
  PowerOff,
  Tag,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import type { EmailTemplate } from '../../types';

interface TemplateListProps {
  templates: EmailTemplate[];
  onEdit: (template: EmailTemplate) => void;
  onDelete: (template: EmailTemplate) => void;
  onToggle: (template: EmailTemplate) => void;
  onToggleFavorite: (template: EmailTemplate) => void;
  onDuplicate: (template: EmailTemplate) => void;
  loading?: boolean;
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

export default function TemplateList({
  templates,
  onEdit,
  onDelete,
  onToggle,
  onToggleFavorite,
  onDuplicate,
  loading = false,
}: TemplateListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg mb-2">Henüz şablon oluşturulmamış</p>
        <p className="text-sm">
          "Yeni Şablon" butonuna tıklayarak ilk email şablonunuzu oluşturun.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const categoryStyle = CATEGORY_STYLES[template.category] || CATEGORY_STYLES.custom;

        return (
          <div
            key={template.id}
            className={`
              bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
              p-4 hover:shadow-md transition-shadow
              ${!template.isEnabled ? 'opacity-60' : ''}
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Favorite Star */}
                <button
                  onClick={() => onToggleFavorite(template)}
                  className="text-gray-400 hover:text-yellow-500 transition-colors flex-shrink-0"
                  title={template.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                >
                  {template.isFavorite ? (
                    <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                  ) : (
                    <StarOff className="w-5 h-5" />
                  )}
                </button>

                {/* Name */}
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {template.name}
                </h3>

                {/* Category Badge */}
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0
                    ${categoryStyle.bg} ${categoryStyle.text}
                  `}
                >
                  {categoryStyle.label}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                {/* Enable/Disable */}
                <button
                  onClick={() => onToggle(template)}
                  className={`
                    p-1.5 rounded transition-colors
                    ${template.isEnabled
                      ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={template.isEnabled ? 'Devre Dışı Bırak' : 'Etkinleştir'}
                >
                  {template.isEnabled ? (
                    <Power className="w-4 h-4" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>

                {/* Edit */}
                <button
                  onClick={() => onEdit(template)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Düzenle"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Duplicate */}
                <button
                  onClick={() => onDuplicate(template)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Kopyala"
                >
                  <Copy className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => onDelete(template)}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Description */}
            {template.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
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

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                <Tag className="w-3 h-3 text-gray-400" />
                {template.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Footer Stats */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
              {/* Usage Count */}
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{template.usageCount} kullanım</span>
              </div>

              {/* Last Used */}
              {template.lastUsedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Son: {new Date(template.lastUsedAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              )}

              {/* Created */}
              <div className="flex items-center gap-1 ml-auto">
                <Calendar className="w-3 h-3" />
                <span>
                  Oluşturuldu: {new Date(template.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
