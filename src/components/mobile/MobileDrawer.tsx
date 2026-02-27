import React, { useEffect, useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import type { Account, ImapFolder } from '../../types';
import { useMobileNavigation } from '../../stores/mobileNavigationStore';
import owlivionIcon from '../../assets/owlivion-logo.svg';

interface MobileDrawerProps {
  accounts: Account[];
  selectedAccountId: number | null | 'all';
  onAccountChange: (id: number | 'all') => void;
  imapFolders: ImapFolder[];
  activeFolder: string;
  onFolderChange: (path: string) => void;
  onSettingsClick: () => void;
  onFiltersClick: () => void;
}

const folderIcons: Record<string, React.ReactNode> = {
  INBOX: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
  Sent: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Drafts: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Trash: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Spam: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Archive: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  Starred: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
};

function getFolderIcon(folderType: string) {
  return folderIcons[folderType] || <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
}

export function MobileDrawer({
  accounts,
  selectedAccountId,
  onAccountChange,
  imapFolders,
  activeFolder,
  onFolderChange,
  onSettingsClick,
  onFiltersClick,
}: MobileDrawerProps) {
  const { drawerOpen, setDrawerOpen } = useMobileNavigation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);

  // Swipe-to-close gesture
  const bind = useGesture({
    onDrag: ({ movement: [mx], cancel }) => {
      if (mx > 0) { cancel(); return; } // Only allow left swipe
      setDragX(mx);
    },
    onDragEnd: ({ movement: [mx], velocity: [vx] }) => {
      if (mx < -80 || vx < -0.5) {
        setDrawerOpen(false);
      }
      setDragX(0);
    },
  }, { drag: { axis: 'x', filterTaps: true } });

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerOpen, setDrawerOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Reset drag on close
  useEffect(() => {
    if (!drawerOpen) setDragX(0);
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const translateX = Math.min(0, dragX);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ opacity: 1 + translateX / 300 }}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        {...bind()}
        className="relative w-[300px] max-w-[85vw] h-full bg-owl-surface flex flex-col animate-slide-in-left touch-pan-y"
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {/* Header */}
        <div className="p-4 border-b border-owl-border">
          <div className="flex items-center gap-2 mb-3">
            <img src={owlivionIcon} alt="Owlivion" className="h-6 w-auto" />
            <span className="font-semibold text-owl-text">
              Owlivion <span className="text-owl-accent">Mail</span>
            </span>
          </div>

          {/* Account selector */}
          {accounts.length > 1 && (
            <div className="space-y-1">
              <button
                onClick={() => { onAccountChange('all'); setDrawerOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedAccountId === 'all' ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary hover:bg-owl-bg'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Tum Hesaplar
              </button>
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { onAccountChange(acc.id); setDrawerOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedAccountId === acc.id ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary hover:bg-owl-bg'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-owl-accent/20 flex items-center justify-center text-xs font-bold text-owl-accent">
                    {acc.displayName?.charAt(0) || acc.email.charAt(0)}
                  </div>
                  <span className="truncate">{acc.displayName || acc.email}</span>
                </button>
              ))}
            </div>
          )}
          {accounts.length === 1 && selectedAccount && (
            <div className="flex items-center gap-2 px-2 text-sm text-owl-text-secondary">
              <div className="w-8 h-8 rounded-full bg-owl-accent/20 flex items-center justify-center text-xs font-bold text-owl-accent">
                {selectedAccount.displayName?.charAt(0) || selectedAccount.email.charAt(0)}
              </div>
              <span className="truncate">{selectedAccount.email}</span>
            </div>
          )}
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto py-2">
          {imapFolders.map(folder => (
            <button
              key={folder.path}
              onClick={() => { onFolderChange(folder.path); setDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                activeFolder === folder.path
                  ? 'bg-owl-accent/10 text-owl-accent border-r-2 border-owl-accent'
                  : 'text-owl-text hover:bg-owl-bg'
              }`}
            >
              <span className={activeFolder === folder.path ? 'text-owl-accent' : 'text-owl-text-secondary'}>
                {getFolderIcon(folder.folder_type)}
              </span>
              <span className="flex-1 text-left">{folder.name}</span>
              {folder.unread_count > 0 && (
                <span className="text-xs font-bold bg-owl-accent/20 text-owl-accent px-2.5 py-0.5 rounded-full">
                  {folder.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-owl-border p-2 space-y-1">
          <button
            onClick={() => { onFiltersClick(); setDrawerOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-owl-text-secondary hover:bg-owl-bg rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtreler
          </button>
          <button
            onClick={() => { onSettingsClick(); setDrawerOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-owl-text-secondary hover:bg-owl-bg rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ayarlar
          </button>
        </div>
      </div>
    </div>
  );
}
