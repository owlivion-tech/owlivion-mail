// ============================================================================
// Owlivion Mail - Label Settings Component
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { Label, Account } from '../../types';
import { LABEL_COLORS } from '../../types';
import { labelCreate, labelList, labelUpdate, labelDelete } from '../../services/labelService';

interface LabelSettingsProps {
  accounts: Account[];
}

export function LabelSettings({ accounts }: LabelSettingsProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formAccountId, setFormAccountId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Select first account by default
  useEffect(() => {
    if (accounts.length > 0 && selectedAccount === null) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  const loadLabels = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await labelList(selectedAccount);
      setLabels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etiketler yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const openCreateForm = () => {
    setEditingLabel(null);
    setFormName('');
    setFormColor('blue');
    setFormAccountId(selectedAccount);
    setIsFormOpen(true);
  };

  const openEditForm = (label: Label) => {
    setEditingLabel(label);
    setFormName(label.name);
    setFormColor(label.color);
    setFormAccountId(label.accountId);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      if (editingLabel) {
        await labelUpdate(editingLabel.id, formName, formColor);
      } else {
        await labelCreate(formAccountId, formName, formColor);
      }
      setIsFormOpen(false);
      loadLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etiket kaydedilemedi');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await labelDelete(id);
      setConfirmDeleteId(null);
      loadLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etiket silinemedi');
    }
  };

  const getColorHex = (colorName: string) => {
    return LABEL_COLORS.find(c => c.name === colorName)?.hex || '#3b82f6';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-owl-text">Etiketler</h2>
          <p className="text-owl-text-secondary mt-1">
            E-postalarinizi organize etmek icin etiketler olusturun
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Etiket
        </button>
      </div>

      {/* Account filter */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-owl-text-secondary">Hesap:</span>
          <select
            value={selectedAccount ?? ''}
            onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
            className="bg-owl-surface border border-owl-border rounded-lg px-3 py-1.5 text-sm text-owl-text"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.email}</option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-owl-text-secondary">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Yukleniyor...
        </div>
      ) : labels.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-owl-text-secondary/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-owl-text-secondary">Henuz etiket yok</p>
          <p className="text-owl-text-secondary text-sm mt-1">Yeni bir etiket olusturarak baslayin</p>
        </div>
      ) : (
        <div className="space-y-2">
          {labels.map(label => (
            <div
              key={label.id}
              className="flex items-center justify-between p-3 bg-owl-surface rounded-lg border border-owl-border hover:border-owl-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: getColorHex(label.color) }}
                />
                <span className="text-owl-text font-medium">{label.name}</span>
                {label.accountId === null && (
                  <span className="text-xs text-owl-text-secondary bg-owl-bg px-2 py-0.5 rounded">Global</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditForm(label)}
                  className="p-1.5 text-owl-text-secondary hover:text-owl-text rounded-lg hover:bg-owl-bg transition-colors"
                  title="Duzenle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {confirmDeleteId === label.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(label.id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Sil
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs bg-owl-bg text-owl-text-secondary rounded hover:bg-owl-border transition-colors"
                    >
                      Iptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(label.id)}
                    className="p-1.5 text-owl-text-secondary hover:text-red-500 rounded-lg hover:bg-owl-bg transition-colors"
                    title="Sil"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-owl-surface rounded-xl border border-owl-border shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-owl-text mb-4">
              {editingLabel ? 'Etiketi Duzenle' : 'Yeni Etiket'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-owl-text-secondary mb-1">
                  Etiket Adi
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Orn: Is, Kisisel, Onemli..."
                  className="w-full bg-owl-bg border border-owl-border rounded-lg px-3 py-2 text-owl-text placeholder-owl-text-secondary/50 focus:outline-none focus:border-owl-accent"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium text-owl-text-secondary mb-2">
                  Renk
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {LABEL_COLORS.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setFormColor(c.name)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        formColor === c.name
                          ? 'ring-2 ring-owl-accent ring-offset-2 ring-offset-owl-surface scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Account selector (only for create) */}
              {!editingLabel && accounts.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-owl-text-secondary mb-1">
                    Hesap
                  </label>
                  <select
                    value={formAccountId ?? ''}
                    onChange={(e) => setFormAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-owl-bg border border-owl-border rounded-lg px-3 py-2 text-owl-text"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.email}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-owl-text-secondary hover:text-owl-text bg-owl-bg hover:bg-owl-border rounded-lg transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {editingLabel ? 'Kaydet' : 'Olustur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
