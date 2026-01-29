import { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";
import owlivionIcon from "./assets/owlivion-logo.svg";
import { Settings } from "./pages/Settings";
import { AIReplyModal } from "./components/AIReplyModal";
import { Compose } from "./components/Compose";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { Welcome } from "./components/Welcome";
import { AddAccountModal } from "./components/settings/AddAccountModal";
import { summarizeEmail } from "./services/geminiService";
import type { DraftEmail, EmailAddress, Account } from "./types";

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
  Command: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z" /></svg>,
  Image: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  ShieldCheck: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  MailOpen: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>,
  MailUnread: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /><circle cx="18" cy="5" r="3" fill="currentColor" /></svg>,
  Summarize: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
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
  archived?: boolean;
  deleted?: boolean;
}


// Helper Functions
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Dün";
  if (days < 7) return date.toLocaleDateString("tr-TR", { weekday: "short" });
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
  searchQuery,
  onSearchChange,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeFolder: string;
  onFolderChange: (id: string) => void;
  onSettingsClick: () => void;
  onComposeClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  const folders = [
    { id: "inbox", name: "Inbox", icon: <Icons.Inbox />, count: emails.filter(e => !e.read && !e.archived && !e.deleted).length },
    { id: "starred", name: "Starred", icon: <Icons.Star />, count: emails.filter(e => e.starred).length },
    { id: "sent", name: "Sent", icon: <Icons.Send />, count: 0 },
    { id: "drafts", name: "Drafts", icon: <Icons.File />, count: 0 },
    { id: "archive", name: "Archive", icon: <Icons.Archive />, count: emails.filter(e => e.archived).length },
    { id: "trash", name: "Trash", icon: <Icons.Trash />, count: emails.filter(e => e.deleted).length },
  ];

  const activeFolderData = folders.find(f => f.id === activeFolder);

  // Filter emails based on folder
  const filteredEmails = useMemo(() => {
    let result = emails;

    // Folder filter
    switch (activeFolder) {
      case "starred":
        result = result.filter(e => e.starred && !e.deleted);
        break;
      case "archive":
        result = result.filter(e => e.archived && !e.deleted);
        break;
      case "trash":
        result = result.filter(e => e.deleted);
        break;
      default:
        result = result.filter(e => !e.archived && !e.deleted);
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

    return result;
  }, [emails, activeFolder, searchQuery]);

  return (
    <div className="w-[380px] bg-owl-surface border-r border-owl-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-owl-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src={owlivionIcon} alt="Owlivion" className="h-8 w-auto object-contain" />
            <span className="font-semibold text-owl-text text-lg">Owlivion <span className="text-owl-accent">Mail</span></span>
          </div>
          <button
            onClick={onComposeClick}
            className="flex items-center gap-1.5 bg-owl-accent hover:bg-owl-accent-hover text-white py-1.5 px-3 rounded-lg transition-colors text-sm"
          >
            <Icons.Plus />
            <span>Compose</span>
            <kbd className="text-xs bg-white/20 px-1 rounded ml-1">C</kbd>
          </button>
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
      </div>

      {/* Folder Tabs */}
      <div className="px-2 py-2 border-b border-owl-border">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {folders.slice(0, 4).map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-sm ${
                activeFolder === folder.id
                  ? "bg-owl-accent/20 text-owl-accent"
                  : "text-owl-text-secondary hover:bg-owl-bg hover:text-owl-text"
              }`}
            >
              {folder.icon}
              <span>{folder.name}</span>
              {folder.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${
                  activeFolder === folder.id ? "bg-owl-accent text-white" : "bg-owl-bg"
                }`}>
                  {folder.count}
                </span>
              )}
            </button>
          ))}
          <div className="relative group">
            <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-owl-text-secondary hover:bg-owl-bg hover:text-owl-text transition-colors text-sm">
              <span>More</span>
              <Icons.ChevronDown />
            </button>
            <div className="absolute top-full left-0 mt-1 bg-owl-surface-2 rounded-lg border border-owl-border shadow-owl-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
              {folders.slice(4).map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => onFolderChange(folder.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-owl-bg transition-colors first:rounded-t-lg last:rounded-b-lg text-sm ${
                    activeFolder === folder.id ? "text-owl-accent" : "text-owl-text-secondary"
                  }`}
                >
                  {folder.icon}
                  <span>{folder.name}</span>
                  {folder.count > 0 && <span className="text-xs bg-owl-bg px-1.5 rounded-full ml-auto">{folder.count}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-xs font-medium text-owl-text-secondary uppercase tracking-wider">
              {activeFolderData?.name || "Inbox"}
            </div>
            <span className="text-xs text-owl-text-secondary">{filteredEmails.length} emails</span>
          </div>
          {filteredEmails.map((email) => (
            <button
              key={email.id}
              onClick={() => onSelect(email.id)}
              className={`w-full text-left p-3 rounded-lg transition-all mb-1 ${
                selectedId === email.id
                  ? "bg-owl-accent/20 border border-owl-accent/50"
                  : "hover:bg-owl-bg border border-transparent"
              } ${!email.read ? "bg-owl-bg/50" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                  !email.read ? "bg-owl-accent text-white" : "bg-owl-bg text-owl-text-secondary"
                }`}>
                  {getInitials(email.from.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm truncate ${!email.read ? "font-semibold text-owl-text" : "text-owl-text"}`}>
                      {email.from.name}
                    </span>
                    <span className="text-xs text-owl-text-secondary ml-2 shrink-0">{formatDate(email.date)}</span>
                  </div>
                  <div className={`text-sm truncate mb-1 ${!email.read ? "font-medium text-owl-text" : "text-owl-text-secondary"}`}>
                    {email.subject}
                  </div>
                  <div className="text-xs text-owl-text-secondary truncate">{email.preview}</div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {email.starred && <Icons.StarFilled />}
                  {email.hasAttachments && <Icons.Paperclip />}
                </div>
              </div>
            </button>
          ))}
          {filteredEmails.length === 0 && (
            <div className="text-center py-8 text-owl-text-secondary">
              <Icons.Mail />
              <p className="mt-2">Bu klasörde e-posta yok</p>
            </div>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="p-3 border-t border-owl-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-owl-accent rounded-full flex items-center justify-center text-white text-sm font-medium">
            BC
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-owl-text truncate">Berkan Çetinel</div>
            <div className="text-xs text-owl-text-secondary truncate">berkan@berkancetinel.com</div>
          </div>
          <button
            onClick={onSettingsClick}
            className="p-2 hover:bg-owl-surface-2 text-owl-text-secondary hover:text-owl-text rounded-lg transition-colors"
            title="Ayarlar"
          >
            <Icons.Settings />
          </button>
        </div>
      </div>
    </div>
  );
}

