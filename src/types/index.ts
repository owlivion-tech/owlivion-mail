// ============================================================================
// Owlivion Mail - TypeScript Type Definitions
// ============================================================================

// Email address with optional display name
export interface EmailAddress {
  email: string;
  name?: string;
}

// Email message
export interface Email {
  id: number;
  accountId: number;
  folderId: number;
  messageId: string;
  uid: number;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo?: string;
  subject: string;
  preview: string;
  bodyText?: string;
  bodyHtml?: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  isDeleted: boolean;
  isSpam: boolean;
  isDraft: boolean;
  isAnswered: boolean;
  isForwarded: boolean;
  hasAttachments: boolean;
  hasInlineImages: boolean;
  threadId?: string;
  inReplyTo?: string;
  priority: number;
  labels: string[];
}

// Email summary for list view
export interface EmailSummary {
  id: number;
  messageId: string;
  uid: number;
  fromAddress: string;
  fromName?: string;
  subject: string;
  preview: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  hasInlineImages: boolean;
}

// Draft email for composing
export interface DraftEmail {
  id?: number;
  accountId: number;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
  replyToEmailId?: number;
  forwardEmailId?: number;
  composeType: 'new' | 'reply' | 'replyAll' | 'forward';
}

// Attachment
export interface Attachment {
  id?: number;
  filename: string;
  contentType: string;
  size: number;
  localPath?: string;
  isInline: boolean;
  contentId?: string;
}

// Email account
export interface Account {
  id: number;
  email: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: SecurityType;
  imapUsername?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: SecurityType;
  smtpUsername?: string;
  oauthProvider?: 'gmail' | 'outlook';
  isActive: boolean;
  isDefault: boolean;
  signature: string;
  syncDays: number;
  createdAt: string;
  updatedAt: string;
}

// New account for adding
export interface NewAccount {
  email: string;
  displayName: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: SecurityType;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: SecurityType;
  oauthProvider?: 'gmail' | 'outlook';
  signature?: string;
}

// Security type for connections
export type SecurityType = 'SSL' | 'TLS' | 'STARTTLS' | 'NONE';

// Auto-detected email configuration
export interface AutoConfig {
  provider?: string;
  displayName?: string;
  imap: {
    host: string;
    port: number;
    security: SecurityType;
  };
  smtp: {
    host: string;
    port: number;
    security: SecurityType;
  };
}

// Folder
export interface Folder {
  id: number;
  accountId: number;
  name: string;
  remoteName: string;
  folderType: FolderType;
  unreadCount: number;
  totalCount: number;
  isSubscribed: boolean;
  isSelectable: boolean;
}

export type FolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'starred' | 'custom';

// Trusted sender
export interface TrustedSender {
  id: number;
  email: string;
  domain?: string;
  trustedAt: string;
}

// Contact
export interface Contact {
  id: number;
  accountId?: number;
  email: string;
  name?: string;
  avatarUrl?: string;
  company?: string;
  phone?: string;
  notes?: string;
  isFavorite: boolean;
  emailCount: number;
  lastEmailedAt?: string;
}

// App settings
export interface Settings {
  // Appearance
  theme: 'dark' | 'light' | 'system';
  language: 'tr' | 'en';
  compactListView: boolean;
  showAvatars: boolean;
  conversationView: boolean;

  // Notifications
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notificationBadge: boolean;

  // Behavior
  autoMarkRead: boolean;
  autoMarkReadDelay: number; // seconds
  confirmDelete: boolean;
  confirmSend: boolean;
  signaturePosition: 'top' | 'bottom';
  replyPosition: 'top' | 'bottom';

  // AI
  geminiApiKey?: string;
  aiAutoSummarize: boolean;
  aiReplyTone: 'professional' | 'friendly' | 'formal' | 'casual';

  // Shortcuts
  keyboardShortcutsEnabled: boolean;
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'tr',
  compactListView: false,
  showAvatars: true,
  conversationView: true,
  notificationsEnabled: true,
  notificationSound: true,
  notificationBadge: true,
  autoMarkRead: true,
  autoMarkReadDelay: 3,
  confirmDelete: true,
  confirmSend: false,
  signaturePosition: 'bottom',
  replyPosition: 'top',
  geminiApiKey: undefined,
  aiAutoSummarize: false,
  aiReplyTone: 'professional',
  keyboardShortcutsEnabled: true,
};

// Sync status
export type SyncStatus = 'idle' | 'syncing' | 'error';

// Connection status
export interface ConnectionStatus {
  accountId: number;
  isConnected: boolean;
  lastSyncAt?: string;
  error?: string;
}

// Compose modal props
export interface ComposeProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  originalEmail?: Email;
  onSend: (email: DraftEmail) => Promise<void>;
  onSaveDraft: (email: DraftEmail) => Promise<void>;
  defaultAccount?: Account;
}

// Settings page tab
export type SettingsTab = 'accounts' | 'general' | 'ai' | 'shortcuts';

// AI Reply request
export interface AIReplyRequest {
  emailContent: string;
  tone: Settings['aiReplyTone'];
  language: 'tr' | 'en';
  context?: string; // Thread context
}

// AI Reply response
export interface AIReplyResponse {
  reply: string;
  summary?: string;
  actionItems?: string[];
}

// Keyboard shortcut definition
export interface ShortcutDefinition {
  key: string;
  description: string;
  category: 'navigation' | 'actions' | 'compose' | 'search' | 'ai' | 'help';
}

// Command palette command
export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
}

// Toast notification
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Search filters
export interface SearchFilters {
  query: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  dateFrom?: string;
  dateTo?: string;
  folder?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
