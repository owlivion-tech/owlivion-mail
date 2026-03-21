import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./App.css";
import owlivionIcon from "./assets/owlivion-logo.svg";
import { Settings } from "./pages/Settings";
import { Filters } from "./pages/Filters";
import { AIReplyModal } from "./components/AIReplyModal";
import { Compose } from "./components/Compose";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { Welcome } from "./components/Welcome";
import { AddAccountModal } from "./components/settings/AddAccountModal";
import SearchFiltersComponent from "./components/SearchFilters";
import { EmailView } from "./components/EmailView";
import { ContextMenu, useContextMenu } from "./components/ContextMenu";
import { summarizeEmail, analyzePhishing, detectEmailTracking, type PhishingAnalysis, type TrackingAnalysis } from "./services/geminiService";
import { requestNotificationPermission, showNewEmailNotification, playNotificationSound } from "./services/notificationService";
import { listDrafts, getDraft, deleteDraft, saveDraft } from "./services/draftService";
import type { DraftEmail, EmailAddress, Account, ImapFolder, DraftListItem, SearchFilters, Settings as SettingsType } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { isMobile } from "./hooks/usePlatform";
import { MobileLayout } from "./layouts/MobileLayout";
import { MobileEmailList } from "./components/mobile/MobileEmailList";
import { MobileEmailView } from "./components/mobile/MobileEmailView";
import { MobileDrawer } from "./components/mobile/MobileDrawer";
import { MobileBottomNav } from "./components/mobile/MobileBottomNav";
import { useMobileNavigation } from "./stores/mobileNavigationStore";
import { LanguageProvider, useTranslation } from "./i18n";

// DOMPurify config & sanitizeEmailHtml moved to ./components/EmailView.tsx

// Simple Icon Components
const Icons = {
  Mail: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Inbox: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
  Send: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Star: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  StarFilled: () => <svg className="w-4 h-4 fill-yellow-500 text-yellow-500" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Archive: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  File: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Reply: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
  ReplyAll: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6M7 10h10a8 8 0 018 8v2M7 10l6 6m-6-6l6-6" /></svg>,
  Forward: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Paperclip: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  ChevronRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  Folder: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  Command: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z" /></svg>,
  Image: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  ShieldCheck: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Filter: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  MailOpen: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>,
  MailUnread: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /><circle cx="18" cy="5" r="3" fill="currentColor" /></svg>,
  Summarize: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Refresh: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

// Types
interface Email {
  id: string;
  from: { name: string; email: string };
  to: EmailAddress[];
  subject: string;
  preview: string;
  body: string;
  bodyHtml?: string;
  bodyText?: string;
  date: Date;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  hasImages: boolean;
  accountId?: string; // NEW: Account ID for unified inbox
  attachments?: Array<{
    index: number;
    filename: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
  }>;
  archived?: boolean;
  deleted?: boolean;
  isDraft?: boolean;
}


// Parse email ID - unified inbox uses "accountId-uid" format
function parseEmailId(id: string, selectedAccountId: number | null | 'all'): { accountId: string; uid: number } {
  if (selectedAccountId === 'all') {
    const dashIdx = id.indexOf('-');
    if (dashIdx > 0) {
      return { accountId: id.substring(0, dashIdx), uid: parseInt(id.substring(dashIdx + 1)) };
    }
  }
  return { accountId: selectedAccountId?.toString() || '', uid: parseInt(id) };
}

// Helper Functions
function formatDate(date: Date, t: (key: string) => string, lang: string): string {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return t('app.yesterday');
  if (days < 7) return date.toLocaleDateString(locale, { weekday: "short" });
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// Extract domain from email address
function getEmailDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
}

// Generate consistent color from email address (for account badges)
function getAccountColor(email: string): string {
  // Hash function for consistent color generation
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convert to HSL for better color distribution
  const hue = Math.abs(hash) % 360;
  const saturation = 65; // Medium saturation
  const lightness = 55; // Medium lightness

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Get company logo URL from domain
function getCompanyLogoUrl(email: string): string | null {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  // Special case: Owlivion domains - use our logo!
  if (domain === 'owlivion.com' || domain === 'owlcrypt.com') {
    return owlivionIcon; // Use the Owlivion logo imported at the top
  }

  // Skip personal email providers - show initials instead
  const personalDomains = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me', 'yandex.com', 'mail.ru'];
  if (personalDomains.includes(domain)) return null;

  // Use Google Favicon API (reliable and free)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// Account Badge Component (for unified inbox) - Gradient Style
function AccountBadge({
  accountEmail,
  accountName: _accountName,
  size = 'sm'
}: {
  accountEmail: string;
  accountName?: string;
  size?: 'xs' | 'sm';
}) {
  const color = getAccountColor(accountEmail);
  // Extract domain name: info@owlivion.com → "owlivion"
  const displayText = accountEmail.split('@')[1]?.split('.')[0] || accountEmail.split('@')[0];

  const sizeClasses = {
    xs: 'text-[10px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5'
  };

  // Generate lighter color for gradient
  const lighterColor = (() => {
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsl(${h}, ${s}%, ${Math.min(parseInt(l) + 15, 75)}%)`;
    }
    return color;
  })();

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold transition-all hover:scale-105 ${sizeClasses[size]}`}
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, ${lighterColor}25 100%)`,
        color: color,
        boxShadow: `0 1px 3px ${color}20, 0 0 0 1px ${color}15 inset`
      }}
    >
      {/* Dot indicator with subtle glow */}
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}60`
        }}
      />
      <span className="truncate max-w-[100px]">{displayText}</span>
    </span>
  );
}

