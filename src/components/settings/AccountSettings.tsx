// ============================================================================
// Owlivion Mail - Account Settings Component
// ============================================================================

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AddAccountModal } from './AddAccountModal';
import { getAccountPriorityFetch, setAccountPriorityFetch } from '../../services/mailService';
import type { Account } from '../../types';

interface AccountSettingsProps {
  accounts: Account[];
  onAccountsChange: (accounts: Account[]) => void;
}

export function AccountSettings({ accounts, onAccountsChange }: AccountSettingsProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountPrioritySettings, setAccountPrioritySettings] = useState<Record<number, boolean>>({});

  // Load priority settings for all accounts
  useEffect(() => {
    const loadPrioritySettings = async () => {
      const settings: Record<number, boolean> = {};
      for (const account of accounts) {
        try {
          const enabled = await getAccountPriorityFetch(account.id);
          settings[account.id] = enabled;
        } catch (error) {
          console.error(`Failed to load priority setting for account ${account.id}:`, error);
          settings[account.id] = true; // Default to true
        }
      }
      setAccountPrioritySettings(settings);
    };

    if (accounts.length > 0) {
      loadPrioritySettings();
    }
  }, [accounts]);

  const handleTogglePriorityFetch = async (accountId: number, enabled: boolean) => {
    try {
      await setAccountPriorityFetch(accountId, enabled);
      setAccountPrioritySettings(prev => ({ ...prev, [accountId]: enabled }));
    } catch (error) {
      console.error('Failed to update priority setting:', error);
      alert('Öncelik ayarı güncellenirken bir hata oluştu: ' + error);
    }
  };

  const handleDeleteAccount = async (accountId: number) => {
    if (confirm('Bu hesabı silmek istediğinizden emin misiniz?')) {
      try {
        // Call backend to delete from database
        await invoke('account_delete', { accountId: accountId.toString() });
        // Update local state after successful deletion
        onAccountsChange(accounts.filter((a) => a.id !== accountId));
      } catch (error) {
        console.error('Failed to delete account:', error);
        alert('Hesap silinirken bir hata oluştu: ' + error);
      }
    }
  };

  const handleSetDefault = (accountId: number) => {
    onAccountsChange(
      accounts.map((a) => ({
        ...a,
        isDefault: a.id === accountId,
      }))
    );
  };

  const handleToggleActive = (accountId: number) => {
    onAccountsChange(
      accounts.map((a) =>
        a.id === accountId ? { ...a, isActive: !a.isActive } : a
      )
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-owl-text">E-posta Hesapları</h2>
          <p className="text-owl-text-secondary mt-1">
            E-posta hesaplarınızı yönetin
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Hesap Ekle
        </button>
      </div>

      {/* Account List */}
      {accounts.length === 0 ? (
        <div className="bg-owl-surface border border-owl-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-owl-surface-2 flex items-center justify-center">
            <svg className="w-8 h-8 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-owl-text mb-2">
            Henüz hesap eklenmedi
          </h3>
          <p className="text-owl-text-secondary mb-6">
            E-posta almaya ve göndermeye başlamak için bir hesap ekleyin
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white font-medium rounded-lg transition-colors"
          >
            İlk Hesabı Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`bg-owl-surface border rounded-xl p-5 transition-colors ${
                account.isActive
                  ? 'border-owl-border'
                  : 'border-owl-border/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Account Info */}
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-owl-accent/20 flex items-center justify-center text-owl-accent font-semibold text-lg">
                    {account.displayName.charAt(0).toUpperCase()}
                  </div>

                  {/* Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-owl-text">
                        {account.displayName}
                      </h3>
                      {account.isDefault && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-owl-accent/20 text-owl-accent rounded-full">
                          Varsayılan
                        </span>
                      )}
                      {!account.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-owl-warning/20 text-owl-warning rounded-full">
                          Devre Dışı
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-owl-text-secondary mt-0.5">
                      {account.email}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-owl-text-secondary">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-owl-success"></span>
                        IMAP: {account.imapHost}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-owl-success"></span>
                        SMTP: {account.smtpHost}
                      </span>
                      {account.oauthProvider && (
                        <span className="capitalize">
                          {account.oauthProvider} OAuth
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!account.isDefault && (
                    <button
                      onClick={() => handleSetDefault(account.id)}
                      className="px-3 py-1.5 text-sm text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
                      title="Varsayılan yap"
                    >
                      Varsayılan Yap
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(account.id)}
                    className="px-3 py-1.5 text-sm text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
                    title={account.isActive ? 'Devre dışı bırak' : 'Etkinleştir'}
                  >
                    {account.isActive ? 'Devre Dışı Bırak' : 'Etkinleştir'}
                  </button>
                  <button
                    onClick={() => setEditingAccount(account)}
                    className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
                    title="Düzenle"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="p-2 text-owl-text-secondary hover:text-owl-error hover:bg-owl-error/10 rounded-lg transition-colors"
                    title="Sil"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Priority Fetching Settings */}
      {accounts.length > 1 && (
        <div className="mt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-owl-text">Öncelikli E-posta Çekme</h3>
            <p className="text-sm text-owl-text-secondary mt-1">
              Etkinleştirildiğinde, okunmamış e-postalar her hesap için önce getirilir
            </p>
          </div>

          <div className="bg-owl-surface border border-owl-border rounded-xl divide-y divide-owl-border">
            {accounts.map((account) => (
              <div key={account.id} className="p-4 flex items-center justify-between">
                {/* Account Info */}
                <div className="flex items-center gap-3">
                  {/* Color Badge */}
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: `hsl(${(account.email.charCodeAt(0) * 137.508) % 360}, 70%, 60%)`
                    }}
                  ></div>

                  {/* Account Details */}
                  <div>
                    <p className="font-medium text-owl-text">{account.displayName}</p>
                    <p className="text-sm text-owl-text-secondary">{account.email}</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={accountPrioritySettings[account.id] ?? true}
                    onChange={(e) => handleTogglePriorityFetch(account.id, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-owl-surface-2 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-owl-accent/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-owl-accent"></div>
                  <span className="ms-3 text-sm font-medium text-owl-text-secondary">
                    {accountPrioritySettings[account.id] ?? true ? 'Etkin' : 'Devre Dışı'}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 bg-owl-info/10 border border-owl-info/30 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-owl-info flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-owl-text-secondary">
                <strong className="text-owl-text">İpucu:</strong> Öncelikli çekme, okunmamış e-postaları her hesap için önce getirir ve birleşik gelen kutusunda en üstte gösterir. Bu özellik devre dışı bırakılırsa, e-postalar standart sıralama ile (en yeni önce) gösterilir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAccountAdded={(account) => {
          onAccountsChange([...accounts, account]);
          setShowAddModal(false);
        }}
      />

      {/* Edit Account Modal */}
      {editingAccount && (
        <AddAccountModal
          isOpen={true}
          onClose={() => setEditingAccount(null)}
          editAccount={editingAccount}
          onAccountAdded={(account) => {
            onAccountsChange(
              accounts.map((a) => (a.id === account.id ? account : a))
            );
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}

export default AccountSettings;
