// ============================================================================
// Owlivion Mail - Settings Page
// ============================================================================

import { useState } from 'react';
import { useShortcut } from '../hooks/useKeyboardShortcuts';
import { AccountSettings } from '../components/settings/AccountSettings';
import { GeneralSettings } from '../components/settings/GeneralSettings';
import { AISettings } from '../components/settings/AISettings';
import { ShortcutsSettings } from '../components/settings/ShortcutsSettings';
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
  notificationBadge: true,

  // Behavior
  autoMarkRead: true,
  autoMarkReadDelay: 2,
  confirmDelete: true,
  confirmSend: false,
  signaturePosition: 'bottom',
  replyPosition: 'top',

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
              onSettingsChange={setSettings}
            />
          )}
          {activeTab === 'ai' && (
            <AISettings
              settings={settings}
              onSettingsChange={setSettings}
            />
          )}
          {activeTab === 'shortcuts' && <ShortcutsSettings />}
        </div>
      </div>
    </div>
  );
}
