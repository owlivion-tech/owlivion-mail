import { useState, useEffect } from 'react';
import { Plus, Search, Filter, AlertCircle } from 'lucide-react';
import type { Account, EmailTemplate, NewEmailTemplate } from '../../types';
import TemplateList from '../templates/TemplateList';
import TemplateForm from '../templates/TemplateForm';
import {
  templateList,
  templateAdd,
  templateUpdate,
  templateDelete,
  templateToggle,
  templateToggleFavorite,
} from '../../services';

interface TemplateSettingsProps {
  accounts: Account[];
}

export default function TemplateSettings({ accounts }: TemplateSettingsProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(
    accounts[0]?.id
  );
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Load templates
  useEffect(() => {
    if (selectedAccountId) {
      loadTemplates();
    }
  }, [selectedAccountId]);

  // Filter templates
  useEffect(() => {
    let result = [...templates];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.subjectTemplate.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }

    // Favorites filter
    if (favoritesOnly) {
      result = result.filter((t) => t.isFavorite);
    }

    setFilteredTemplates(result);
  }, [templates, searchQuery, categoryFilter, favoritesOnly]);

  const loadTemplates = async () => {
    if (!selectedAccountId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await templateList(selectedAccountId);
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Şablonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template: NewEmailTemplate) => {
    try {
      if (editingTemplate) {
        // Update existing
        await templateUpdate(editingTemplate.id, template);
      } else {
        // Create new
        await templateAdd({
          ...template,
          accountId: selectedAccountId,
        });
      }

      await loadTemplates();
      setShowForm(false);
      setEditingTemplate(null);
    } catch (err) {
      console.error('Failed to save template:', err);
      throw err;
    }
  };

  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (
      !confirm(
        `"${template.name}" şablonunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    ) {
      return;
    }

    try {
      await templateDelete(template.id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Şablon silinemedi');
    }
  };

  const handleToggleTemplate = async (template: EmailTemplate) => {
    try {
      await templateToggle(template.id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to toggle template:', err);
      alert('Şablon durumu değiştirilemedi');
    }
  };

  const handleToggleFavorite = async (template: EmailTemplate) => {
    try {
      await templateToggleFavorite(template.id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      alert('Favori durumu değiştirilemedi');
    }
  };

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    // Create a copy with "(Kopya)" suffix
    setEditingTemplate({
      ...template,
      id: 0, // Will be assigned by backend
      name: `${template.name} (Kopya)`,
      usageCount: 0,
      lastUsedAt: undefined,
    } as EmailTemplate);
    setShowForm(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Email şablonu kullanmak için önce bir hesap ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Email Şablonları
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Sık kullandığınız email içeriklerini şablon olarak kaydedin ve hızlıca kullanın.
          </p>
        </div>

        <button
          onClick={handleNewTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Şablon</span>
        </button>
      </div>

      {/* Account Selector */}
      {accounts.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Hesap Seçin
          </label>
          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(Number(e.target.value))}
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Şablon ara..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="min-w-[180px]">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="all">Tüm Kategoriler</option>
              <option value="business">İş</option>
              <option value="personal">Kişisel</option>
              <option value="customer_support">Müşteri Destek</option>
              <option value="sales">Satış</option>
              <option value="marketing">Pazarlama</option>
              <option value="internal">Dahili</option>
              <option value="custom">Özel</option>
            </select>
          </div>
        </div>

        {/* Favorites Toggle */}
        <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Sadece Favoriler
          </span>
        </label>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>
          Toplam: <strong>{templates.length}</strong> şablon
        </span>
        {filteredTemplates.length !== templates.length && (
          <span>
            Filtrelendi: <strong>{filteredTemplates.length}</strong> şablon
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Template List */}
      <TemplateList
        templates={filteredTemplates}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplate}
        onToggle={handleToggleTemplate}
        onToggleFavorite={handleToggleFavorite}
        onDuplicate={handleDuplicateTemplate}
        loading={loading}
      />

      {/* Form Modal */}
      {showForm && (
        <TemplateForm
          template={editingTemplate}
          accountId={selectedAccountId}
          onSave={handleSaveTemplate}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
