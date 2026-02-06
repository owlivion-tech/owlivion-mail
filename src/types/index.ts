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
  attachments?: Attachment[];
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

// Draft list item (lightweight)
export interface DraftListItem {
  id: number;
  accountId: number;
  subject: string;
  toAddresses: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

// Draft detail (full data)
export interface DraftDetail {
  id: number;
  accountId: number;
  toAddresses: string;
  ccAddresses: string;
  bccAddresses: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  replyToEmailId?: number;
  forwardEmailId?: number;
  composeType: string;
  createdAt: string;
  updatedAt: string;
  attachments: {
    filename: string;
    contentType: string;
    size: number;
    localPath: string;
  }[];
}

// Attachment
export interface Attachment {
  id?: number;
  index: number;
  filename: string;
  contentType: string;
  size: number;
  localPath?: string;
  isInline: boolean;
  contentId?: string;
  _file?: File; // Temporary File object for upload
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
  acceptInvalidCerts?: boolean;
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
  acceptInvalidCerts?: boolean;
}

// Security type for connections
export type SecurityType = 'SSL' | 'STARTTLS' | 'NONE';

// Auto-detected email configuration (flat structure from Rust backend)
export interface AutoConfig {
  provider?: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: SecurityType;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: SecurityType;
  detectionMethod?: string;
}

// Folder from IMAP server
export interface ImapFolder {
  name: string;
  path: string;
  folder_type: FolderType;
  delimiter: string;
  is_subscribed: boolean;
  is_selectable: boolean;
  unread_count: number;
  total_count: number;
}

// Folder (legacy/local)
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

export type FolderType = 'Inbox' | 'Sent' | 'Drafts' | 'Trash' | 'Spam' | 'Archive' | 'Starred' | 'Custom' | 'All' | 'Junk';

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
  notificationSoundType: 'gentle' | 'pop' | 'chime' | 'ding' | 'subtle' | 'system' | 'owlivion' | 'whisper' | 'call' | 'moonlight';
  notificationBadge: boolean;

  // Behavior
  autoMarkRead: boolean;
  autoMarkReadDelay: number; // seconds
  confirmDelete: boolean;
  confirmSend: boolean;
  signaturePosition: 'top' | 'bottom';
  replyPosition: 'top' | 'bottom';
  closeToTray: boolean;

  // AI
  geminiApiKey?: string;
  aiAutoSummarize: boolean;
  aiReplyTone: 'professional' | 'friendly' | 'formal' | 'casual';

  // Shortcuts
  keyboardShortcutsEnabled: boolean;

  // Auto-Sync
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutes (1-60)
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
  notificationSoundType: 'call',
  notificationBadge: true,
  autoMarkRead: true,
  autoMarkReadDelay: 3,
  confirmDelete: true,
  confirmSend: false,
  signaturePosition: 'bottom',
  replyPosition: 'top',
  closeToTray: true,
  geminiApiKey: undefined,
  aiAutoSummarize: false,
  aiReplyTone: 'professional',
  keyboardShortcutsEnabled: true,
  autoSyncEnabled: false,
  autoSyncInterval: 5,
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
export type SettingsTab = 'accounts' | 'general' | 'ai' | 'shortcuts' | 'signatures' | 'sync';

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

// ============================================================================
// Sync Types
// ============================================================================

/// Sync configuration
export interface SyncConfig {
  enabled: boolean;
  userId?: string;
  deviceId: string;
  deviceName: string;
  platform: 'windows' | 'macos' | 'linux';
  lastSyncAt?: string; // ISO 8601
  syncAccounts: boolean;
  syncContacts: boolean;
  syncPreferences: boolean;
  syncSignatures: boolean;
}

/// Sync status for a data type
export interface SyncStatusItem {
  dataType: 'accounts' | 'contacts' | 'preferences' | 'signatures';
  version: number;
  lastSyncAt?: string; // ISO 8601
  status: 'idle' | 'syncing' | 'error';
}

/// Device information
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  lastSeenAt: string; // ISO 8601
}

/// Sync result (updated for conflict detection)
export interface SyncResult {
  accountsSynced: boolean;
  contactsSynced: boolean;
  preferencesSynced: boolean;
  signaturesSynced: boolean;
  errors: string[];
  conflicts?: ConflictInfo[]; // NEW: Detected conflicts
}