// Email View Component
function EmailView({
  email,
  showImages,
  isTrustedSender,
  onLoadImages,
  onTrustSender,
  onAIReply,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onToggleRead,
  summary,
  onSummarize,
  isSummarizing,
}: {
  email: Email | null;
  showImages: boolean;
  isTrustedSender: boolean;
  onLoadImages: () => void;
  onTrustSender: (email: string) => void;
  onAIReply: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  summary: string | null;
  onSummarize: () => void;
  isSummarizing: boolean;
}) {
  const [showSummary, setShowSummary] = useState(false);

  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-owl-bg">
        <div className="text-center">
          <div className="w-16 h-16 bg-owl-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icons.Mail />
          </div>
          <p className="text-owl-text-secondary">Select an email to read</p>
          <p className="text-sm text-owl-text-secondary mt-2">
            Press <kbd className="px-1.5 py-0.5 bg-owl-surface rounded text-xs">?</kbd> for shortcuts
          </p>
        </div>
      </div>
    );
  }

  const shouldShowImages = showImages || isTrustedSender;
  const hasHtmlContent = email.bodyHtml && email.hasImages;

  const sanitizedHtml = hasHtmlContent && !shouldShowImages
    ? email.bodyHtml!.replace(/<img[^>]*>/gi, '<div style="background: #1a1a24; padding: 20px; text-align: center; color: #71717a; border-radius: 8px; margin: 10px 0;">[Resim gizlendi]</div>')
    : email.bodyHtml;

  return (
    <div className="flex-1 flex flex-col bg-owl-bg">
      <div className="p-4 border-b border-owl-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-owl-accent rounded-full flex items-center justify-center text-white font-medium">
              {getInitials(email.from.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-owl-text">{email.from.name}</span>
                <span className="text-sm text-owl-text-secondary">&lt;{email.from.email}&gt;</span>
                {isTrustedSender && (
                  <span className="flex items-center gap-1 text-xs text-owl-success bg-owl-success/10 px-2 py-0.5 rounded-full">
                    <Icons.ShieldCheck />
                    Güvenilir
                  </span>
                )}
              </div>
              <div className="text-sm text-owl-text-secondary mt-0.5">To: {email.to.map(t => t.email).join(", ")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleStar}
              className={`p-2 rounded-lg transition-colors ${email.starred ? 'text-yellow-500' : 'text-owl-text-secondary hover:text-owl-text'}`}
              title={email.starred ? "Yıldızı kaldır (S)" : "Yıldızla (S)"}
            >
              {email.starred ? <Icons.StarFilled /> : <Icons.Star />}
            </button>
            <button
              onClick={onToggleRead}
              className="p-2 text-owl-text-secondary hover:text-owl-text rounded-lg transition-colors"
              title={email.read ? "Okunmadı işaretle (U)" : "Okundu işaretle (U)"}
            >
              {email.read ? <Icons.MailUnread /> : <Icons.MailOpen />}
            </button>
            <span className="text-sm text-owl-text-secondary">
              {email.date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-owl-text">{email.subject}</h1>
      </div>

      {/* Image Loading Banner */}
      {email.hasImages && !shouldShowImages && (
        <div className="mx-4 mt-4 p-3 bg-owl-surface rounded-lg border border-owl-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-owl-warning/20 rounded-lg flex items-center justify-center text-owl-warning">
              <Icons.Image />
            </div>
            <div>
              <p className="text-sm text-owl-text">Bu e-postada resimler var</p>
              <p className="text-xs text-owl-text-secondary">Gizlilik için resimler gizlendi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onLoadImages} className="text-sm px-3 py-1.5 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors">
              Resimleri Göster
            </button>
            <button onClick={() => onTrustSender(email.from.email)} className="text-sm px-3 py-1.5 bg-owl-surface-2 hover:bg-owl-border text-owl-text rounded-lg transition-colors">
              Her Zaman Göster
            </button>
          </div>
        </div>
      )}

      {/* Summary Section */}
      {(summary || isSummarizing) && (
        <div className="mx-4 mt-4 p-4 bg-owl-accent/10 border border-owl-accent/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-owl-accent">
              <Icons.Sparkles />
              <span className="font-medium">AI Özet</span>
            </div>
            <button onClick={() => setShowSummary(!showSummary)} className="text-owl-accent">
              {showSummary ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            </button>
          </div>
          {showSummary && (
            isSummarizing ? (
              <div className="flex items-center gap-2 text-owl-text-secondary">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Özetleniyor...</span>
              </div>
            ) : (
              <p className="text-sm text-owl-text">{summary}</p>
            )
          )}
        </div>
      )}

      {/* Trusted sender info */}
      {email.hasImages && isTrustedSender && (
        <div className="mx-4 mt-4 px-3 py-2 bg-owl-success/10 rounded-lg flex items-center gap-2 text-owl-success text-sm">
          <Icons.ShieldCheck />
          <span>Güvenilir gönderici - resimler otomatik yüklendi</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {hasHtmlContent ? (
          <div className="email-content text-owl-text leading-relaxed" dangerouslySetInnerHTML={{ __html: shouldShowImages ? email.bodyHtml! : sanitizedHtml! }} />
        ) : (
          <div className="whitespace-pre-wrap text-owl-text leading-relaxed">{email.body}</div>
        )}
      </div>

      <div className="p-4 border-t border-owl-border">
        <div className="flex items-center gap-2">
          <button onClick={onAIReply} className="flex items-center gap-2 px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors">
            <Icons.Sparkles />
            <span>AI Reply</span>
            <kbd className="text-xs bg-white/20 px-1.5 py-0.5 rounded ml-1">G</kbd>
          </button>
          <button onClick={onReply} className="flex items-center gap-2 px-4 py-2 bg-owl-surface hover:bg-owl-surface-2 text-owl-text rounded-lg transition-colors">
            <Icons.Reply />
            <span>Reply</span>
            <kbd className="text-xs bg-owl-bg px-1.5 py-0.5 rounded ml-1">R</kbd>
          </button>
          <button onClick={onReplyAll} className="flex items-center gap-2 px-3 py-2 bg-owl-surface hover:bg-owl-surface-2 text-owl-text rounded-lg transition-colors" title="Tümünü Yanıtla (A)">
            <Icons.ReplyAll />
          </button>
          <button onClick={onForward} className="flex items-center gap-2 px-3 py-2 bg-owl-surface hover:bg-owl-surface-2 text-owl-text rounded-lg transition-colors" title="İlet (F)">
            <Icons.Forward />
          </button>
          <div className="flex-1" />
          {email.body.length > 500 && !summary && (
            <button
              onClick={onSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-2 px-3 py-2 text-owl-accent hover:bg-owl-accent/10 rounded-lg transition-colors"
              title="AI ile özetle"
            >
              <Icons.Summarize />
              <span className="text-sm">Özetle</span>
            </button>
          )}
          <button onClick={onArchive} className="p-2 hover:bg-owl-surface-2 text-owl-text-secondary hover:text-owl-text rounded-lg transition-colors" title="Arşivle (E)">
            <Icons.Archive />
          </button>
          <button onClick={onDelete} className="p-2 hover:bg-owl-surface-2 text-owl-text-secondary hover:text-owl-error rounded-lg transition-colors" title="Sil (#)">
            <Icons.Trash />
          </button>
        </div>
      </div>
    </div>
  );
}

// Command Palette
function CommandPalette({ isOpen, onClose, onCommand }: { isOpen: boolean; onClose: () => void; onCommand: (cmd: string) => void }) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const commands = [
    { id: "compose", name: "Yeni E-posta", shortcut: "C", icon: <Icons.Plus /> },
    { id: "search", name: "Ara", shortcut: "/", icon: <Icons.Search /> },
    { id: "reply", name: "Yanıtla", shortcut: "R", icon: <Icons.Reply /> },
    { id: "replyAll", name: "Tümünü Yanıtla", shortcut: "A", icon: <Icons.ReplyAll /> },
    { id: "forward", name: "İlet", shortcut: "F", icon: <Icons.Forward /> },
    { id: "archive", name: "Arşivle", shortcut: "E", icon: <Icons.Archive /> },
    { id: "delete", name: "Sil", shortcut: "#", icon: <Icons.Trash /> },
    { id: "star", name: "Yıldızla", shortcut: "S", icon: <Icons.Star /> },
    { id: "markUnread", name: "Okunmadı İşaretle", shortcut: "U", icon: <Icons.MailUnread /> },
    { id: "aiReply", name: "AI Yanıt Oluştur", shortcut: "G", icon: <Icons.Sparkles /> },
    { id: "shortcuts", name: "Kısayol Yardımı", shortcut: "?", icon: <Icons.Command /> },
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
            placeholder="Komut ara..."
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
type Page = 'mail' | 'settings';
type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('mail');
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [emails, setEmails] = useState<Email[]>([]);  // Start empty - no mock data
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);

  // Modal states
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [aiReplyOpen, setAiReplyOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('new');
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Email states
  const [trustedSenders, setTrustedSenders] = useState<string[]>([]);
  const [loadedImageEmails, setLoadedImageEmails] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  // Check if user has any accounts configured
  const hasAccounts = accounts.length > 0;

  const currentEmail = emails.find((e) => e.id === selectedEmail) || null;
  const isTrustedSender = currentEmail ? trustedSenders.includes(currentEmail.from.email) : false;
  const showImages = selectedEmail ? loadedImageEmails.includes(selectedEmail) : false;

  // Get visible emails for navigation
  const visibleEmails = useMemo(() => {
    let result = emails;
    switch (activeFolder) {
      case "starred": result = result.filter(e => e.starred && !e.deleted); break;
      case "archive": result = result.filter(e => e.archived && !e.deleted); break;
      case "trash": result = result.filter(e => e.deleted); break;
      default: result = result.filter(e => !e.archived && !e.deleted);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.subject.toLowerCase().includes(query) ||
        e.from.name.toLowerCase().includes(query) ||
        e.body.toLowerCase().includes(query)
      );
    }
    return result;
  }, [emails, activeFolder, searchQuery]);

  // Email actions
  const handleToggleStar = useCallback(() => {
    if (!selectedEmail) return;
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, starred: !e.starred } : e));
  }, [selectedEmail]);

  const handleToggleRead = useCallback(() => {
    if (!selectedEmail) return;
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, read: !e.read } : e));
  }, [selectedEmail]);

  const handleArchive = useCallback(() => {
    if (!selectedEmail) return;
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, archived: true } : e));
    // Select next email
    const idx = visibleEmails.findIndex(e => e.id === selectedEmail);
    if (idx < visibleEmails.length - 1) setSelectedEmail(visibleEmails[idx + 1].id);
    else if (idx > 0) setSelectedEmail(visibleEmails[idx - 1].id);
    else setSelectedEmail(null);
  }, [selectedEmail, visibleEmails]);

  const handleDelete = useCallback(() => {
    if (!selectedEmail) return;
    setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, deleted: true } : e));
    const idx = visibleEmails.findIndex(e => e.id === selectedEmail);
    if (idx < visibleEmails.length - 1) setSelectedEmail(visibleEmails[idx + 1].id);
    else if (idx > 0) setSelectedEmail(visibleEmails[idx - 1].id);
    else setSelectedEmail(null);
  }, [selectedEmail, visibleEmails]);

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

  const handleSend = async (draft: DraftEmail) => {
    console.log("Sending email:", draft);
    // TODO: Implement actual send via SMTP
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleSaveDraft = async (draft: DraftEmail) => {
    console.log("Saving draft:", draft);
    // TODO: Implement draft saving
  };

  // Summarize
  const handleSummarize = useCallback(async () => {
    if (!currentEmail || summarizingId) return;
    setSummarizingId(currentEmail.id);
    try {
      const summary = await summarizeEmail(currentEmail.body);
      setSummaries(prev => ({ ...prev, [currentEmail.id]: summary }));
    } catch (err) {
      console.error("Summarize failed:", err);
    } finally {
      setSummarizingId(null);
    }
  }, [currentEmail, summarizingId]);

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
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
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

      // Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Single key shortcuts
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

  // Mark as read when selected
  useEffect(() => {
    if (selectedEmail) {
      const email = emails.find(e => e.id === selectedEmail);
      if (email && !email.read) {
        setTimeout(() => {
          setEmails(prev => prev.map(e => e.id === selectedEmail ? { ...e, read: true } : e));
        }, 2000);
      }
    }
  }, [selectedEmail, emails]);

  // Handle account added
  const handleAccountAdded = (account: Account) => {
    setAccounts(prev => [...prev, account]);
    setAddAccountModalOpen(false);
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
    return <Settings onBack={() => setCurrentPage('mail')} />;
  }

  return (
    <div className="h-screen flex bg-owl-bg">
      <MailPanel
        emails={emails}
        selectedId={selectedEmail}
        onSelect={setSelectedEmail}
        activeFolder={activeFolder}
        onFolderChange={setActiveFolder}
        onSettingsClick={() => setCurrentPage('settings')}
        onComposeClick={() => openCompose('new')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <EmailView
        email={currentEmail}
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
            emailContent={currentEmail.body}
            emailSubject={currentEmail.subject}
            senderName={currentEmail.from.name}
          />

          <Compose
            isOpen={composeOpen}
            onClose={() => setComposeOpen(false)}
            mode={composeMode}
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
          />
        </>
      )}

      {/* Compose for new email (no original) */}
      {!currentEmail && composeMode === 'new' && (
        <Compose
          isOpen={composeOpen}
          onClose={() => setComposeOpen(false)}
          mode="new"
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
        />
      )}

      <ShortcutsHelp isOpen={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />

      {/* Keyboard hint */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs text-owl-text-secondary bg-owl-surface px-3 py-2 rounded-lg border border-owl-border">
        <Icons.Command />
        <span>Press</span>
        <kbd className="px-1.5 py-0.5 bg-owl-bg rounded">?</kbd>
        <span>for shortcuts</span>
      </div>
    </div>
  );
}

export default App;
