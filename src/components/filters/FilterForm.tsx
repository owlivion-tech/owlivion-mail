// ============================================================================
// Owlivion Mail - Filter Form Component
// ============================================================================

import { useState, useEffect } from 'react';
import type {
  EmailFilter,
  NewEmailFilter,
  FilterCondition,
  FilterAction,
  ConditionField,
  ConditionOperator,
  FilterActionType,
  FilterTemplate,
} from '../../types';
import { getFilterTemplates, getTemplateCategories } from '../../services/filterTemplates';
import { useTranslation } from '../../i18n';

// Icons
const Icons = {
  X: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

// Label maps are inside component to access t()

interface FilterFormProps {
  isOpen: boolean;
  onClose: () => void;
  filter?: EmailFilter; // For editing
  accountId: number;
  onSave: (filter: NewEmailFilter) => Promise<void>;
}

export function FilterForm({
  isOpen,
  onClose,
  filter,
  accountId,
  onSave,
}: FilterFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [priority, setPriority] = useState(10);
  const [matchLogic, setMatchLogic] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: 'from', operator: 'contains', value: '' },
  ]);
  const [actions, setActions] = useState<FilterAction[]>([
    { action: 'mark_as_read' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { t, lang } = useTranslation();
  const FILTER_TEMPLATES = getFilterTemplates(lang);
  const TEMPLATE_CATEGORIES = getTemplateCategories(lang);

  const FIELD_LABELS: Record<ConditionField, string> = {
    from: t('filters.filterForm.from'),
    to: t('filters.filterForm.to'),
    subject: t('filters.filterForm.subject'),
    body: t('filters.filterForm.body'),
    has_attachment: t('filters.filterForm.hasAttachment'),
  };

  const OPERATOR_LABELS: Record<ConditionOperator, string> = {
    contains: t('filters.filterForm.contains'),
    not_contains: t('filters.filterForm.notContains'),
    equals: t('filters.filterForm.equals'),
    not_equals: t('filters.filterForm.notEquals'),
    starts_with: t('filters.filterForm.startsWith'),
    ends_with: t('filters.filterForm.endsWith'),
  };

  const ACTION_LABELS: Record<FilterActionType, string> = {
    move_to_folder: t('filters.filterForm.moveToFolder'),
    add_label: t('filters.filterForm.addLabel'),
    mark_as_read: t('filters.filterForm.markAsRead'),
    mark_as_starred: t('filters.filterForm.markAsStarred'),
    mark_as_spam: t('filters.filterForm.markAsSpam'),
    delete: t('filters.filterForm.deleteAction'),
    archive: t('filters.filterForm.archiveAction'),
  };

  // Load filter data when editing
  useEffect(() => {
    if (filter) {
      setName(filter.name);
      setDescription(filter.description || '');
      setIsEnabled(filter.isEnabled);
      setPriority(filter.priority);
      setMatchLogic(filter.matchLogic);
      setConditions(filter.conditions.length > 0 ? filter.conditions : [
        { field: 'from', operator: 'contains', value: '' },
      ]);
      setActions(filter.actions.length > 0 ? filter.actions : [
        { action: 'mark_as_read' },
      ]);
      setShowTemplates(false);
    } else {
      // Reset for new filter
      setName('');
      setDescription('');
      setIsEnabled(true);
      setPriority(10);
      setMatchLogic('all');
      setConditions([{ field: 'from', operator: 'contains', value: '' }]);
      setActions([{ action: 'mark_as_read' }]);
      setShowTemplates(!filter); // Show templates only for new filters
    }
    setError('');
    setSelectedCategory('all');
  }, [filter, isOpen]);

  // Apply template
  const applyTemplate = (template: FilterTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setPriority(template.priority);
    setMatchLogic('any'); // Most templates use OR logic
    setConditions(template.conditions);
    setActions(template.actions);
    setShowTemplates(false);
  };

  // Get filtered templates
  const filteredTemplates =
    selectedCategory === 'all'
      ? FILTER_TEMPLATES
      : FILTER_TEMPLATES.filter(tmpl => tmpl.category === selectedCategory);

  // Add condition
  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: 'from', operator: 'contains', value: '' },
    ]);
  };

  // Remove condition
  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  // Update condition
  const updateCondition = (
    index: number,
    field: keyof FilterCondition,
    value: string
  ) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  // Add action
  const addAction = () => {
    setActions([...actions, { action: 'mark_as_read' }]);
  };

  // Remove action
  const removeAction = (index: number) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  // Update action
  const updateAction = (index: number, updates: Partial<FilterAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...updates };
    setActions(updated);
  };

  // Validate and save
  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError(t('filters.filterForm.nameRequired'));
      return;
    }

    if (conditions.length === 0) {
      setError(t('filters.filterForm.conditionRequired'));
      return;
    }

    // Check if all conditions have values (except has_attachment)
    for (const cond of conditions) {
      if (cond.field !== 'has_attachment' && !cond.value.trim()) {
        setError(t('filters.filterForm.conditionValueRequired'));
        return;
      }
    }

    if (actions.length === 0) {
      setError(t('filters.filterForm.actionRequired'));
      return;
    }

    // Check action-specific requirements
    for (const action of actions) {
      if (action.action === 'move_to_folder' && !action.folderId) {
        setError(t('filters.filterForm.folderRequired'));
        return;
      }
      if (action.action === 'add_label' && !action.label?.trim()) {
        setError(t('filters.filterForm.labelRequired'));
        return;
      }
    }

    setIsSaving(true);
    setError('');

    try {
      const newFilter: NewEmailFilter = {
        accountId,
        name: name.trim(),
        description: description.trim() || undefined,
        isEnabled,
        priority,
        matchLogic,
        conditions,
        actions,
      };

      await onSave(newFilter);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('filters.filterForm.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100">
            {filter ? t('filters.filterForm.editFilter') : t('filters.filterForm.createFilter')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
          >
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Template Selection (only for new filters) */}
          {!filter && showTemplates && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  {t('filters.filterForm.templateTitle')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('filters.filterForm.templateSubtitle')}
                </p>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {t('filters.filterForm.allCategories')}
                </button>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>

              {/* Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {filteredTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="text-left p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600 hover:border-blue-500"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-100 mb-1">
                          {template.name}
                        </h4>
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {template.description}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                          <span>{template.conditions.length} {t('filters.filterForm.conditionCount')}</span>
                          <span>•</span>
                          <span>{template.actions.length} {t('filters.filterForm.actionCount')}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Start from Scratch Button */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowTemplates(false)}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition-colors"
                >
                  {t('filters.filterForm.createBlank')}
                </button>
              </div>
            </div>
          )}

          {/* Filter Form (show when editing or template not shown) */}
          {(filter || !showTemplates) && (
            <>
              {/* Back to Templates Button (only for new filters) */}
              {!filter && (
                <button
                  onClick={() => setShowTemplates(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 mb-2"
                >
                  {t('filters.filterForm.backToTemplates')}
                </button>
              )}
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('filters.filterForm.nameLabel')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder={t('filters.filterForm.namePlaceholderExample')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('filters.filterForm.descriptionLabel')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder={t('filters.filterForm.descriptionPlaceholderLong')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('filters.filterForm.priority')}
                </label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('filters.filterForm.matchLogic')}
                </label>
                <select
                  value={matchLogic}
                  onChange={(e) => setMatchLogic(e.target.value as 'all' | 'any')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">{t('filters.filterForm.matchAll')}</option>
                  <option value="any">{t('filters.filterForm.matchAny')}</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">{t('filters.filterForm.active')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">
                {t('filters.filterForm.conditionsRequired')}
              </h3>
              <button
                onClick={addCondition}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Icons.Plus />
                {t('filters.filterForm.addCondition')}
              </button>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <select
                      value={condition.field}
                      onChange={(e) =>
                        updateCondition(index, 'field', e.target.value)
                      }
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    >
                      {Object.entries(FIELD_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) =>
                        updateCondition(index, 'operator', e.target.value)
                      }
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    >
                      {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    {condition.field !== 'has_attachment' && (
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) =>
                          updateCondition(index, 'value', e.target.value)
                        }
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        placeholder={t('filters.filterForm.value')}
                      />
                    )}
                  </div>

                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(index)}
                      className="p-1.5 hover:bg-gray-700 rounded transition-colors text-red-400"
                      title={t('filters.filterForm.removeCondition')}
                    >
                      <Icons.Trash />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">
                {t('filters.filterForm.actionsRequired')}
              </h3>
              <button
                onClick={addAction}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Icons.Plus />
                {t('filters.filterForm.addAction')}
              </button>
            </div>

            <div className="space-y-3">
              {actions.map((action, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <select
                      value={action.action}
                      onChange={(e) =>
                        updateAction(index, { action: e.target.value as FilterActionType })
                      }
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    >
                      {Object.entries(ACTION_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    {action.action === 'move_to_folder' && (
                      <input
                        type="number"
                        value={action.folderId || ''}
                        onChange={(e) =>
                          updateAction(index, { folderId: Number(e.target.value) })
                        }
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        placeholder={t('filters.filterForm.folderId')}
                      />
                    )}

                    {action.action === 'add_label' && (
                      <input
                        type="text"
                        value={action.label || ''}
                        onChange={(e) =>
                          updateAction(index, { label: e.target.value })
                        }
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        placeholder={t('filters.filterForm.labelName')}
                      />
                    )}
                  </div>

                  {actions.length > 1 && (
                    <button
                      onClick={() => removeAction(index)}
                      className="p-1.5 hover:bg-gray-700 rounded transition-colors text-red-400"
                      title={t('filters.filterForm.removeAction')}
                    >
                      <Icons.Trash />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('filters.filterForm.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 min-w-[100px]"
          >
            {isSaving ? t('filters.filterForm.saving') : filter ? t('filters.filterForm.update') : t('filters.filterForm.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