/// Conflict information for user resolution
export interface ConflictInfo {
  dataType: string;
  localVersion: number;
  serverVersion: number;
  localUpdatedAt?: string; // ISO 8601
  serverUpdatedAt?: string; // ISO 8601
  strategy: 'UseLocal' | 'UseServer' | 'Merge' | 'Manual';
  conflictDetails: string;
  localData: any; // JSON representation of local data
  serverData: any; // JSON representation of server data
}

/// Background scheduler configuration
export interface SchedulerConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastRun?: string; // ISO 8601
}

/// Background scheduler status
export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMinutes: number;
  lastRun?: string; // ISO 8601
  nextRun?: string; // ISO 8601 (calculated)
}

/// Sync snapshot (history entry)
export interface SyncSnapshot {
  id: number;
  dataType: string;
  version: number;
  snapshotHash: string;
  deviceId: string;
  operation: 'push' | 'pull' | 'merge';
  itemsCount: number;
  syncStatus: 'success' | 'failed' | 'conflict';
  errorMessage?: string;
  createdAt: string; // ISO 8601
}

/// Conflict information
export interface ConflictInfo {
  dataType: string;
  localVersion: number;
  serverVersion: number;
  localData: any;
  serverData: any;
  conflictDetails: string;
}

/// Sync impact estimation
export interface SyncImpactEstimate {
  accountsCount: number;
  accountsSizeBytes: number;
  contactsCount: number;
  contactsSizeBytes: number;
  preferencesCount: number;
  preferencesSizeBytes: number;
  signaturesCount: number;
  signaturesSizeBytes: number;
  totalSizeBytes: number;
}

/// Queue statistics
export interface QueueStats {
  pendingCount: number;
  inProgressCount: number;
  failedCount: number;
  completedCount: number;
  totalCount: number;
}

// ============================================================================
// Email Filtering Types
// ============================================================================

/// Email filter rule
export interface EmailFilter {
  id: number;
  accountId: number;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number;
  matchLogic: 'all' | 'any';
  conditions: FilterCondition[];
  actions: FilterAction[];
  matchedCount: number;
  lastMatchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/// New filter for creation
export interface NewEmailFilter {
  accountId: number;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number;
  matchLogic: 'all' | 'any';
  conditions: FilterCondition[];
  actions: FilterAction[];
}

/// Filter condition
export interface FilterCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

/// Email fields that can be filtered
export type ConditionField =
  | 'from'
  | 'to'
  | 'subject'
  | 'body'
  | 'has_attachment';

/// Comparison operators
export type ConditionOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with';

/// Filter action
export interface FilterAction {
  action: FilterActionType;
  folderId?: number;
  label?: string;
}

/// Types of filter actions
export type FilterActionType =
  | 'move_to_folder'
  | 'add_label'
  | 'mark_as_read'
  | 'mark_as_starred'
  | 'mark_as_spam'
  | 'delete'
  | 'archive';

/// Helper to create filter conditions
export const createCondition = (
  field: ConditionField,
  operator: ConditionOperator,
  value: string
): FilterCondition => ({ field, operator, value });

/// Filter template for quick setup
export interface FilterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'spam' | 'promotions' | 'social' | 'newsletters' | 'work' | 'organization' | 'custom';
  icon: string; // emoji
  conditions: FilterCondition[];
  actions: FilterAction[];
  priority: number;
}

/// Helper to create filter actions
export const createAction = {
  moveToFolder: (folderId: number): FilterAction => ({
    action: 'move_to_folder',
    folderId,
  }),
  addLabel: (label: string): FilterAction => ({
    action: 'add_label',
    label,
  }),
  markAsRead: (): FilterAction => ({
    action: 'mark_as_read',
  }),
  markAsStarred: (): FilterAction => ({
    action: 'mark_as_starred',
  }),
  markAsSpam: (): FilterAction => ({
    action: 'mark_as_spam',
  }),
  delete: (): FilterAction => ({
    action: 'delete',
  }),
  archive: (): FilterAction => ({
    action: 'archive',
  }),
};
