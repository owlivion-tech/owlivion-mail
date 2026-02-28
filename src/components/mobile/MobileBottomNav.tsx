import React from 'react';
import { useMobileNavigation, type MobileTab } from '../../stores/mobileNavigationStore';
import { useTranslation } from '../../i18n';

interface TabDef { id: MobileTab; labelKey: string; icon: React.ReactNode }

const tabDefs: TabDef[] = [
  {
    id: 'inbox',
    labelKey: 'mobile.inbox',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
  },
  {
    id: 'search',
    labelKey: 'mobile.search',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'compose',
    labelKey: 'mobile.compose',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    labelKey: 'mobile.settings',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface MobileBottomNavProps {
  onComposeClick: () => void;
  onSettingsClick: () => void;
  unreadCount?: number;
}

export function MobileBottomNav({ onComposeClick, onSettingsClick, unreadCount }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useMobileNavigation();

  // Hide bottom nav when keyboard is visible
  const layoutEl = document.querySelector('.mobile-layout');
  const keyboardVisible = layoutEl?.getAttribute('data-keyboard-visible') === 'true';
  if (keyboardVisible) return null;

  const handleTabPress = (tabId: MobileTab) => {
    if (tabId === 'compose') {
      onComposeClick();
      return;
    }
    if (tabId === 'settings') {
      onSettingsClick();
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <nav className="flex items-center justify-around bg-owl-surface border-t border-owl-border safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabDefs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabPress(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors relative ${
              isActive ? 'text-owl-accent' : 'text-owl-text-secondary'
            }`}
          >
            <div className="relative">
              {tab.icon}
              {tab.id === 'inbox' && unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs mt-0.5 font-medium">{t(tab.labelKey)}</span>
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-owl-accent rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