// Company Avatar Component with logo fallback
function CompanyAvatar({ email, name, size = 'md', unread = false }: {
  email: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  unread?: boolean;
}) {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = getCompanyLogoUrl(email);
  const domain = getEmailDomain(email);
  const isOwlivionDomain = domain === 'owlivion.com' || domain === 'owlcrypt.com';

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center font-medium shrink-0`;

  // Show logo if available and not errored
  if (logoUrl && !logoError) {
    return (
      <div className={`${baseClasses} ${isOwlivionDomain ? 'bg-owl-accent/10 p-1.5' : 'bg-white p-1'} border border-owl-border`}>
        <img
          src={logoUrl}
          alt={name}
          className={`w-full h-full object-contain ${isOwlivionDomain ? '' : 'rounded-full'}`}
          onError={() => setLogoError(true)}
        />
      </div>
    );
  }

  // Fallback to initials
  return (
    <div className={`${baseClasses} ${unread ? "bg-owl-accent text-white" : "bg-owl-bg text-owl-text-secondary"}`}>
      {getInitials(name)}
    </div>
  );
}

// Helper to get icon for folder type
function getFolderIcon(folderType: string, name: string): React.ReactElement {
  const type = folderType.toLowerCase();
  const nameLower = name.toLowerCase();

  if (type === 'inbox' || nameLower === 'inbox') return <Icons.Inbox />;
  if (type === 'sent' || nameLower.includes('sent')) return <Icons.Send />;
  if (type === 'drafts' || nameLower.includes('draft')) return <Icons.File />;
  if (type === 'trash' || nameLower.includes('trash') || nameLower.includes('deleted')) return <Icons.Trash />;
  if (type === 'archive' || nameLower.includes('archive')) return <Icons.Archive />;
  if (type === 'spam' || type === 'junk' || nameLower.includes('spam') || nameLower.includes('junk')) return <Icons.ShieldCheck />;
  if (type === 'starred' || nameLower.includes('starred') || nameLower.includes('flagged')) return <Icons.Star />;
  return <Icons.Mail />; // Default folder icon
}

// Build folder tree from flat list
interface FolderTreeNode {
  folder: ImapFolder;
  children: FolderTreeNode[];
}

function buildFolderTree(folders: ImapFolder[]): FolderTreeNode[] {
  const tree: FolderTreeNode[] = [];
  const nodeMap = new Map<string, FolderTreeNode>();

  // Sort folders by path to ensure parents come before children
  const sortedFolders = [...folders].sort((a, b) => a.path.localeCompare(b.path));

  for (const folder of sortedFolders) {
    const node: FolderTreeNode = { folder, children: [] };
    nodeMap.set(folder.path, node);

    // Find parent by checking delimiter
    const delimiter = folder.delimiter || '/';
    const lastDelimiterIndex = folder.path.lastIndexOf(delimiter);

    if (lastDelimiterIndex > 0) {
      const parentPath = folder.path.substring(0, lastDelimiterIndex);
      const parentNode = nodeMap.get(parentPath);
      if (parentNode) {
        parentNode.children.push(node);
        continue;
      }
    }

    tree.push(node);
  }

  return tree;
}

// Folder Tree Item Component
function FolderTreeItem({
  node,
  level,
  activeFolder,
  onFolderChange,
}: {
  node: FolderTreeNode;
  level: number;
  activeFolder: string;
  onFolderChange: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(level === 0);
  const hasChildren = node.children.length > 0;
  const isActive = activeFolder === node.folder.path;

  return (
    <div>
      <button
        onClick={() => {
          if (node.folder.is_selectable) {
            onFolderChange(node.folder.path);
          }
          if (hasChildren) {
            setExpanded(!expanded);
          }
        }}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
          isActive
            ? "bg-owl-accent/20 text-owl-accent"
            : "text-owl-text-secondary hover:bg-owl-bg hover:text-owl-text"
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {hasChildren && (
          <span className="w-4 h-4 flex items-center justify-center">
            {expanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        {getFolderIcon(node.folder.folder_type, node.folder.name)}
        <span className="flex-1 truncate text-left">{node.folder.name}</span>
        {node.folder.unread_count > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            isActive ? "bg-owl-accent text-white" : "bg-owl-bg"
          }`}>
            {node.folder.unread_count}
          </span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.folder.path}
              node={child}
              level={level + 1}
              activeFolder={activeFolder}
              onFolderChange={onFolderChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Mail Panel Component
function MailPanel({
  emails,
  selectedId,
  onSelect,
  activeFolder,
  onFolderChange,
  onSettingsClick,
  onComposeClick,
  onSyncClick,
  onOsintClick: _onOsintClick,
  isSyncing,
  searchQuery,
  onSearchChange,
  searchFilters,
  onSearchFiltersChange,
  onAdvancedSearch,
  accounts,
  selectedAccountId,
  onAccountChange,
  imapFolders,
  isLoadingFolders,
  onToggleStar,
  onDeleteDraft,
  drafts,
  isLoadingDrafts: _isLoadingDrafts,
  onFiltersClick,
  isSearching,
  searchResultsCount,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  onEmailContextMenu,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeFolder: string;
  onFolderChange: (path: string) => void;
  onSettingsClick: () => void;
  onFiltersClick: () => void;
  onComposeClick: () => void;
  onSyncClick: () => void;
  onOsintClick: () => void;
  isSyncing: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchFilters: SearchFilters;
  onSearchFiltersChange: (filters: SearchFilters) => void;
  onAdvancedSearch: () => void;
  isSearching?: boolean;
  searchResultsCount?: number;
  accounts: Account[];
  selectedAccountId: number | null | 'all';
  onAccountChange: (id: number | 'all') => void;
  imapFolders: ImapFolder[];
  isLoadingFolders: boolean;
  onToggleStar: (emailId: string) => void;
  onDeleteDraft?: (draftId: number) => void;
  drafts: DraftListItem[];
  isLoadingDrafts: boolean;
  sortBy: 'date' | 'account' | 'unread' | 'priority';
  onSortByChange: (sort: 'date' | 'account' | 'unread' | 'priority') => void;
  sortDirection: 'asc' | 'desc';
  onSortDirectionChange: (dir: 'asc' | 'desc') => void;
  onEmailContextMenu?: (e: React.MouseEvent, email: Email) => void;
}) {
  const { t, lang } = useTranslation();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu on outside click
  useEffect(() => {
    if (!sortMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortMenuOpen]);

  const selectedAccount = typeof selectedAccountId === 'number' ? accounts.find(a => a.id === selectedAccountId) : undefined;

  // Build folder tree
  const folderTree = useMemo(() => buildFolderTree(imapFolders), [imapFolders]);

  // Get main folders (INBOX, Draft, Sent, Trash) for quick access tabs
  const mainFolders = useMemo(() => {
    const folders: { [key: string]: { path: string; name: string; type: string; icon: React.ReactElement; count: number } } = {};

    for (const folder of imapFolders) {
      const type = folder.folder_type.toLowerCase();
      const nameLower = folder.name.toLowerCase();

      if ((type === 'inbox' || nameLower === 'inbox') && !folders.inbox) {
        folders.inbox = { path: folder.path, name: 'INBOX', type: 'inbox', icon: <Icons.Inbox />, count: folder.unread_count };
      } else if ((type === 'drafts' || nameLower.includes('draft')) && !folders.drafts) {
        folders.drafts = { path: folder.path, name: 'Draft', type: 'drafts', icon: <Icons.File />, count: folder.total_count };
      } else if ((type === 'sent' || nameLower.includes('sent')) && !folders.sent) {
        folders.sent = { path: folder.path, name: 'Sent', type: 'sent', icon: <Icons.Send />, count: 0 };
      } else if ((type === 'trash' || nameLower.includes('trash') || nameLower.includes('deleted')) && !folders.trash) {
        folders.trash = { path: folder.path, name: 'Trash', type: 'trash', icon: <Icons.Trash />, count: 0 };
      }
    }

    // Return in order: INBOX, Draft, Sent, Trash
    const ordered = [];
    if (folders.inbox) ordered.push(folders.inbox);
    if (folders.drafts) ordered.push(folders.drafts);
    if (folders.sent) ordered.push(folders.sent);
    if (folders.trash) ordered.push(folders.trash);

    // If no IMAP folders, show default static folders
    if (ordered.length === 0) {
      return [
        { path: 'INBOX', name: 'INBOX', type: 'inbox', icon: <Icons.Inbox />, count: emails.filter(e => !e.read).length },
        { path: 'Drafts', name: 'Draft', type: 'drafts', icon: <Icons.File />, count: 0 },
        { path: 'Sent', name: 'Sent', type: 'sent', icon: <Icons.Send />, count: 0 },
        { path: 'Trash', name: 'Trash', type: 'trash', icon: <Icons.Trash />, count: 0 },
      ];
    }

    return ordered;
  }, [imapFolders, emails]);

  // Static starred folder (filtered locally)
  const starredFolder = { path: '__starred__', name: 'Starred', type: 'starred', icon: <Icons.Star />, count: emails.filter(e => e.starred).length };

  // Get active folder name for display
  const activeFolderName = useMemo(() => {
    if (activeFolder === '__starred__') return 'Starred';
    const folder = imapFolders.find(f => f.path === activeFolder);
    return folder?.name || 'Inbox';
  }, [activeFolder, imapFolders]);

  // Check if current folder is drafts
  const isDraftsFolder = useMemo(() => {
    return imapFolders.find(f => f.path === activeFolder)?.folder_type.toLowerCase() === 'drafts' ||
           activeFolder.toLowerCase().includes('draft');
  }, [activeFolder, imapFolders]);

  // Filter emails based on folder
  const filteredEmails = useMemo(() => {
    // If we're in the Drafts folder, convert drafts to Email format
    if (isDraftsFolder) {
      let result = drafts.map((draft): Email => {
        const toAddresses = JSON.parse(draft.toAddresses || '[]') as EmailAddress[];
        const toPreview = toAddresses.length > 0 ? toAddresses[0].email : t('mailPanel.noRecipient');

        return {
          id: `draft-${draft.id}`,
          from: { name: t('mailPanel.draft'), email: '' },
          to: toAddresses,
          subject: draft.subject || t('mailPanel.noSubject'),
          preview: `${t('mailPanel.recipientPrefix')} ${toPreview}`,
          body: '',
          bodyHtml: '',
          bodyText: '',
          date: new Date(draft.updatedAt),
          read: true,
          starred: false,
          hasAttachments: false,
          hasImages: false,
          isDraft: true,
        };
      });

      // Search filter for drafts
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(e =>
          e.subject.toLowerCase().includes(query) ||
          e.preview.toLowerCase().includes(query)
        );
      }

      return result;
    }

    // Regular email filtering
    let result = emails;

    // Starred is a local filter
    if (activeFolder === '__starred__') {
      result = result.filter(e => e.starred && !e.deleted);
    } else {
      // For other folders, just filter out deleted (unless we're in trash)
      const isTrash = activeFolder.toLowerCase().includes('trash') || activeFolder.toLowerCase().includes('deleted');
      if (!isTrash) {
        result = result.filter(e => !e.deleted);
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.subject.toLowerCase().includes(query) ||
        e.from.name.toLowerCase().includes(query) ||
        e.from.email.toLowerCase().includes(query) ||
        e.body.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const dir = sortDirection === 'desc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date':
          cmp = b.date.getTime() - a.date.getTime();
          break;
        case 'unread':
          if (a.read !== b.read) { cmp = a.read ? 1 : -1; break; }
          cmp = b.date.getTime() - a.date.getTime();
          break;
        case 'account':
          if (a.accountId !== b.accountId) { cmp = (a.accountId || '').localeCompare(b.accountId || ''); break; }
          cmp = b.date.getTime() - a.date.getTime();
          break;
        case 'priority':
        default:
          if (a.read !== b.read) { cmp = a.read ? 1 : -1; break; }
          if (a.starred !== b.starred) { cmp = a.starred ? -1 : 1; break; }
          cmp = b.date.getTime() - a.date.getTime();
          break;
      }
      return cmp * dir;
    });

    return result;
  }, [emails, activeFolder, searchQuery, isDraftsFolder, drafts, sortBy, sortDirection]);

  return (
    <div className="w-[380px] bg-owl-surface border-r border-owl-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-owl-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src={owlivionIcon} alt="Owlivion" className="h-6 w-auto object-contain" />
            <span className="font-semibold text-owl-text text-base">Owlivion <span className="text-owl-accent">Mail</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSyncClick}
              disabled={isSyncing}
              className={`p-2 rounded-lg transition-colors ${isSyncing ? 'text-owl-accent animate-spin' : 'text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2'}`}
              title={t('sidebar.sync')}
            >
              <Icons.Refresh />
            </button>
            <button
              onClick={onComposeClick}
              className="flex items-center gap-1.5 bg-owl-accent hover:bg-owl-accent-hover text-white py-1.5 px-3 rounded-lg transition-colors text-sm"
            >
              <Icons.Plus />
              <span>Compose</span>
              <kbd className="text-xs bg-white/20 px-1 rounded ml-1">C</kbd>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-owl-bg rounded-lg">
          <Icons.Search />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search emails..."
            className="flex-1 bg-transparent text-sm text-owl-text placeholder-owl-text-secondary focus:outline-none"
          />
          <kbd className="text-xs text-owl-text-secondary">/</kbd>
        </div>

        {/* Advanced Search Filters */}
        <SearchFiltersComponent
          filters={searchFilters}
          onChange={onSearchFiltersChange}
          onSearch={onAdvancedSearch}
          folders={imapFolders.map(f => ({
            id: 0,
            name: f.name,
            folderType: f.folder_type
          }))}
        />

        {/* Account Selector */}
        {accounts.length > 1 && (
          <div className="relative mt-3">
            <button
              onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-owl-bg rounded-lg text-sm text-owl-text hover:bg-owl-surface-2 transition-colors"
            >
              <div className="flex items-center gap-2">
                {selectedAccountId === 'all' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-owl-accent/20 flex items-center justify-center text-xs text-owl-accent">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <span className="truncate font-medium">{t('app.allAccounts')}</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-owl-accent/20 flex items-center justify-center text-xs text-owl-accent font-medium">
                      {selectedAccount?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="truncate">{selectedAccount?.email || t('app.selectAccount')}</span>
                  </>
                )}
              </div>
              <svg className={`w-4 h-4 text-owl-text-secondary transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {accountDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-owl-surface border border-owl-border rounded-lg shadow-lg z-50 overflow-hidden">
                {/* All Accounts Option */}
                {accounts.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        onAccountChange('all');
                        setAccountDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        selectedAccountId === 'all'
                          ? 'bg-owl-accent/10 text-owl-accent'
                          : 'text-owl-text hover:bg-owl-bg'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        selectedAccountId === 'all'
                          ? 'bg-owl-accent/20 text-owl-accent'
                          : 'bg-owl-surface-2 text-owl-text-secondary'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{t('app.allAccounts')}</div>
                        <div className="text-xs text-owl-text-secondary">{accounts.length} {t('app.accountsUnifiedView')}</div>
                      </div>
                      {selectedAccountId === 'all' && (
                        <svg className="w-4 h-4 text-owl-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="border-t border-owl-border my-1"></div>
                  </>
                )}

                {/* Individual Accounts */}
                {accounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => {
                      onAccountChange(account.id);
                      setAccountDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      account.id === selectedAccountId
                        ? 'bg-owl-accent/10 text-owl-accent'
                        : 'text-owl-text hover:bg-owl-bg'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      account.id === selectedAccountId
                        ? 'bg-owl-accent/20 text-owl-accent'
                        : 'bg-owl-surface-2 text-owl-text-secondary'
                    }`}>
                      {account.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 truncate">
                      <div className="font-medium">{account.displayName || account.email}</div>
                      <div className="text-xs text-owl-text-secondary">{account.email}</div>
                    </div>
                    {account.id === selectedAccountId && (
                      <svg className="w-4 h-4 text-owl-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Folder Tabs — compact icon-first design */}
      <div className="px-3 py-2 border-b border-owl-border">
        <div className="flex items-center gap-0.5">
          {/* Main folders */}
          {mainFolders.slice(0, 4).map((folder) => {
            const isActive = activeFolder === folder.path;
            return (
              <button
                key={folder.path}
                onClick={() => onFolderChange(folder.path)}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[13px] ${
                  isActive
                    ? "bg-owl-accent/15 text-owl-accent font-medium"
                    : "text-owl-text-secondary hover:bg-owl-bg hover:text-owl-text"
                }`}
                title={folder.name}
              >
                {folder.icon}
                {isActive && <span>{folder.name}</span>}
                {folder.count > 0 && (
                  <span className={`text-[10px] min-w-[18px] text-center px-1 py-px rounded-full leading-tight ${
                    isActive ? "bg-owl-accent text-white" : "bg-owl-bg text-owl-text-secondary"
                  }`}>
                    {folder.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Starred */}
          {(() => {
            const isActive = activeFolder === '__starred__';
            return (
              <button
                onClick={() => onFolderChange('__starred__')}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[13px] ${
                  isActive
                    ? "bg-owl-accent/15 text-owl-accent font-medium"
                    : "text-owl-text-secondary hover:bg-owl-bg hover:text-owl-text"
                }`}
                title="Starred"
              >
                {starredFolder.icon}
                {isActive && <span>Starred</span>}
                {starredFolder.count > 0 && (
                  <span className={`text-[10px] min-w-[18px] text-center px-1 py-px rounded-full leading-tight ${
                    isActive ? "bg-owl-accent text-white" : "bg-owl-bg text-owl-text-secondary"
                  }`}>
                    {starredFolder.count}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Spacer */}
          <div className="flex-1" />

          {/* All Folders dropdown */}
          <button
            onClick={() => setShowAllFolders(!showAllFolders)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-[13px] ${
              showAllFolders ? "bg-owl-bg text-owl-text" : "text-owl-text-secondary hover:bg-owl-bg hover:text-owl-text"
            }`}
          >
            <Icons.Folder />
            {showAllFolders ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
          </button>
        </div>
      </div>

      {/* Expandable All Folders Panel */}
      {showAllFolders && (
        <div className="border-b border-owl-border bg-owl-bg/50 max-h-[300px] overflow-y-auto">
          {isLoadingFolders ? (
            <div className="flex items-center justify-center py-4 text-owl-text-secondary text-sm">
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('app.foldersLoading')}
            </div>
          ) : folderTree.length === 0 ? (
            <div className="text-center py-4 text-owl-text-secondary text-sm">
              {t('app.noFolders')}
            </div>
          ) : (
            <div className="py-2">
              {folderTree.map((node) => (
                <FolderTreeItem
                  key={node.folder.path}
                  node={node}
                  level={0}
                  activeFolder={activeFolder}
                  onFolderChange={(path) => {
                    onFolderChange(path);
                    setShowAllFolders(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-xs font-medium text-owl-text-secondary uppercase tracking-wider">
              {activeFolderName}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-owl-text-secondary">
                {isSearching ? (
                  'Searching...'
                ) : searchQuery && searchResultsCount !== undefined ? (
                  `${searchResultsCount} results`
                ) : (
                  `${filteredEmails.length} emails`
                )}
              </span>
              {/* Sort button */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setSortMenuOpen(!sortMenuOpen)}
                  className="p-1 rounded hover:bg-owl-bg text-owl-text-secondary hover:text-owl-text transition-colors"
                  title={t('mailPanel.sort')}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 4h10M4 7h6M6 10h2" />
                  </svg>
                </button>
                {sortMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-owl-surface border border-owl-border rounded-lg shadow-xl z-50 py-1">
                    {([
                      { value: 'priority', label: t('mailPanel.priority') },
                      { value: 'date', label: t('mailPanel.byDate') },
                      { value: 'unread', label: t('mailPanel.unreadFirst') },
                      { value: 'account', label: t('mailPanel.byAccount') },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { onSortByChange(opt.value); setSortMenuOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          sortBy === opt.value
                            ? 'text-owl-accent bg-owl-accent/10'
                            : 'text-owl-text hover:bg-owl-bg'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="border-t border-owl-border my-1" />
                    <button
                      onClick={() => { onSortDirectionChange(sortDirection === 'desc' ? 'asc' : 'desc'); setSortMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-owl-text hover:bg-owl-bg transition-colors flex items-center justify-between"
                    >
                      <span>{sortDirection === 'desc' ? t('mailPanel.newestFirst') : t('mailPanel.oldestFirst')}</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        {sortDirection === 'desc' ? (
                          <path d="M6 2v8M3 7l3 3 3-3" />
                        ) : (
                          <path d="M6 10V2M3 5l3-3 3 3" />
                        )}
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {filteredEmails.map((email) => (
            <button
              key={email.accountId ? `${email.accountId}-${email.id}` : email.id}
              onClick={() => onSelect(email.id)}
              onContextMenu={onEmailContextMenu ? (e) => onEmailContextMenu(e, email) : undefined}
              className={`w-full text-left p-3 rounded-lg transition-all mb-1 ${
                selectedId === email.id
                  ? "bg-owl-accent/20 border border-owl-accent/50"
                  : "hover:bg-owl-bg border border-transparent"
              } ${!email.read ? "bg-owl-bg/50" : ""}`}
            >
              <div className="flex items-start gap-3">
                <CompanyAvatar
                  email={email.from.email}
                  name={email.from.name}
                  size="md"
                  unread={!email.read}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-sm truncate ${!email.read ? "font-semibold text-owl-text" : "text-owl-text"}`}>
                        {email.from.name}
                      </span>
                      {/* Only show badge in unified inbox mode */}
                      {(() => {
                        const isUnifiedMode = selectedAccountId === 'all';
                        if (!isUnifiedMode) return null;

                        if (!email.accountId) return null;

                        const account = accounts.find(a => a.id.toString() === email.accountId || a.id === parseInt(email.accountId || '0'));
                        if (!account) return null;

                        return (
                          <AccountBadge
                            accountEmail={account.email}
                            accountName={account.displayName}
                            size="xs"
                          />
                        );
                      })()}
                    </div>
                    <span className="text-xs text-owl-text-secondary ml-2 shrink-0">{formatDate(email.date, t, lang)}</span>
                  </div>
                  <div className={`text-sm truncate mb-1 ${!email.read ? "font-medium text-owl-text" : "text-owl-text-secondary"}`}>
                    {email.subject}
                  </div>
                  <div className="text-xs text-owl-text-secondary truncate">{email.preview}</div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {email.isDraft ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const draftId = parseInt(email.id.replace('draft-', ''));
                        if (onDeleteDraft && window.confirm(t('mailPanel.confirmDeleteDraft'))) {
                          onDeleteDraft(draftId);
                        }
                      }}
                      className="p-1 rounded transition-colors cursor-pointer text-owl-text-secondary/50 hover:text-red-500"
                      title={t('mailPanel.deleteDraft')}
                    >
                      <Icons.Trash />
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(email.id);
                      }}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        email.starred
                          ? 'text-yellow-500 hover:text-yellow-400'
                          : 'text-owl-text-secondary/50 hover:text-yellow-500'
                      }`}
                      title={email.starred ? t('mailPanel.removeStar') : t('mailPanel.addStar')}
                    >
                      {email.starred ? <Icons.StarFilled /> : <Icons.Star />}
                    </div>
                  )}
                  {email.hasAttachments && <Icons.Paperclip />}
                </div>
              </div>
            </button>
          ))}
          {filteredEmails.length === 0 && (
            <div className="text-center py-8 text-owl-text-secondary">
              <Icons.Mail />
              <p className="mt-2">{t('app.noEmailsInFolder')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="p-3 border-t border-owl-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-owl-accent rounded-full flex items-center justify-center text-white text-sm font-medium">
            {selectedAccount?.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || selectedAccount?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-owl-text truncate">{selectedAccount?.displayName || t('app.selectAccount')}</div>
            <div className="text-xs text-owl-text-secondary truncate">{selectedAccount?.email || ''}</div>
          </div>
          <button
            onClick={onFiltersClick}
            className="p-2 hover:bg-owl-surface-2 text-owl-text-secondary hover:text-owl-text rounded-lg transition-colors"
            title={t('sidebar.filters')}
          >
            <Icons.Filter />
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2 hover:bg-owl-surface-2 text-owl-text-secondary hover:text-owl-text rounded-lg transition-colors"
            title={t('sidebar.settings')}
          >
            <Icons.Settings />
          </button>
        </div>
      </div>
    </div>
  );
}

// Command Palette
function CommandPalette({ isOpen, onClose, onCommand }: { isOpen: boolean; onClose: () => void; onCommand: (cmd: string) => void }) {
  const [query, setQuery] = useState("");
  const { t } = useTranslation();

  if (!isOpen) return null;

  const commands = [
    { id: "compose", name: t('commands.newEmail'), shortcut: "C", icon: <Icons.Plus /> },
    { id: "search", name: t('commands.searchCmd'), shortcut: "/", icon: <Icons.Search /> },
    { id: "reply", name: t('commands.replyCmd'), shortcut: "R", icon: <Icons.Reply /> },
    { id: "replyAll", name: t('commands.replyAllCmd'), shortcut: "A", icon: <Icons.ReplyAll /> },
    { id: "forward", name: t('commands.forwardCmd'), shortcut: "F", icon: <Icons.Forward /> },
    { id: "archive", name: t('commands.archiveCmd'), shortcut: "E", icon: <Icons.Archive /> },
    { id: "delete", name: t('commands.deleteCmd'), shortcut: "#", icon: <Icons.Trash /> },
    { id: "star", name: t('commands.starCmd'), shortcut: "S", icon: <Icons.Star /> },
    { id: "markUnread", name: t('commands.markUnreadCmd'), shortcut: "U", icon: <Icons.MailUnread /> },
    { id: "aiReply", name: t('commands.aiReplyCmd'), shortcut: "G", icon: <Icons.Sparkles /> },
    { id: "shortcuts", name: t('commands.shortcutsHelp'), shortcut: "?", icon: <Icons.Command /> },
  ];

  const filteredCommands = query
    ? commands.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : commands;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="w-[500px] bg-owl-surface rounded-xl shadow-2xl border border-owl-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-owl-border">
          <Icons.Command />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('app.searchCommand')}
            className="flex-1 ml-3 bg-transparent text-owl-text placeholder-owl-text-secondary focus:outline-none"
            autoFocus
          />
        </div>
        <div className="py-2 max-h-[300px] overflow-y-auto">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => { onCommand(cmd.id); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-owl-surface-2 transition-colors"
            >
              <span className="text-owl-text-secondary">{cmd.icon}</span>
              <span className="text-owl-text flex-1 text-left">{cmd.name}</span>
              <kbd className="px-2 py-1 text-xs bg-owl-bg rounded text-owl-text-secondary">{cmd.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main App
type Page = 'mail' | 'settings' | 'filters';
type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';

function App() {
  // Mobile navigation (hook must be before any conditional returns)
  const mobileNav = useMobileNavigation();
  const mobile = isMobile();
  const { t: _tApp, lang: appLang } = useTranslation();

  const contextMenu = useContextMenu();
  const [currentPage, setCurrentPage] = useState<Page>('mail');
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [emails, setEmails] = useState<Email[]>([]);  // Start empty - no mock data
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Search state (FTS5 backend + Advanced Filters)
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [, setSearchTime] = useState<number>(0); // Track search performance

  // Unified Inbox state
  const [sortBy, setSortBy] = useState<'date' | 'account' | 'unread' | 'priority'>('date'); // DEFAULT: date (newest first)
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc'); // DEFAULT: newest/unread first
  const [accountFetchStatuses, setAccountFetchStatuses] = useState<any[]>([]); // Track account fetch status for error display

  // Log account fetch errors (TODO: Add UI banner for failed accounts)
  useEffect(() => {
    const failedAccounts = accountFetchStatuses.filter(s => !s.success);
    if (failedAccounts.length > 0) {
      console.warn('[Multi-Account] Some accounts failed to fetch:', failedAccounts);
    }
  }, [accountFetchStatuses]);

  // Account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null | 'all'>(null);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // IMAP Folders state
  const [imapFolders, setImapFolders] = useState<ImapFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Drafts state
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);

  // Notification state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const knownEmailIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Email cache: per account+folder (key = "accountId:folderPath")
  const emailCache = useRef<Map<string, Email[]>>(new Map());
  const cacheKey = (accountId: number | string, folder: string) => `${accountId}:${folder}`;

  // Settings state for API keys and auto-sync
  const [geminiApiKey, setGeminiApiKey] = useState<string | undefined>(undefined);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(5); // minutes
  const [autoPhishingDetection, setAutoPhishingDetection] = useState(true);
  const [autoMarkReadDelay, setAutoMarkReadDelay] = useState(2); // seconds
  const [appSettings, setAppSettings] = useState<SettingsType>(DEFAULT_SETTINGS);

  // Load settings from localStorage
  const loadSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('owlivion-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setGeminiApiKey(settings.geminiApiKey);
        setAutoSyncEnabled(settings.autoSyncEnabled ?? false);
        setAutoSyncInterval(settings.autoSyncInterval ?? 5);
        setAutoPhishingDetection(settings.autoPhishingDetection ?? true);
        setAutoMarkReadDelay(settings.autoMarkReadDelay ?? 2);
        setAppSettings({ ...DEFAULT_SETTINGS, ...settings });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  // Load on mount + listen for storage changes (from Settings page)
  useEffect(() => {
    loadSettings();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'owlivion-settings') loadSettings();
    };
    // Custom event for same-tab changes
    const handleSettingsUpdate = () => loadSettings();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('owlivion-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('owlivion-settings-updated', handleSettingsUpdate);
    };
  }, [loadSettings]);

  // Fetch folders for an account
  const fetchFolders = useCallback(async (accountId: number) => {
    setIsLoadingFolders(true);
    try {
      const { listFolders } = await import('./services/mailService');
      const folders = await listFolders(accountId.toString());
      console.log('Fetched IMAP folders:', folders);
      setImapFolders(folders);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      setImapFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // Search handler (backend FTS5)
  const handleSearch = useCallback(async (query: string, accountId: number) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const { searchEmails } = await import('./services/mailService');
      const results = await searchEmails(accountId.toString(), query, activeFolder);

      // Convert EmailSummary[] to Email[] format
      const mappedResults: Email[] = results.map(result => ({
        id: result.uid.toString(),
        from: {
          name: result.fromName || result.fromAddress,
          email: result.fromAddress,
        },
        to: [],
        subject: result.subject,
        preview: result.preview,
        body: result.preview,
        date: new Date(result.date),
        read: result.isRead,
        starred: result.isStarred,
        hasAttachments: result.hasAttachments,
        hasImages: result.hasInlineImages,
      }));

      setSearchResults(mappedResults);
      console.log(`FTS5 search returned ${mappedResults.length} results`);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [activeFolder]);

  // Advanced search handler with filters
  const handleAdvancedSearch = useCallback(async () => {
    if (!selectedAccountId) return;

    // Check if there are any filters (query or other filters)
    const hasFilters = searchFilters.query?.trim() ||
                      Object.keys(searchFilters).some(key =>
                        key !== 'query' && searchFilters[key as keyof SearchFilters] !== undefined
                      );

    if (!hasFilters) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const { searchEmailsAdvanced } = await import('./services/mailService');
      const result = await searchEmailsAdvanced(
        selectedAccountId.toString(),
        searchFilters,
        100,
        0
      );

      // Convert EmailSummary[] to Email[] format
      const mappedResults: Email[] = result.emails.map(email => ({
        id: email.uid.toString(),
        from: {
          name: email.fromName || email.fromAddress,
          email: email.fromAddress,
        },
        to: [],
        subject: email.subject,
        preview: email.preview,
        body: email.preview,
        date: new Date(email.date),
        read: email.isRead,
        starred: email.isStarred,
        hasAttachments: email.hasAttachments,
        hasImages: email.hasInlineImages,
      }));

      setSearchResults(mappedResults);
      setSearchTime(result.searchTime);
      console.log(`Advanced search returned ${mappedResults.length} results (${result.searchTime}ms)`);
    } catch (error) {
      console.error('Advanced search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedAccountId, searchFilters]);

  // Debounced search (wait 300ms after user stops typing)
  const debouncedSearch = useMemo(() => {
    let timeoutId: number | undefined;
    return (query: string, accountId: number) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        handleSearch(query, accountId);
      }, 300);
    };
  }, [handleSearch]);

  // Function to reload accounts from database (used after settings changes)
  const mapAccount = (acc: any): Account => ({
    id: acc.id,
    email: acc.email,
    displayName: acc.displayName || acc.display_name || acc.email,
    imapHost: acc.imapHost || acc.imap_host,
    imapPort: acc.imapPort || acc.imap_port,
    imapSecurity: acc.imapSecurity || acc.imap_security,
    imapUsername: acc.imapUsername || acc.imap_username,
    smtpHost: acc.smtpHost || acc.smtp_host,
    smtpPort: acc.smtpPort || acc.smtp_port,
    smtpSecurity: acc.smtpSecurity || acc.smtp_security,
    smtpUsername: acc.smtpUsername || acc.smtp_username,
    oauthProvider: acc.oauthProvider || acc.oauth_provider,
    isActive: acc.isActive ?? acc.is_active ?? true,
    isDefault: acc.isDefault ?? acc.is_default ?? true,
    signature: acc.signature || '',
    syncDays: acc.syncDays || acc.sync_days || 30,
    acceptInvalidCerts: acc.acceptInvalidCerts ?? acc.accept_invalid_certs ?? false,
    createdAt: acc.createdAt || acc.created_at || new Date().toISOString(),
    updatedAt: acc.updatedAt || acc.updated_at || new Date().toISOString(),
  });

  const reloadAccounts = useCallback(async () => {
    try {
      const { listAccounts } = await import('./services/mailService');
      const dbAccounts = await listAccounts();
      if (dbAccounts && dbAccounts.length > 0) {
        const frontendAccounts: Account[] = dbAccounts.map(mapAccount);
        setAccounts(frontendAccounts);
        console.log('Accounts reloaded from DB');
      }
    } catch (err) {
      console.error('Failed to reload accounts:', err);
    }
  }, []);

  // Load accounts from database on startup
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { listAccounts, connectAccount, listEmails, listFolders } = await import('./services/mailService');
        const dbAccounts = await listAccounts();
        console.log('Loaded accounts from DB:', dbAccounts);

        if (dbAccounts && dbAccounts.length > 0) {
          // Convert database accounts to frontend Account type
          const frontendAccounts: Account[] = dbAccounts.map(mapAccount);

          setAccounts(frontendAccounts);

          // Set selected account to the default one or first one
          const defaultAccount = frontendAccounts.find(a => a.isDefault) || frontendAccounts[0];
          setSelectedAccountId(defaultAccount.id);

          // Connect to first account and load emails
          const firstAccount = defaultAccount;
          try {
            await connectAccount(firstAccount.id.toString());
            console.log('Connected to account:', firstAccount.email);

            // Fetch IMAP folders
            try {
              const folders = await listFolders(firstAccount.id.toString());
              console.log('Fetched IMAP folders:', folders);
              setImapFolders(folders);
            } catch (folderErr) {
              console.error('Failed to fetch folders:', folderErr);
            }

            // Load emails (page is 0-indexed)
            try {
              const result = await listEmails(firstAccount.id.toString(), 0, 500, 'INBOX');
              console.log('listEmails result:', result);
              console.log('Result keys:', result ? Object.keys(result) : 'null');

              if (result && result.emails && result.emails.length > 0) {
                console.log('Raw emails from backend, count:', result.emails.length);
                console.log('First email keys:', Object.keys(result.emails[0]));
                console.log('First email:', JSON.stringify(result.emails[0], null, 2));

                const loadedEmails: Email[] = result.emails.map((e: any, idx: number) => {
                  const emailId = e.uid?.toString() || e.id?.toString() || idx.toString();
                  // Track known emails on initial load
                  knownEmailIds.current.add(emailId);
                  console.log(`Mapping email ${idx}: uid=${e.uid}, subject=${e.subject}`);
                  return {
                    id: emailId,
                    from: { name: e.fromName || e.from || '', email: e.from || '' },
                    to: [{ name: '', email: '' }],
                    subject: e.subject || '(Konu yok)',
                    preview: e.preview || '',
                    body: e.bodyText || e.preview || '',
                    bodyHtml: e.bodyHtml,
                    bodyText: e.bodyText,
                    date: new Date(e.date || Date.now()),
                    read: e.isRead ?? false,
                    starred: e.isStarred ?? false,
                    hasAttachments: e.hasAttachments ?? false,
                    hasImages: false,
                  };
                });
                console.log('Mapped emails count:', loadedEmails.length);
                // Save to cache
                emailCache.current.set(cacheKey(firstAccount.id, 'INBOX'), loadedEmails);
                setEmails(loadedEmails);
                isInitialLoad.current = false;
                console.log('State updated with emails, cached for account:', firstAccount.id);
              } else {
                console.log('No emails in result or result is empty');
                console.log('result:', result);
              }
            } catch (emailErr) {
              console.error('Error loading emails:', emailErr);
              // Show error to user
              const errorMessage = emailErr instanceof Error ? emailErr.message : String(emailErr);
              if (window.confirm(_tApp('appErrors.emailsLoadFailed').replace('{error}', errorMessage))) {
                // Reconnect attempt
                try {
                  await connectAccount(firstAccount.id.toString());
                  // Retry loading emails
                  const retryResult = await listEmails(firstAccount.id.toString(), 0, 500, 'INBOX');
                  if (retryResult && retryResult.emails) {
                    const loadedEmails: Email[] = retryResult.emails.map((e: any, idx: number) => ({
                      id: e.uid?.toString() || e.id?.toString() || idx.toString(),
                      from: { name: e.fromName || e.from || '', email: e.from || '' },
                      to: [{ name: '', email: '' }],
                      subject: e.subject || '(Konu yok)',
                      preview: e.preview || '',
                      body: e.bodyText || e.preview || '',
                      bodyHtml: e.bodyHtml,
                      bodyText: e.bodyText,
                      date: new Date(e.date || Date.now()),
                      read: e.isRead ?? false,
                      starred: e.isStarred ?? false,
                      hasAttachments: e.hasAttachments ?? false,
                      hasImages: false,
                    }));
                    emailCache.current.set(cacheKey(firstAccount.id, 'INBOX'), loadedEmails);
                    setEmails(loadedEmails);
                  }
                } catch (retryErr) {
                  console.error('Reconnect failed:', retryErr);
                  alert(_tApp('appErrors.reconnectFailed'));
                }
              }
            }
          } catch (connectErr) {
            console.error('Failed to connect/load emails:', connectErr);
          }
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccounts();
  }, []);

  // Request notification permission on startup
  useEffect(() => {
    const initNotifications = async () => {
      try {
        const granted = await requestNotificationPermission();
        setNotificationsEnabled(granted);
        console.log('Notification permission:', granted ? 'granted' : 'denied');
      } catch (err) {
        console.error('Failed to request notification permission:', err);
      }
    };
    initNotifications();
  }, []);

  // Listen for system tray events
  useEffect(() => {
    let unlisten1: (() => void) | null = null;
    let unlisten2: (() => void) | null = null;

    const setupTrayListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        // Listen for "New Email" tray menu click
        unlisten1 = await listen('tray:new-email', () => {
          console.log('Tray: New Email clicked');
          openCompose('new');
        });

        // Listen for "Settings" tray menu click
        unlisten2 = await listen('tray:settings', () => {
          console.log('Tray: Settings clicked');
          setCurrentPage('settings');
        });

        console.log('System tray event listeners initialized');
      } catch (err) {
        console.error('Failed to setup tray listeners:', err);
      }
    };

    setupTrayListeners();

    // Cleanup listeners on unmount
    return () => {
      if (unlisten1) unlisten1();
      if (unlisten2) unlisten2();
    };
  }, []);

  // Check for new emails and show notifications
  const checkForNewEmails = useCallback(async () => {
    if (!selectedAccountId || accounts.length === 0) return;

    try {
      const { listEmails } = await import('./services/mailService');
      const result = await listEmails(selectedAccountId.toString(), 0, 500, 'INBOX');

      if (result && result.emails) {
        const newEmails: Email[] = [];

        result.emails.forEach((e: any) => {
          const emailId = e.uid?.toString() || e.id?.toString();
          if (emailId && !knownEmailIds.current.has(emailId)) {
            // This is a new email
            if (!isInitialLoad.current && notificationsEnabled) {
              const senderName = e.fromName || e.from || 'Bilinmeyen';
              const subject = e.subject || '(Konu yok)';
              showNewEmailNotification(senderName, subject, e.preview);
            }
            knownEmailIds.current.add(emailId);
            newEmails.push({
              id: emailId,
              from: { name: e.fromName || e.from || '', email: e.from || '' },
              to: [{ name: '', email: '' }],
              subject: e.subject || '(Konu yok)',
              preview: e.preview || '',
              body: e.bodyText || '',
              bodyHtml: e.bodyHtml,
              bodyText: e.bodyText,
              date: new Date(e.date || Date.now()),
              read: e.isRead ?? false,
              starred: e.isStarred ?? false,
              hasAttachments: e.hasAttachments ?? false,
              hasImages: false,
            });
          }
        });

        if (newEmails.length > 0 && !isInitialLoad.current) {
          console.log('Found', newEmails.length, 'new emails');
          setEmails(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const uniqueNewEmails = newEmails.filter(e => !existingIds.has(e.id));
            const updatedEmails = [...uniqueNewEmails, ...prev];
            // Update cache
            if (selectedAccountId && typeof selectedAccountId === 'number') {
              emailCache.current.set(cacheKey(selectedAccountId, 'INBOX'), updatedEmails);
            }
            return updatedEmails;
          });
        }

        isInitialLoad.current = false;
      }
    } catch (err) {
      console.error('Error checking for new emails:', err);
    }
  }, [selectedAccountId, accounts, notificationsEnabled]);

  // Poll for new emails based on auto-sync settings
  useEffect(() => {
    if (!selectedAccountId || accounts.length === 0 || !autoSyncEnabled) return;

    // Initialize known email IDs from current emails
    emails.forEach(e => knownEmailIds.current.add(e.id));

    // Convert interval from minutes to milliseconds
    const intervalMs = autoSyncInterval * 60 * 1000;

    const pollInterval = setInterval(() => {
      checkForNewEmails();
    }, intervalMs);

    return () => clearInterval(pollInterval);
  }, [selectedAccountId, accounts, checkForNewEmails, emails, autoSyncEnabled, autoSyncInterval]);

  // Sync emails handler - fetches from IMAP and updates cache
  const handleSync = useCallback(async () => {
    if (isSyncing || accounts.length === 0 || !selectedAccountId) return;
    setIsSyncing(true);
    try {
      const { connectAccount, listEmails } = await import('./services/mailService');
      const account = accounts.find(a => a.id === selectedAccountId) || accounts[0];

      await connectAccount(account.id.toString());

      const folderToSync = activeFolder === '__starred__' ? 'INBOX' : activeFolder;
      const result = await listEmails(account.id.toString(), 0, 500, folderToSync);

      if (result && result.emails) {
        // Preserve already-fetched email bodies from current state
        const existingBodies = new Map<string, { body: string; bodyHtml?: string; bodyText?: string; hasImages: boolean }>();
        emails.forEach(e => {
          if (e.bodyHtml || (e.body && e.body.length > 200)) {
            existingBodies.set(e.id, { body: e.body, bodyHtml: e.bodyHtml, bodyText: e.bodyText, hasImages: e.hasImages });
          }
        });

        let newEmailCount = 0;
        const loadedEmails: Email[] = result.emails.map((e: any) => {
          const emailId = e.uid?.toString() || e.id?.toString();

          if (emailId && !knownEmailIds.current.has(emailId)) {
            newEmailCount++;
            knownEmailIds.current.add(emailId);
            if (newEmailCount === 1 && notificationsEnabled) {
              showNewEmailNotification(e.fromName || e.from || 'Bilinmeyen', e.subject || '(Konu yok)', e.preview);
            } else if (newEmailCount > 1 && notificationsEnabled) {
              playNotificationSound();
            }
          }

          // Merge with existing body data if available
          const existing = existingBodies.get(emailId);

          return {
            id: emailId,
            from: { name: e.fromName || e.from || '', email: e.from || '' },
            to: [{ name: '', email: '' }],
            subject: e.subject || '(Konu yok)',
            preview: e.preview || '',
            body: existing?.body || e.bodyText || '',
            bodyHtml: existing?.bodyHtml || e.bodyHtml,
            bodyText: existing?.bodyText || e.bodyText,
            date: new Date(e.date || Date.now()),
            read: e.isRead ?? false,
            starred: e.isStarred ?? false,
            hasAttachments: e.hasAttachments ?? false,
            hasImages: existing?.hasImages || false,
          };
        });

        // Update cache
        const key = typeof selectedAccountId === 'number'
          ? cacheKey(selectedAccountId, folderToSync)
          : cacheKey('all', folderToSync);
        emailCache.current.set(key, loadedEmails);
        setEmails(loadedEmails);
        console.log('Synced:', loadedEmails.length, 'New:', newEmailCount);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Senkronizasyon basarisiz: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  }, [accounts, isSyncing, selectedAccountId, notificationsEnabled, activeFolder, emails]);

  // Handle account change
  const handleAccountChange = useCallback(async (accountId: number | 'all') => {
    if (accountId === selectedAccountId) return;

    setSelectedAccountId(accountId);
    setSelectedEmail(null);
    setActiveFolder('INBOX'); // Reset to inbox when switching accounts

    // Handle "All Accounts" unified inbox
    if (accountId === 'all') {
      // Check unified cache
      const key = cacheKey('all', 'INBOX');
      const cached = emailCache.current.get(key);
      if (cached && cached.length > 0) {
        console.log('Using cached unified inbox:', cached.length);
        setEmails(cached);
        knownEmailIds.current = new Set(cached.map(e => e.id));
        isInitialLoad.current = false;
        setImapFolders([]);
        return;
      }

      setEmails([]);
      knownEmailIds.current = new Set();
      isInitialLoad.current = true;
      setImapFolders([]);

      try {
        setIsSyncing(true);
        const { listAllAccountsEmails } = await import('./services/mailService');

        const result = await listAllAccountsEmails(0, 500, 'INBOX', sortBy);

        if (result && result.emails) {
          const loadedEmails: Email[] = result.emails.map((e: any) => {
            const emailId = e.uid?.toString() || e.id?.toString();
            const uniqueId = e.accountId ? `${e.accountId}-${emailId}` : emailId;
            knownEmailIds.current.add(uniqueId);
            return {
              id: uniqueId,
              from: { name: e.fromName || e.from || '', email: e.from || '' },
              to: [{ name: '', email: '' }],
              subject: e.subject || '(Konu yok)',
              preview: e.preview || '',
              body: e.bodyText || '',
              bodyHtml: e.bodyHtml,
              bodyText: e.bodyText,
              date: new Date(e.date || Date.now()),
              read: e.isRead ?? false,
              starred: e.isStarred ?? false,
              hasAttachments: e.hasAttachments ?? false,
              hasImages: false,
              accountId: e.accountId,
            };
          });

          emailCache.current.set(key, loadedEmails);
          setEmails(loadedEmails);
          setAccountFetchStatuses(result.accountResults || []);
          isInitialLoad.current = false;
        }
      } catch (err) {
        console.error('Failed to load unified inbox:', err);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    // Single account logic - check cache
    const key = cacheKey(accountId, 'INBOX');
    const cachedEmails = emailCache.current.get(key);
    if (cachedEmails && cachedEmails.length > 0) {
      console.log('Using cached emails for', key, 'count:', cachedEmails.length);
      setEmails(cachedEmails);
      knownEmailIds.current = new Set(cachedEmails.map(e => e.id));
      isInitialLoad.current = false;
      fetchFolders(accountId);
      return;
    }

    // No cache - fetch from server
    setEmails([]);
    knownEmailIds.current = new Set();
    isInitialLoad.current = true;

    try {
      setIsSyncing(true);
      const { connectAccount, listEmails, listFolders } = await import('./services/mailService');

      await connectAccount(accountId.toString());

      try {
        const folders = await listFolders(accountId.toString());
        setImapFolders(folders);
      } catch (folderErr) {
        console.error('Failed to fetch folders:', folderErr);
      }

      const result = await listEmails(accountId.toString(), 0, 500, 'INBOX');

      if (result && result.emails) {
        const loadedEmails: Email[] = result.emails.map((e: any) => {
          const emailId = e.uid?.toString() || e.id?.toString();
          knownEmailIds.current.add(emailId);
          return {
            id: emailId,
            from: { name: e.fromName || e.from || '', email: e.from || '' },
            to: [{ name: '', email: '' }],
            subject: e.subject || '(Konu yok)',
            preview: e.preview || '',
            body: e.bodyText || '',
            bodyHtml: e.bodyHtml,
            bodyText: e.bodyText,
            date: new Date(e.date || Date.now()),
            read: e.isRead ?? false,
            starred: e.isStarred ?? false,
            hasAttachments: e.hasAttachments ?? false,
            hasImages: false,
            accountId: accountId.toString(),
          };
        });
        emailCache.current.set(key, loadedEmails);
        setEmails(loadedEmails);
        isInitialLoad.current = false;
      }
    } catch (err) {
      console.error('Failed to switch account:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedAccountId, fetchFolders, sortBy]);

  // Handle folder change - use cache first, fetch from IMAP only if needed
  const handleFolderChange = useCallback(async (folderPath: string) => {
    console.log('handleFolderChange called with:', folderPath, 'current activeFolder:', activeFolder);

    setActiveFolder(folderPath);
    setSelectedEmail(null);

    // Starred is filtered locally, not a real folder
    if (folderPath === '__starred__') {
      return;
    }

    if (!selectedAccountId || accounts.length === 0) {
      return;
    }

    // Check if this is the Drafts folder
    const isDraftsFolder = imapFolders.find(f => f.path === folderPath)?.folder_type.toLowerCase() === 'drafts' ||
                           folderPath.toLowerCase().includes('draft');

    if (isDraftsFolder) {
      try {
        setIsLoadingDrafts(true);
        const accountToUse = typeof selectedAccountId === 'number' ? selectedAccountId : accounts[0]?.id;
        if (!accountToUse) { setDrafts([]); return; }
        const draftList = await listDrafts(accountToUse);
        setDrafts(draftList);
        setEmails([]);
      } catch (err) {
        console.error('Failed to load drafts:', err);
        setDrafts([]);
      } finally {
        setIsLoadingDrafts(false);
      }
      return;
    }

    // Check cache first
    const accountId = typeof selectedAccountId === 'number' ? selectedAccountId : selectedAccountId;
    const key = cacheKey(accountId, folderPath);
    const cached = emailCache.current.get(key);
    if (cached && cached.length > 0) {
      console.log('Using cached emails for', key, 'count:', cached.length);
      setEmails(cached);
      return;
    }

    // No cache - fetch from IMAP
    try {
      setIsSyncing(true);
      const { listEmails } = await import('./services/mailService');

      const result = await listEmails(selectedAccountId.toString(), 0, 500, folderPath);

      if (result && result.emails) {
        const loadedEmails: Email[] = result.emails.map((e: any) => {
          const emailId = e.uid?.toString() || e.id?.toString();
          return {
            id: emailId,
            from: { name: e.fromName || e.from || '', email: e.from || '' },
            to: [{ name: '', email: '' }],
            subject: e.subject || '(Konu yok)',
            preview: e.preview || '',
            body: e.bodyText || '',
            bodyHtml: e.bodyHtml,
            bodyText: e.bodyText,
            date: new Date(e.date || Date.now()),
            read: e.isRead ?? false,
            starred: e.isStarred ?? false,
            hasAttachments: e.hasAttachments ?? false,
            hasImages: false,
          };
        });
        emailCache.current.set(key, loadedEmails);
        setEmails(loadedEmails);
        console.log('Fetched & cached emails for', key, 'count:', loadedEmails.length);
      } else {
        setEmails([]);
      }
    } catch (err) {
      console.error('Failed to fetch folder:', err);
      setEmails([]);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedAccountId, accounts, imapFolders]);

  // Modal states
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [aiReplyOpen, setAiReplyOpen] = useState(false);
  const [aiGeneratedReply, setAiGeneratedReply] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('new');
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState<DraftEmail | null>(null);

  // Email states
  // Auto-trust own account emails so signatures/images always show
  const ownEmails = useMemo(() => accounts.map(a => a.email), [accounts]);
  const [trustedSenders, setTrustedSenders] = useState<string[]>([]);
  const [loadedImageEmails, setLoadedImageEmails] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [fetchedEmailIds, setFetchedEmailIds] = useState<Set<string>>(new Set());
  const [phishingResults, setPhishingResults] = useState<Record<string, PhishingAnalysis>>({});
  const [analyzingPhishingId, setAnalyzingPhishingId] = useState<string | null>(null);
  const [phishingWarningCollapsed, setPhishingWarningCollapsed] = useState<Record<string, boolean>>({}); // Track collapsed state per email
  const [trackingResults, setTrackingResults] = useState<Record<string, TrackingAnalysis>>({});

  // Check if user has any accounts configured
  const hasAccounts = accounts.length > 0;

  // Get current account (for Compose signature)
  const currentAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0] || null;

  const currentEmail = emails.find((e) => e.id === selectedEmail) || null;
  const isTrustedSender = currentEmail ? (trustedSenders.includes(currentEmail.from.email) || ownEmails.includes(currentEmail.from.email)) : false;
  const showImages = selectedEmail ? loadedImageEmails.includes(selectedEmail) : false;

  // Fetch full email content when selected
  useEffect(() => {
    if (!selectedEmail || accounts.length === 0 || !selectedAccountId) return;
    if (fetchedEmailIds.has(selectedEmail)) return; // Already fetched

    const fetchEmailContent = async () => {
      try {
        const { getEmail } = await import('./services/mailService');
        const { accountId: resolvedAccountId, uid } = parseEmailId(selectedEmail, selectedAccountId);
        if (isNaN(uid) || !resolvedAccountId) return;

        console.log('Fetching full email content for UID:', uid, 'account:', resolvedAccountId);
        const fullEmail = await getEmail(resolvedAccountId, uid, 'INBOX');
        console.log('Full email fetched:', fullEmail);

        // Mark as fetched
        setFetchedEmailIds(prev => new Set([...prev, selectedEmail]));

        // Check if email has images
        const hasImages = fullEmail.bodyHtml ? /<img[^>]+src=/i.test(fullEmail.bodyHtml) : false;

        // Update the email in state and cache with full content
        setEmails(prev => {
          const updated = prev.map(e => {
            if (e.id === selectedEmail) {
              return {
                ...e,
                body: fullEmail.bodyText || fullEmail.bodyHtml || e.body,
                bodyText: fullEmail.bodyText,
                bodyHtml: fullEmail.bodyHtml,
                hasImages,
              };
            }
            return e;
          });
          // Update cache with body content
          if (typeof selectedAccountId === 'number') {
            const key = cacheKey(selectedAccountId, activeFolder === '__starred__' ? 'INBOX' : activeFolder);
            emailCache.current.set(key, updated);
          }
          return updated;
        });
      } catch (err) {
        console.error('Failed to fetch email content:', err);
      }
    };

    fetchEmailContent();
  }, [selectedEmail, accounts, fetchedEmailIds, selectedAccountId, activeFolder]);

  // Get visible emails for navigation
  const visibleEmails = useMemo(() => {
    // If searching, use backend FTS5 search results
    if (searchQuery.trim() && searchResults.length > 0) {
      return searchResults;
    }

    // If searching but no results yet (or empty search), continue with normal flow
    if (searchQuery.trim() && searchResults.length === 0 && !isSearching) {
      return []; // Empty results when search is done
    }

    // Otherwise, use regular filtered emails
    let result = emails;
    switch (activeFolder) {
      case "__starred__": result = result.filter(e => e.starred && !e.deleted); break;
      case "__archive__": result = result.filter(e => e.archived && !e.deleted); break;
      case "__trash__": result = result.filter(e => e.deleted); break;
      default: result = result.filter(e => !e.archived && !e.deleted);
    }

    // Apply sorting
    const dir = sortDirection === 'desc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date':
          cmp = b.date.getTime() - a.date.getTime();
          break;
        case 'unread':
          if (a.read !== b.read) { cmp = a.read ? 1 : -1; break; }
          cmp = b.date.getTime() - a.date.getTime();
          break;
        case 'account':
          if (a.accountId !== b.accountId) { cmp = (a.accountId || '').localeCompare(b.accountId || ''); break; }
          cmp = b.date.getTime() - a.date.getTime();
          break;
        case 'priority':
        default:
          if (a.read !== b.read) { cmp = a.read ? 1 : -1; break; }
          if (a.starred !== b.starred) { cmp = a.starred ? -1 : 1; break; }
          cmp = b.date.getTime() - a.date.getTime();
          break;
      }
      return cmp * dir;
    });

    return result;
  }, [emails, activeFolder, searchQuery, searchResults, isSearching, sortBy, sortDirection]);

  // Handle search input changes
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    // Update search filters with new query
    setSearchFilters(prev => ({ ...prev, query: query.trim() || undefined }));

    // Trigger debounced backend search (only for single account)
    if (selectedAccountId && typeof selectedAccountId === 'number' && query.trim()) {
      debouncedSearch(query, selectedAccountId);
    } else {
      // Clear search results if query is empty
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [selectedAccountId, debouncedSearch]);

  // Auto-analyze phishing when email is selected
  useEffect(() => {
    if (!currentEmail || !currentEmail.id) return;
    // Skip if auto-detection is disabled in settings
    if (!autoPhishingDetection) return;
    // Skip if already analyzed
    if (phishingResults[currentEmail.id]) return;
    // Skip if currently analyzing
    if (analyzingPhishingId === currentEmail.id) return;

    const analyzeEmail = async () => {
      setAnalyzingPhishingId(currentEmail.id);
      try {
        const result = await analyzePhishing(
          {
            from: currentEmail.from,
            subject: currentEmail.subject,
            body: currentEmail.body,
            bodyHtml: currentEmail.bodyHtml,
          },
          'tr',
          geminiApiKey || undefined
        );
        setPhishingResults(prev => ({ ...prev, [currentEmail.id]: result }));
      } catch (err) {
        console.error('Phishing analysis failed:', err);
        // On error, set a default low-risk result
        setPhishingResults(prev => ({
          ...prev,
          [currentEmail.id]: {
            isPhishing: false,
            riskLevel: 'low',
            score: 0,
            reasons: [],
            recommendations: [],
          },
        }));
      } finally {
        setAnalyzingPhishingId(null);
      }
    };

    analyzeEmail();
  }, [currentEmail?.id, currentEmail?.from, currentEmail?.subject, currentEmail?.body, currentEmail?.bodyHtml, phishingResults, analyzingPhishingId, geminiApiKey, autoPhishingDetection]);

  // Auto-detect tracking when email is selected
  useEffect(() => {
    if (!currentEmail || !currentEmail.id) return;
    // Skip if already analyzed
    if (trackingResults[currentEmail.id]) return;
    // Only analyze if email has HTML content
    if (!currentEmail.bodyHtml) return;

    const result = detectEmailTracking(currentEmail.bodyHtml, appLang as 'tr' | 'en');
    setTrackingResults(prev => ({ ...prev, [currentEmail.id]: result }));
  }, [currentEmail?.id, currentEmail?.bodyHtml, trackingResults, appLang]);

  // Email actions
  const handleToggleStar = useCallback(async (emailId?: string) => {
    const targetId = emailId || selectedEmail;
    if (!targetId || !selectedAccountId) return;

    const email = emails.find(e => e.id === targetId);
    if (!email) return;

    const newStarred = !email.starred;

    // Optimistic update
    setEmails(prev => prev.map(e => e.id === targetId ? { ...e, starred: newStarred } : e));

    // Call backend
    try {
      const { markEmailStarred } = await import('./services/mailService');
      const { accountId: resolvedAccountId, uid } = parseEmailId(targetId, selectedAccountId);
      await markEmailStarred(resolvedAccountId, uid, newStarred, activeFolder);
    } catch (err) {
      console.error('Failed to toggle star:', err);
      // Revert on error
      setEmails(prev => prev.map(e => e.id === targetId ? { ...e, starred: !newStarred } : e));
    }
  }, [selectedEmail, selectedAccountId, emails, activeFolder]);

  const handleToggleRead = useCallback(async () => {
    if (!selectedEmail || !selectedAccountId) return;

    const email = emails.find(e => e.id === selectedEmail);
    if (!email) return;

    const newRead = !email.read;

    // Optimistic update
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, read: newRead } : e));

    // Call backend
    try {
      const { markEmailRead } = await import('./services/mailService');
      const { accountId: resolvedAccountId, uid } = parseEmailId(selectedEmail, selectedAccountId);
      await markEmailRead(resolvedAccountId, uid, newRead, activeFolder);
    } catch (err) {
      console.error('Failed to toggle read:', err);
      // Revert on error
      setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, read: !newRead } : e));
    }
  }, [selectedEmail, selectedAccountId, emails, activeFolder]);

  const handleArchive = useCallback(async () => {
    if (!selectedEmail || !selectedAccountId) return;

    // Optimistic update
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, archived: true } : e));

    // Select next email
    const idx = visibleEmails.findIndex(e => e.id === selectedEmail);
    const nextEmail = idx < visibleEmails.length - 1 ? visibleEmails[idx + 1].id :
                      idx > 0 ? visibleEmails[idx - 1].id : null;
    setSelectedEmail(nextEmail);

    // Call backend
    try {
      const { archiveEmail } = await import('./services/mailService');
      const { accountId: resolvedAccountId, uid } = parseEmailId(selectedEmail, selectedAccountId);
      await archiveEmail(resolvedAccountId, uid);
    } catch (err) {
      console.error('Failed to archive:', err);
      // Revert on error
      setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, archived: false } : e));
    }
  }, [selectedEmail, selectedAccountId, visibleEmails]);

  const handleDelete = useCallback(async () => {
    if (!selectedEmail || !selectedAccountId) return;

    // Optimistic update
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, deleted: true } : e));

    // Select next email
    const idx = visibleEmails.findIndex(e => e.id === selectedEmail);
    const nextEmail = idx < visibleEmails.length - 1 ? visibleEmails[idx + 1].id :
                      idx > 0 ? visibleEmails[idx - 1].id : null;
    setSelectedEmail(nextEmail);

    // Call backend
    try {
      const { deleteEmail } = await import('./services/mailService');
      const { accountId: resolvedAccountId, uid } = parseEmailId(selectedEmail, selectedAccountId);
      await deleteEmail(resolvedAccountId, uid, false, activeFolder);
    } catch (err) {
      console.error('Failed to delete:', err);
      // Revert on error
      setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, deleted: false } : e));
    }
  }, [selectedEmail, selectedAccountId, visibleEmails, activeFolder]);

  const handleLoadImages = () => {
    if (selectedEmail && !loadedImageEmails.includes(selectedEmail)) {
      setLoadedImageEmails([...loadedImageEmails, selectedEmail]);
    }
  };

  const handleTrustSender = (senderEmail: string) => {
    if (!trustedSenders.includes(senderEmail)) {
      setTrustedSenders([...trustedSenders, senderEmail]);
    }
  };

  // Compose handlers
  const openCompose = useCallback((mode: ComposeMode) => {
    setComposeMode(mode);
    setComposeOpen(true);
  }, []);

  // Handle opening a draft for editing
  const handleOpenDraft = useCallback(async (draftId: number) => {
    try {
      const draftDetail = await getDraft(draftId);

      // Convert DraftDetail to DraftEmail
      const toAddresses = JSON.parse(draftDetail.toAddresses || '[]') as EmailAddress[];
      const ccAddresses = JSON.parse(draftDetail.ccAddresses || '[]') as EmailAddress[];
      const bccAddresses = JSON.parse(draftDetail.bccAddresses || '[]') as EmailAddress[];

      // Open compose with draft data
      setComposeMode(draftDetail.composeType as ComposeMode);
      setComposeOpen(true);

      // The Compose component will receive this draft via its props
      // We need to pass this data somehow - let's store it in a state
      setDraftToEdit({
        id: draftDetail.id,
        accountId: draftDetail.accountId,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        subject: draftDetail.subject,
        bodyText: draftDetail.bodyText,
        bodyHtml: draftDetail.bodyHtml,
        attachments: draftDetail.attachments.map((att, idx) => ({
          id: idx,
          index: idx,
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          localPath: att.localPath,
          isInline: false,
        })),
        replyToEmailId: draftDetail.replyToEmailId,
        forwardEmailId: draftDetail.forwardEmailId,
        composeType: draftDetail.composeType as 'new' | 'reply' | 'replyAll' | 'forward',
      });
    } catch (err) {
      console.error('Failed to open draft:', err);
    }
  }, []);

  // Handle email selection (including drafts)
  const handleEmailSelect = useCallback((emailId: string) => {
    // Check if this is a draft
    if (emailId.startsWith('draft-')) {
      const draftId = parseInt(emailId.replace('draft-', ''));
      handleOpenDraft(draftId);
    } else {
      setSelectedEmail(emailId);
    }
  }, [handleOpenDraft]);

  // Handle draft deletion
  const handleDeleteDraft = useCallback(async (draftId: number) => {
    try {
      await deleteDraft(draftId);
      // Remove from drafts list
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      console.log('Draft deleted:', draftId);
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  }, []);

  const handleSend = async (draft: DraftEmail) => {
    console.log("Sending email:", draft);
    try {
      const { sendEmail } = await import('./services/mailService');
      // Use the selected account ID (cannot send from "All Accounts")
      const accountId = typeof selectedAccountId === 'number' ? selectedAccountId : draft.accountId;
      if (!accountId || typeof accountId !== 'number') {
        throw new Error(_tApp('appErrors.selectAccountToSend'));
      }
      const emailToSend = {
        ...draft,
        accountId,
      };
      await sendEmail(emailToSend);
      console.log("Email sent successfully");
      // Show notification
      playNotificationSound();
    } catch (err) {
      console.error("Failed to send email:", err);
      throw err; // Re-throw so Compose component can show error
    }
  };

  const handleSaveDraft = async (draft: DraftEmail) => {
    try {
      await saveDraft(draft, []);
      console.log("Draft saved successfully");
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  };

  // Download attachment
  const handleDownloadAttachment = async (attachmentIndex: number, filename: string) => {
    if (!currentEmail || !selectedAccountId) return;

    try {
      const { downloadAttachment } = await import('./services/mailService');
      console.log('Downloading attachment:', { attachmentIndex, filename, folder: activeFolder });

      // Call backend to download attachment
      const { accountId: resolvedAccountId, uid } = parseEmailId(currentEmail.id, selectedAccountId);
      const result = await downloadAttachment(
        resolvedAccountId,
        activeFolder,
        uid,
        attachmentIndex
      );

      // Convert base64 to blob
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.contentType });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✓ Attachment downloaded:', result.filename);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      alert(_tApp('appErrors.attachmentDownloadError').replace('{error}', String(err)));
    }
  };

  // Summarize
  const handleSummarize = useCallback(async () => {
    if (!currentEmail || summarizingId) return;
    if (!geminiApiKey) {
      console.error("Gemini API key not set. Please configure it in Settings > AI.");
      alert(_tApp('appErrors.geminiApiKeyNotSet'));
      return;
    }
    setSummarizingId(currentEmail.id);
    try {
      // Auto-detect language from email content
      const summary = await summarizeEmail(currentEmail.body, undefined, geminiApiKey);
      setSummaries(prev => ({ ...prev, [currentEmail.id]: summary }));
    } catch (err) {
      console.error("Summarize failed:", err);
    } finally {
      setSummarizingId(null);
    }
  }, [currentEmail, summarizingId, geminiApiKey]);

  // Command handler
  const handleCommand = useCallback((cmd: string) => {
    switch (cmd) {
      case "compose": openCompose('new'); break;
      case "reply": if (currentEmail) openCompose('reply'); break;
      case "replyAll": if (currentEmail) openCompose('replyAll'); break;
      case "forward": if (currentEmail) openCompose('forward'); break;
      case "archive": handleArchive(); break;
      case "delete": handleDelete(); break;
      case "star": handleToggleStar(); break;
      case "markUnread": handleToggleRead(); break;
      case "aiReply": if (currentEmail) setAiReplyOpen(true); break;
      case "shortcuts": setShortcutsHelpOpen(true); break;
      case "search": document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus(); break;
    }
  }, [currentEmail, openCompose, handleArchive, handleDelete, handleToggleStar, handleToggleRead]);

  // Navigation
  const navigateEmail = useCallback((direction: 'next' | 'prev') => {
    if (visibleEmails.length === 0) return;
    const currentIdx = visibleEmails.findIndex(e => e.id === selectedEmail);
    if (direction === 'next' && currentIdx < visibleEmails.length - 1) {
      setSelectedEmail(visibleEmails[currentIdx + 1].id);
    } else if (direction === 'prev' && currentIdx > 0) {
      setSelectedEmail(visibleEmails[currentIdx - 1].id);
    } else if (currentIdx === -1 && visibleEmails.length > 0) {
      setSelectedEmail(visibleEmails[0].id);
    }
  }, [selectedEmail, visibleEmails]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea/contentEditable (TipTap editor)
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      // Ignore if any modal is open (except Escape)
      const modalOpen = commandPaletteOpen || aiReplyOpen || composeOpen || shortcutsHelpOpen;

      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setAiReplyOpen(false);
        setComposeOpen(false);
        setShortcutsHelpOpen(false);
        return;
      }

      if (modalOpen) return;

      // Command palette (Ctrl+K / Cmd+K)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Let system shortcuts through (Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+X, Ctrl+Z, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Single key shortcuts (no modifier)
      switch (e.key.toLowerCase()) {
        case "j": navigateEmail('next'); break;
        case "k": navigateEmail('prev'); break;
        case "c": e.preventDefault(); openCompose('new'); break;
        case "r": if (currentEmail) openCompose('reply'); break;
        case "a": if (currentEmail) openCompose('replyAll'); break;
        case "f": if (currentEmail) openCompose('forward'); break;
        case "g": if (currentEmail) setAiReplyOpen(true); break;
        case "e": handleArchive(); break;
        case "s": handleToggleStar(); break;
        case "u": handleToggleRead(); break;
        case "/": e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus(); break;
        case "?": setShortcutsHelpOpen(true); break;
        case "#": handleDelete(); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, aiReplyOpen, composeOpen, shortcutsHelpOpen, currentEmail, navigateEmail, openCompose, handleArchive, handleDelete, handleToggleStar, handleToggleRead]);

  // Mark as read when selected (with backend call)
  useEffect(() => {
    if (selectedEmail && selectedAccountId) {
      const email = emails.find(e => e.id === selectedEmail);
      if (email && !email.read) {
        const emailIdToMark = selectedEmail;
        const delayMs = (autoMarkReadDelay ?? 2) * 1000;
        const timeoutId = setTimeout(async () => {
          // Optimistic update
          setEmails(prev => prev.map(e => e.id === emailIdToMark ? { ...e, read: true } : e));

          // Call backend
          try {
            const { markEmailRead } = await import('./services/mailService');
            const { accountId: resolvedAccountId, uid } = parseEmailId(emailIdToMark, selectedAccountId);
            await markEmailRead(resolvedAccountId, uid, true, activeFolder);
          } catch (err) {
            console.error('Failed to mark as read:', err);
            // Revert optimistic update on failure
            setEmails(prev => prev.map(e => e.id === emailIdToMark ? { ...e, read: false } : e));
          }
        }, delayMs);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedEmail, selectedAccountId, activeFolder, autoMarkReadDelay]);

  // Handle account added
  const handleAccountAdded = async (account: Account) => {
    setAccounts(prev => [...prev, account]);
    setAddAccountModalOpen(false);

    // Automatically select the newly added account
    setSelectedAccountId(account.id);
    setActiveFolder('INBOX'); // Reset to inbox for new account

    // Connect and load emails for the new account
    try {
      const { connectAccount, listEmails } = await import('./services/mailService');
      await connectAccount(account.id.toString());
      console.log('Connected to new account:', account.email);

      // Load emails (page is 0-indexed)
      const result = await listEmails(account.id.toString(), 0, 500, 'INBOX');
      console.log('listEmails result after add:', result);
      if (result && result.emails) {
        console.log('Raw emails from backend:', result.emails);
        const loadedEmails: Email[] = result.emails.map((e: any) => ({
          id: e.uid?.toString() || e.id?.toString(),
          from: { name: e.fromName || e.from || '', email: e.from || '' },
          to: [{ name: '', email: '' }],
          subject: e.subject || '(Konu yok)',
          preview: e.preview || '',
          body: e.bodyText || '',
          bodyHtml: e.bodyHtml,
          bodyText: e.bodyText,
          date: new Date(e.date || Date.now()),
          read: e.isRead ?? false,
          starred: e.isStarred ?? false,
          hasAttachments: e.hasAttachments ?? false,
          hasImages: false,
          accountId: account.id.toString(), // Add accountId for unique keys
        }));
        setEmails(loadedEmails);
        console.log('Mapped emails after add:', loadedEmails.length, loadedEmails);
      }
    } catch (err) {
      console.error('Failed to connect/load emails after account add:', err);
    }
  };

  // Show Welcome screen if no accounts
  if (!hasAccounts && currentPage !== 'settings') {
    return (
      <>
        <Welcome
          onAddAccount={() => setAddAccountModalOpen(true)}
          onOpenSettings={() => setCurrentPage('settings')}
        />
        <AddAccountModal
          isOpen={addAccountModalOpen}
          onClose={() => setAddAccountModalOpen(false)}
          onAccountAdded={handleAccountAdded}
        />
      </>
    );
  }

  // Show Settings page
  if (currentPage === 'settings') {
    return <Settings onBack={() => { reloadAccounts(); setCurrentPage('mail'); }} />;
  }

  // Show Filters page
  if (currentPage === 'filters') {
    return <Filters onBack={() => setCurrentPage('mail')} defaultAccountId={typeof selectedAccountId === 'number' ? selectedAccountId : undefined} />;
  }

  // ============================================================================
  // Mobile Layout
  // ============================================================================
  if (mobile) {
    // Apply same filtering as MailPanel for mobile
    const mobileFilteredEmails = (() => {
      let result = emails;
      if (activeFolder === '__starred__') {
        result = result.filter(e => e.starred && !e.deleted);
      } else {
        const isTrash = activeFolder.toLowerCase().includes('trash') || activeFolder.toLowerCase().includes('deleted');
        if (!isTrash) result = result.filter(e => !e.deleted);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(e =>
          e.subject.toLowerCase().includes(q) ||
          e.from.name.toLowerCase().includes(q) ||
          e.from.email.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
        );
      }
      return result;
    })();
    const unreadCount = emails.filter(e => !e.read).length;

    return (
      <MobileLayout>
        {/* Drawer */}
        <MobileDrawer
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={handleAccountChange}
          imapFolders={imapFolders}
          activeFolder={activeFolder}
          onFolderChange={handleFolderChange}
          onSettingsClick={() => setCurrentPage('settings')}
          onFiltersClick={() => setCurrentPage('filters')}
        />

        {/* Screen content */}
        <div className="flex-1 overflow-hidden">
          {mobileNav.currentScreen.type === 'emailList' && (
            <MobileEmailList
              emails={mobileFilteredEmails}
              onSelect={handleEmailSelect}
              onSync={handleSync}
              isSyncing={isSyncing}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onToggleStar={handleToggleStar}
              onToggleRead={(id) => {
                setEmails(prev => prev.map(e => e.id === id ? { ...e, read: !e.read } : e));
              }}
              onDelete={(id) => {
                setSelectedEmail(id);
                handleDelete();
              }}
              onArchive={(id) => {
                setSelectedEmail(id);
                handleArchive();
              }}
              activeFolder={activeFolder}
              showSearch={mobileNav.activeTab === 'search'}
            />
          )}

          {mobileNav.currentScreen.type === 'emailDetail' && (
            <MobileEmailView
              email={currentEmail}
              accountId={selectedAccountId?.toString() || null}
              folder={activeFolder}
              showImages={showImages}
              isTrustedSender={isTrustedSender}
              onLoadImages={handleLoadImages}
              onTrustSender={handleTrustSender}
              onReply={() => openCompose('reply')}
              onReplyAll={() => openCompose('replyAll')}
              onForward={() => openCompose('forward')}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onToggleStar={handleToggleStar}
              onToggleRead={handleToggleRead}
              onDownloadAttachment={handleDownloadAttachment}
              summary={selectedEmail ? summaries[selectedEmail] || null : null}
              onSummarize={handleSummarize}
              isSummarizing={summarizingId === selectedEmail}
              selectedAccountId={selectedAccountId}
              accounts={accounts}
            />
          )}
        </div>

        {/* Bottom navigation (hidden when viewing email detail) */}
        {mobileNav.currentScreen.type !== 'emailDetail' && (
          <MobileBottomNav
            onComposeClick={() => openCompose('new')}
            onSettingsClick={() => setCurrentPage('settings')}
            unreadCount={unreadCount}
          />
        )}

        {/* Shared Modals */}
        {currentEmail && (
          <>
            <AIReplyModal
              isOpen={aiReplyOpen}
              onClose={() => setAiReplyOpen(false)}
              onUseReply={(reply) => {
                setAiGeneratedReply(reply);
                setAiReplyOpen(false);
                openCompose('reply');
              }}
              emailContent={currentEmail.body}
              emailSubject={currentEmail.subject}
              senderName={currentEmail.from.name}
              apiKey={geminiApiKey}
            />
            <Compose
              isOpen={composeOpen}
              onClose={() => { setComposeOpen(false); setAiGeneratedReply(null); }}
              mode={composeMode}
              initialBody={aiGeneratedReply || undefined}
              originalEmail={{
                id: parseInt(currentEmail.id),
                accountId: 1,
                folderId: 1,
                messageId: currentEmail.id,
                uid: parseInt(currentEmail.id),
                from: currentEmail.from,
                to: currentEmail.to,
                cc: [],
                bcc: [],
                subject: currentEmail.subject,
                preview: currentEmail.preview,
                bodyText: currentEmail.bodyText || currentEmail.body,
                bodyHtml: currentEmail.bodyHtml,
                date: currentEmail.date.toISOString(),
                isRead: currentEmail.read,
                isStarred: currentEmail.starred,
                isDeleted: false,
                isSpam: false,
                isDraft: false,
                isAnswered: false,
                isForwarded: false,
                hasAttachments: currentEmail.hasAttachments,
                hasInlineImages: currentEmail.hasImages,
                priority: 3,
                labels: [],
              }}
              onSend={handleSend}
              onSaveDraft={handleSaveDraft}
              defaultAccount={currentAccount}
            />
          </>
        )}

        {!currentEmail && composeMode === 'new' && (
          <Compose
            isOpen={composeOpen}
            onClose={() => {
              setComposeOpen(false);
              setDraftToEdit(null);
            }}
            mode="new"
            draft={draftToEdit || undefined}
            onSend={handleSend}
            onSaveDraft={handleSaveDraft}
            defaultAccount={currentAccount}
          />
        )}
      </MobileLayout>
    );
  }

  // ============================================================================
  // Desktop Layout
  // ============================================================================
  return (
    <div className="h-screen flex bg-owl-bg">
      <MailPanel
        emails={emails}
        selectedId={selectedEmail}
        onSelect={handleEmailSelect}
        activeFolder={activeFolder}
        onFolderChange={handleFolderChange}
        onSettingsClick={() => setCurrentPage('settings')}
        onFiltersClick={() => setCurrentPage('filters')}
        onComposeClick={() => openCompose('new')}
        onSyncClick={handleSync}
        onOsintClick={() => {}}
        isSyncing={isSyncing}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchFilters={searchFilters}
        onSearchFiltersChange={setSearchFilters}
        onAdvancedSearch={handleAdvancedSearch}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onAccountChange={handleAccountChange}
        imapFolders={imapFolders}
        isLoadingFolders={isLoadingFolders}
        onToggleStar={handleToggleStar}
        onDeleteDraft={handleDeleteDraft}
        drafts={drafts}
        isLoadingDrafts={isLoadingDrafts}
        isSearching={isSearching}
        searchResultsCount={searchResults.length}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
        onEmailContextMenu={(e, email) => {
          contextMenu.show(e, [
            { id: 'reply', label: 'Reply', shortcut: 'R', icon: <Icons.Reply />, onClick: () => { handleEmailSelect(email.id); openCompose('reply'); } },
            { id: 'replyAll', label: 'Reply All', shortcut: 'A', icon: <Icons.ReplyAll />, onClick: () => { handleEmailSelect(email.id); openCompose('replyAll'); } },
            { id: 'forward', label: 'Forward', shortcut: 'F', icon: <Icons.Forward />, onClick: () => { handleEmailSelect(email.id); openCompose('forward'); } },
            { id: 'div1', label: '', divider: true, onClick: () => {} },
            { id: 'star', label: email.starred ? 'Unstar' : 'Star', shortcut: 'S', icon: <Icons.Star />, onClick: () => handleToggleStar(email.id) },
            { id: 'read', label: email.read ? 'Mark Unread' : 'Mark Read', shortcut: 'U', icon: <Icons.MailOpen />, onClick: () => { handleEmailSelect(email.id); setTimeout(handleToggleRead, 50); } },
            { id: 'div2', label: '', divider: true, onClick: () => {} },
            { id: 'archive', label: 'Archive', shortcut: 'E', icon: <Icons.Archive />, onClick: () => { handleEmailSelect(email.id); handleArchive(); } },
            { id: 'delete', label: 'Delete', shortcut: '#', icon: <Icons.Trash />, danger: true, onClick: () => { handleEmailSelect(email.id); handleDelete(); } },
          ]);
        }}
      />
      <EmailView
        email={currentEmail}
        accountId={selectedAccountId?.toString() || null}
        folder={activeFolder}
        showImages={showImages}
        isTrustedSender={isTrustedSender}
        onLoadImages={handleLoadImages}
        onTrustSender={handleTrustSender}
        onAIReply={() => setAiReplyOpen(true)}
        onReply={() => openCompose('reply')}
        onReplyAll={() => openCompose('replyAll')}
        onForward={() => openCompose('forward')}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onToggleStar={handleToggleStar}
        onToggleRead={handleToggleRead}
        summary={selectedEmail ? summaries[selectedEmail] || null : null}
        onSummarize={handleSummarize}
        isSummarizing={summarizingId === selectedEmail}
        phishingAnalysis={selectedEmail ? phishingResults[selectedEmail] || null : null}
        isAnalyzingPhishing={analyzingPhishingId === selectedEmail}
        phishingWarningCollapsed={selectedEmail ? (phishingWarningCollapsed[selectedEmail] ?? true) : true}
        onTogglePhishingCollapse={() => {
          if (selectedEmail) {
            setPhishingWarningCollapsed(prev => ({
              ...prev,
              [selectedEmail]: !prev[selectedEmail]
            }));
          }
        }}
        trackingAnalysis={selectedEmail ? trackingResults[selectedEmail] || null : null}
        onDownloadAttachment={handleDownloadAttachment}
        selectedAccountId={selectedAccountId}
        accounts={accounts}
        appSettings={appSettings}
      />

      {/* Modals */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={handleCommand}
      />

      {currentEmail && (
        <>
          <AIReplyModal
            isOpen={aiReplyOpen}
            onClose={() => setAiReplyOpen(false)}
            onUseReply={(reply) => {
              setAiGeneratedReply(reply);
              setAiReplyOpen(false);
              openCompose('reply');
            }}
            emailContent={currentEmail.body}
            emailSubject={currentEmail.subject}
            senderName={currentEmail.from.name}
            apiKey={geminiApiKey}
          />

          <Compose
            isOpen={composeOpen}
            onClose={() => { setComposeOpen(false); setAiGeneratedReply(null); }}
            mode={composeMode}
            initialBody={aiGeneratedReply || undefined}
            originalEmail={{
              id: parseEmailId(currentEmail.id, selectedAccountId).uid,
              accountId: parseInt(parseEmailId(currentEmail.id, selectedAccountId).accountId) || 1,
              folderId: 1,
              messageId: currentEmail.id,
              uid: parseEmailId(currentEmail.id, selectedAccountId).uid,
              from: currentEmail.from,
              to: currentEmail.to,
              cc: [],
              bcc: [],
              subject: currentEmail.subject,
              preview: currentEmail.preview,
              bodyText: currentEmail.bodyText || currentEmail.body,
              bodyHtml: currentEmail.bodyHtml,
              date: currentEmail.date.toISOString(),
              isRead: currentEmail.read,
              isStarred: currentEmail.starred,
              isDeleted: false,
              isSpam: false,
              isDraft: false,
              isAnswered: false,
              isForwarded: false,
              hasAttachments: currentEmail.hasAttachments,
              hasInlineImages: currentEmail.hasImages,
              priority: 3,
              labels: [],
            }}
            onSend={handleSend}
            onSaveDraft={handleSaveDraft}
            defaultAccount={currentAccount}
          />
        </>
      )}

      {/* Compose for new email (no original) */}
      {!currentEmail && composeMode === 'new' && (
        <Compose
          isOpen={composeOpen}
          onClose={() => {
            setComposeOpen(false);
            setDraftToEdit(null);
          }}
          mode="new"
          draft={draftToEdit || undefined}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
          defaultAccount={currentAccount}
        />
      )}

      <ShortcutsHelp isOpen={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />


      {/* Context Menu (right-click) */}
      <ContextMenu menu={contextMenu.menu} onClose={contextMenu.hide} />
    </div>
  );
}

function AppWithProviders() {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
}

export default AppWithProviders;
