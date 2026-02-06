// ============================================================================
// Owlivion Mail - Settings Page
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useShortcut } from '../hooks/useKeyboardShortcuts';
import { AccountSettings } from '../components/settings/AccountSettings';
import { GeneralSettings } from '../components/settings/GeneralSettings';
import { AISettings } from '../components/settings/AISettings';
import { ShortcutsSettings } from '../components/settings/ShortcutsSettings';
import { SignatureSettings } from '../components/settings/SignatureSettings';
import { SyncSettings } from '../components/settings/SyncSettings';
import { FilterSettings } from '../components/settings/FilterSettings';
import { ActiveSessions } from '../components/settings/ActiveSessions';
import { AuditLogViewer } from '../components/settings/AuditLogViewer';
import { AuditStatsComponent } from '../components/settings/AuditStats';
import TemplateSettings from '../components/settings/TemplateSettings';
import { listAccounts } from '../services/mailService';
import type { SettingsTab, Settings as SettingsType, Account } from '../types';

interface SettingsProps {
  onBack: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'accounts',
    label: 'Hesaplar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: 'general',
    label: 'Genel',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'ai',
    label: 'Yapay Zeka',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'shortcuts',
    label: 'Kısayollar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    id: 'signatures',
    label: 'İmzalar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    id: 'sync',
    label: 'Senkronizasyon',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
  },
  {
    id: 'filters',
    label: 'Filtreler',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
  },
  {
    id: 'templates',
    label: 'Şablonlar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Güvenlik',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

// Default settings
const defaultSettings: SettingsType = {
  // Appearance
  theme: 'dark',
  language: 'tr',
  compactListView: false,
  showAvatars: true,
  conversationView: true,

  // Notifications
  notificationsEnabled: true,
  notificationSound: true,
  notificationSoundType: 'call',
  notificationBadge: true,

  // Behavior
  autoMarkRead: true,
  autoMarkReadDelay: 2,
  confirmDelete: true,
  confirmSend: false,
  signaturePosition: 'bottom',
  replyPosition: 'top',
  closeToTray: true,

  // Auto-Sync
  autoSyncEnabled: true,
  autoSyncInterval: 5,

  // AI
  geminiApiKey: '',
  aiAutoSummarize: true,
  aiReplyTone: 'professional',

  // Shortcuts
  keyboardShortcutsEnabled: true,
};

export function Settings({ onBack }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);

  // Load accounts from database
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const dbAccounts = await listAccounts();
        if (dbAccounts && dbAccounts.length > 0) {
          const frontendAccounts: Account[] = dbAccounts.map((acc: any) => ({
            id: acc.id,
            email: acc.email,
            displayName: acc.display_name || acc.displayName || acc.email,
            imapHost: acc.imap_host || acc.imapHost,
            imapPort: acc.imap_port || acc.imapPort,
            imapSecurity: acc.imap_security || acc.imapSecurity,
            smtpHost: acc.smtp_host || acc.smtpHost,
            smtpPort: acc.smtp_port || acc.smtpPort,
            smtpSecurity: acc.smtp_security || acc.smtpSecurity,
            isActive: acc.is_active ?? true,
            isDefault: acc.is_default ?? true,
            signature: acc.signature || '',
            syncDays: acc.sync_days || 30,
            createdAt: acc.created_at || new Date().toISOString(),
            updatedAt: acc.updated_at || new Date().toISOString(),
          }));
          setAccounts(frontendAccounts);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };
    loadAccounts();
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('owlivion-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  // Handle settings change with auto-save to localStorage
  const handleSettingsChange = useCallback((newSettings: SettingsType) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('owlivion-settings', JSON.stringify(newSettings));
      console.log('Settings saved to localStorage');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, []);

  // Close on Escape
  useShortcut('Escape', onBack, { enabled: true });

  return (
    <div className="fixed inset-0 z-50 flex bg-owl-bg">
      {/* Sidebar */}
      <div className="w-64 bg-owl-surface border-r border-owl-border flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-owl-border">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-owl-text-secondary hover:text-owl-text rounded-lg hover:bg-owl-surface-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-owl-text">Ayarlar</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-owl-accent/10 text-owl-accent'
                  : 'text-owl-text-secondary hover:bg-owl-surface-2 hover:text-owl-text'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-owl-border">
          <p className="text-xs text-owl-text-secondary text-center">
            Owlivion Mail v0.1.0
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {activeTab === 'accounts' && (
            <AccountSettings
              accounts={accounts}
              onAccountsChange={setAccounts}
            />
          )}
          {activeTab === 'general' && (
            <GeneralSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}
          {activeTab === 'ai' && (
            <AISettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}
          {activeTab === 'shortcuts' && <ShortcutsSettings />}
          {activeTab === 'signatures' && (
            <SignatureSettings
              accounts={accounts}
              onAccountsChange={setAccounts}
            />
          )}
          {activeTab === 'sync' && <SyncSettings />}
          {activeTab === 'filters' && <FilterSettings accounts={accounts} />}
          {activeTab === 'templates' && <TemplateSettings accounts={accounts} />}
          {activeTab === 'security' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Güvenlik & Aktivite
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Hesap güvenliğinizi yönetin ve aktivitelerinizi takip edin
                </p>
              </div>

              <ActiveSessions />

              <hr className="border-gray-200 dark:border-gray-700" />

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Aktivite İstatistikleri
                </h3>
                <AuditStatsComponent />
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              <AuditLogViewer />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
