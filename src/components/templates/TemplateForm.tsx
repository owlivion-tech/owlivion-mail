import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import type { EmailTemplate, NewEmailTemplate, TemplateCategory } from '../../types';
import RichTextEditor from '../compose/RichTextEditor';
import {
  TEMPLATE_VARIABLES,
  previewTemplate,
  validateTemplateSyntax,
  getVariablesByCategory,
} from '../../utils/templateVariables';

interface TemplateFormProps {
  template?: EmailTemplate | null;
  accountId?: number;
  onSave: (template: NewEmailTemplate) => Promise<void>;
  onClose: () => void;
}

const CATEGORIES: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'business', label: 'İş' },
  { value: 'personal', label: 'Kişisel' },
  { value: 'customer_support', label: 'Müşteri Destek' },
  { value: 'sales', label: 'Satış' },
  { value: 'marketing', label: 'Pazarlama' },
  { value: 'internal', label: 'Dahili' },
  { value: 'custom', label: 'Özel' },
];

export default function TemplateForm({
  template,
  accountId,
  onSave,
  onClose,
}: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category || 'custom');
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subjectTemplate || '');
  const [bodyHtmlTemplate, setBodyHtmlTemplate] = useState(template?.bodyHtmlTemplate || '');
  const [tags, setTags] = useState<string[]>(template?.tags || []);
  const [isEnabled, setIsEnabled] = useState(template?.isEnabled ?? true);
  const [isFavorite, setIsFavorite] = useState(template?.isFavorite ?? false);

  const [newTag, setNewTag] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Validate on change
  useEffect(() => {
    const subjectValidation = validateTemplateSyntax(subjectTemplate);
    const bodyValidation = validateTemplateSyntax(bodyHtmlTemplate);

    const allErrors = [
      ...subjectValidation.errors,
      ...bodyValidation.errors,
    ];

    if (subjectValidation.unknownVariables.length > 0) {
      allErrors.push(
        `Konu'da bilinmeyen değişkenler: ${subjectValidation.unknownVariables.join(', ')}`
      );
    }
    if (bodyValidation.unknownVariables.length > 0) {
      allErrors.push(
        `Gövde'de bilinmeyen değişkenler: ${bodyValidation.unknownVariables.join(', ')}`
      );
    }

    setErrors(allErrors);
  }, [subjectTemplate, bodyHtmlTemplate]);

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleInsertVariable = (varKey: string, target: 'subject' | 'body') => {
    const variable = `{{ ${varKey} }}`;

    if (target === 'subject') {
      const input = subjectInputRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newValue =
          subjectTemplate.substring(0, start) +
          variable +
          subjectTemplate.substring(end);
        setSubjectTemplate(newValue);

        // Set cursor position after inserted variable
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
      } else {
        setSubjectTemplate(subjectTemplate + ' ' + variable);
      }
    } else {
      // For body, append at the end (RichTextEditor insertion is complex)
      setBodyHtmlTemplate(bodyHtmlTemplate + ' ' + variable);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      alert('Şablon adı zorunludur');
      return;
    }
    if (name.length > 200) {
      alert('Şablon adı 200 karakteri aşamaz');
      return;
    }
    if (subjectTemplate.length > 1000) {
      alert('Konu şablonu 1000 karakteri aşamaz');
      return;
    }
    if (bodyHtmlTemplate.length > 50000) {
      alert('Gövde şablonu 50KB boyutunu aşamaz');
      return;
    }

    if (errors.length > 0) {
      alert('Lütfen şablon sözdizimi hatalarını düzeltin');
      return;
    }

    const newTemplate: NewEmailTemplate = {
      accountId,
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      subjectTemplate: subjectTemplate.trim(),
      bodyHtmlTemplate: bodyHtmlTemplate.trim(),
      bodyTextTemplate: undefined, // Could be extracted from HTML
      tags,
      isEnabled,
      isFavorite,
    };

    setSaving(true);
    try {
      await onSave(newTemplate);
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(`Şablon kaydedilemedi: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  // Preview content
  const previewSubject = showPreview ? previewTemplate(subjectTemplate) : subjectTemplate;
  const previewBody = showPreview ? previewTemplate(bodyHtmlTemplate) : bodyHtmlTemplate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {template ? 'Şablonu Düzenle' : 'Yeni Email Şablonu'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Şablon Adı *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Örn: Karşılama Emaili"
              maxLength={200}
            />
            <p className="text-xs text-gray-500 mt-1">{name.length}/200</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Bu şablon ne için kullanılıyor?"
              rows={2}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Konu Şablonu *
            </label>
            <input
              ref={subjectInputRef}
              type="text"
              value={showPreview ? previewSubject : subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              disabled={showPreview}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Örn: Merhaba {{ recipient_name }}, Hoş Geldiniz!"
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 mt-1">{subjectTemplate.length}/1000</p>

            {/* Variable Insertion Buttons for Subject */}
            {!showPreview && (
              <div className="flex flex-wrap gap-1 mt-2">
                {TEMPLATE_VARIABLES.slice(0, 6).map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => handleInsertVariable(variable.key, 'subject')}
                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    title={variable.description}
                  >
                    {variable.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Body Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gövde Şablonu *
            </label>
            {showPreview ? (
              <div
                className="w-full min-h-[300px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900"
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
            ) : (
              <RichTextEditor
                content={bodyHtmlTemplate}
                onChange={setBodyHtmlTemplate}
                onPaste={() => {}} // No-op for template editor
                placeholder="Email içeriğinizi buraya yazın. Değişken eklemek için aşağıdaki butonları kullanın."
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {bodyHtmlTemplate.length} karakter (~{Math.round(bodyHtmlTemplate.length / 1024)}KB / 50KB)
            </p>

            {/* Variable Insertion Buttons for Body */}
            {!showPreview && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Değişken Ekle:
                </p>
                <div className="flex flex-wrap gap-1">
                  {getVariablesByCategory('sender').map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => handleInsertVariable(variable.key, 'body')}
                      className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                      title={variable.description}
                    >
                      {variable.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {getVariablesByCategory('recipient').map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => handleInsertVariable(variable.key, 'body')}
                      className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
                      title={variable.description}
                    >
                      {variable.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {getVariablesByCategory('datetime').map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => handleInsertVariable(variable.key, 'body')}
                      className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-200 dark:hover:bg-orange-900/50"
                      title={variable.description}
                    >
                      {variable.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Etiketler
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Etiket ekle"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Etkin</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Favori</span>
            </label>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Şablon Hataları:
                  </p>
                  <ul className="mt-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            {showPreview ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Önizlemeyi Kapat</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Önizleme</span>
              </>
            )}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || errors.length > 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Kaydediliyor...' : template ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
