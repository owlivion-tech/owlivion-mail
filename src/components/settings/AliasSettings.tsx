// ============================================================================
// Owlivion Mail - Alias Settings Component
// Manage email aliases per account
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  listAliases,
  addAlias,
  deleteAlias,
  toggleAlias,
  setDefaultAlias,
} from '../../services/aliasService';
import type { EmailAlias } from '../../services/aliasService';
import type { Account } from '../../types';
import { useTranslation } from '../../i18n';

interface AliasSettingsProps {
  accounts: Account[];
}

export function AliasSettings({ accounts }: AliasSettingsProps) {
  const { t } = useTranslation();
  const [selectedAccount, setSelectedAccount] = useState<number>(accounts[0]?.id || 0);
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAliases = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const data = await listAliases(selectedAccount);
      setAliases(data);
    } catch (err) {
      console.error('Failed to load aliases:', err);
    }
    setLoading(false);
  }, [selectedAccount]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);

    try {
      await addAlias(selectedAccount, newEmail.trim(), newName.trim() || undefined);
      setNewEmail('');
      setNewName('');
      fetchAliases();
    } catch (err) {
      setError(String(err));
    }
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAlias(id);
      setAliases((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete alias:', err);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleAlias(id);
      setAliases((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_enabled: !a.is_enabled } : a)),
      );
    } catch (err) {
      console.error('Failed to toggle alias:', err);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await setDefaultAlias(id, selectedAccount);
      setAliases((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === id })),
      );
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };

  const currentAccount = accounts.find((a) => a.id === selectedAccount);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-owl-text-primary mb-1">{t('settings.aliasSettings.title')}</h3>
        <p className="text-sm text-owl-text-secondary">
          {t('settings.aliasSettings.subtitle')}
        </p>
      </div>

      {/* Account Selector */}
      {accounts.length > 1 && (
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(Number(e.target.value))}
          className="w-full px-3 py-2 bg-owl-bg-primary border border-owl-border rounded-lg text-owl-text-primary text-sm focus:outline-none focus:border-owl-accent-primary"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.email}
            </option>
          ))}
        </select>
      )}

      {/* Primary Email */}
      {currentAccount && (
        <div className="flex items-center gap-3 px-4 py-3 bg-owl-bg-secondary rounded-lg border border-owl-border">
          <div className="flex-1">
            <span className="text-sm text-owl-text-primary font-medium">
              {currentAccount.email}
            </span>
            <span className="ml-2 px-2 py-0.5 text-xs bg-owl-accent-primary/20 text-owl-accent-primary rounded-full">
              {t('settings.aliasSettings.primaryAccount')}
            </span>
          </div>
        </div>
      )}

      {/* Alias List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-12 bg-owl-bg-secondary/60 rounded-lg" />
          <div className="h-12 bg-owl-bg-secondary/60 rounded-lg" />
        </div>
      ) : aliases.length > 0 ? (
        <div className="space-y-2">
          {aliases.map((alias) => (
            <div
              key={alias.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                alias.is_enabled
                  ? 'bg-owl-bg-secondary border-owl-border'
                  : 'bg-owl-bg-secondary/40 border-owl-border/50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-owl-text-primary font-medium truncate">
                    {alias.alias_email}
                  </span>
                  {alias.is_default && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 rounded">
                      {t('settings.aliasSettings.isDefault')}
                    </span>
                  )}
                </div>
                {alias.alias_name && (
                  <span className="text-xs text-owl-text-muted">{alias.alias_name}</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {!alias.is_default && alias.is_enabled && (
                  <button
                    onClick={() => handleSetDefault(alias.id)}
                    className="p-1.5 text-owl-text-muted hover:text-purple-400 transition-colors"
                    title={t('settings.aliasSettings.makeDefault')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleToggle(alias.id)}
                  className={`p-1.5 transition-colors ${
                    alias.is_enabled
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-owl-text-muted hover:text-green-400'
                  }`}
                  title={alias.is_enabled ? t('settings.aliasSettings.disable') : t('settings.aliasSettings.enable')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {alias.is_enabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(alias.id)}
                  className="p-1.5 text-owl-text-muted hover:text-red-400 transition-colors"
                  title={t('common.delete')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-owl-text-muted">
          {t('settings.aliasSettings.noAliasesDesc')}
        </div>
      )}

      {/* Add New Alias */}
      <div className="space-y-3 pt-2 border-t border-owl-border">
        <label className="block text-sm font-medium text-owl-text-primary">
          {t('settings.aliasSettings.newAlias')}
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="alias@example.com"
            className="flex-1 px-3 py-2 bg-owl-bg-primary border border-owl-border rounded-lg text-owl-text-primary placeholder-owl-text-muted text-sm focus:outline-none focus:border-owl-accent-primary"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('settings.aliasSettings.displayNameOptional')}
            className="flex-1 px-3 py-2 bg-owl-bg-primary border border-owl-border rounded-lg text-owl-text-primary placeholder-owl-text-muted text-sm focus:outline-none focus:border-owl-accent-primary"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newEmail.trim()}
          className="px-4 py-2 bg-owl-accent-primary text-white text-sm font-medium rounded-lg hover:bg-owl-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {adding ? t('settings.aliasSettings.adding') : t('settings.aliasSettings.add')}
        </button>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
