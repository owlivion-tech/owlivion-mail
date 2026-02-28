import { useState, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import type { MobileEmail } from './types';
import { useMobileNavigation } from '../../stores/mobileNavigationStore';
import { useTranslation } from '../../i18n';

interface MobileEmailListProps {
  emails: MobileEmail[];
  onSelect: (id: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleStar: (emailId: string) => void;
  onToggleRead?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
  onArchive?: (emailId: string) => void;
  activeFolder: string;
  showSearch?: boolean;
}

function formatDate(date: Date, lang: string, yesterdayLabel: string): string {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return yesterdayLabel;
  if (days < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Swipeable email row component
function SwipeableEmailRow({
  email,
  onSelect,
  onToggleRead,
  onDelete,
}: {
  email: MobileEmail;
  onSelect: (id: string) => void;
  onToggleStar: (emailId: string) => void;
  onToggleRead?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
  onArchive?: (emailId: string) => void;
}) {
  const { t, lang } = useTranslation();
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const { push } = useMobileNavigation();

  const SWIPE_THRESHOLD = 80;

  const bind = useGesture({
    onDrag: ({ movement: [mx], active }) => {
      if (!active) {
        // Released
        if (Math.abs(swipeX) > SWIPE_THRESHOLD) {
          if (swipeX > 0 && onToggleRead) {
            onToggleRead(email.id);
          } else if (swipeX < 0 && onDelete) {
            onDelete(email.id);
          }
        }
        setSwipeX(0);
        setSwiping(false);
        return;
      }
      setSwiping(true);
      // Clamp swipe distance
      const clamped = Math.max(-120, Math.min(120, mx));
      setSwipeX(clamped);
    },
  }, {
    drag: {
      axis: 'x',
      filterTaps: true,
      threshold: 10,
    },
  });

  const handleTap = () => {
    if (!swiping && Math.abs(swipeX) < 5) {
      onSelect(email.id);
      push({ type: 'emailDetail', emailId: email.id });
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Swipe background - left (read/unread) */}
      <div className="absolute inset-y-0 left-0 w-full flex items-center justify-start pl-4 bg-blue-600">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
        </svg>
        <span className="text-white text-xs ml-2 font-medium">
          {email.read ? t('mobile.markUnread') : t('mobile.markRead')}
        </span>
      </div>

      {/* Swipe background - right (delete) */}
      <div className="absolute inset-y-0 right-0 w-full flex items-center justify-end pr-4 bg-red-600">
        <span className="text-white text-xs mr-2 font-medium">{t('mobile.delete')}</span>
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>

      {/* Email row content */}
      <div
        ref={rowRef}
        {...bind()}
        onClick={handleTap}
        className={`relative flex items-start gap-3 px-4 py-3 bg-owl-surface border-b border-owl-border transition-colors active:bg-owl-bg ${
          !email.read ? 'bg-owl-accent/5' : ''
        }`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
      >
        {/* Avatar */}
        <div
          className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
            !email.read ? 'bg-owl-accent text-white' : 'bg-owl-bg text-owl-text-secondary'
          }`}
        >
          {getInitials(email.from.name || email.from.email)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${!email.read ? 'font-semibold text-owl-text' : 'text-owl-text-secondary'}`}>
              {email.from.name || email.from.email}
            </span>
            <span className="text-xs text-owl-text-secondary flex-shrink-0 whitespace-nowrap">
              {formatDate(email.date, lang, t('mobile.yesterday'))}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!email.read && (
              <div className="w-2 h-2 rounded-full bg-owl-accent flex-shrink-0" />
            )}
            <span className={`text-sm truncate ${!email.read ? 'font-medium text-owl-text' : 'text-owl-text-secondary'}`}>
              {email.subject || t('mobile.noSubject')}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-owl-text-secondary truncate flex-1">
              {email.preview}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {email.hasAttachments && (
                <svg className="w-3.5 h-3.5 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
              {email.starred && (
                <svg className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileEmailList({
  emails,
  onSelect,
  onSync,
  isSyncing,
  searchQuery,
  onSearchChange,
  onToggleStar,
  onToggleRead,
  onDelete,
  onArchive,
  activeFolder,
  showSearch,
}: MobileEmailListProps) {
  const { t } = useTranslation();
  const { toggleDrawer } = useMobileNavigation();
  const [pullDistance, setPullDistance] = useState(0);
  const [_isPulling, setIsPulling] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const PULL_THRESHOLD = 60;

  // Pull-to-refresh gesture
  const pullBind = useGesture({
    onDrag: ({ movement: [, my], direction: [, dy], active }) => {
      const scrollTop = listRef.current?.scrollTop || 0;
      if (scrollTop > 0) {
        setPullDistance(0);
        return;
      }
      if (!active) {
        if (pullDistance > PULL_THRESHOLD && !isSyncing) {
          onSync();
        }
        setPullDistance(0);
        setIsPulling(false);
        return;
      }
      if (my > 0 && dy > 0) {
        setIsPulling(true);
        setPullDistance(Math.min(100, my * 0.4));
      }
    },
  }, {
    drag: {
      axis: 'y',
      filterTaps: true,
    },
  });

  const folderDisplayName = activeFolder === 'INBOX' ? t('mobile.inbox') : activeFolder;

  return (
    <div className="flex flex-col h-full bg-owl-bg">
      {/* Header */}
      <div className="bg-owl-surface border-b border-owl-border safe-area-top" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Hamburger menu */}
          <button
            onClick={toggleDrawer}
            className="p-2 -ml-2 rounded-lg text-owl-text-secondary active:bg-owl-bg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold text-owl-text flex-1">{folderDisplayName}</h1>

          {/* Sync button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className={`p-2 rounded-lg transition-colors ${
              isSyncing ? 'text-owl-accent' : 'text-owl-text-secondary active:bg-owl-bg'
            }`}
          >
            <svg className={`w-5 h-5${isSyncing ? ' animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search bar (always visible on search tab, or toggleable) */}
        {(showSearch || searchQuery) && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-owl-bg rounded-lg">
              <svg className="w-5 h-5 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('mobile.searchPlaceholder')}
                className="flex-1 bg-transparent text-sm text-owl-text placeholder-owl-text-secondary outline-none"
              />
              {searchQuery && (
                <button onClick={() => onSearchChange('')} className="p-2.5 -mr-1">
                  <svg className="w-4 h-4 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden bg-owl-bg transition-all"
          style={{ height: pullDistance }}
        >
          <svg
            className={`w-6 h-6 text-owl-accent transition-transform ${pullDistance > PULL_THRESHOLD ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      )}

      {/* Email list */}
      <div
        ref={listRef}
        {...pullBind()}
        className="flex-1 overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
      >
        {isSyncing && emails.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <svg className="w-8 h-8 text-owl-accent animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-owl-text-secondary">{t('mobile.syncing')}</span>
            </div>
          </div>
        )}

        {!isSyncing && emails.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <svg className="w-12 h-12 text-owl-text-secondary mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm text-owl-text-secondary">
                {searchQuery ? t('mobile.noResults') : t('mobile.noEmails')}
              </p>
            </div>
          </div>
        )}

        {emails.map(email => (
          <SwipeableEmailRow
            key={`${email.accountId || ''}-${email.id}`}
            email={email}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
            onArchive={onArchive}
          />
        ))}
      </div>
    </div>
  );
}
