package com.owlivion.mail.core

/**
 * Platform-agnostic bridge to Rust owlivion-core via UniFFI.
 * Expect declarations - actual implementations per platform.
 */

// Data classes matching Rust OwlivionCore DTOs

data class AccountConfig(
    val email: String,
    val displayName: String,
    val password: String,
    val imapHost: String,
    val imapPort: Int,
    val imapSecurity: String,
    val smtpHost: String,
    val smtpPort: Int,
    val smtpSecurity: String,
    val isDefault: Boolean = false,
    val acceptInvalidCerts: Boolean = false,
    val oauthProvider: String? = null,
)

data class Account(
    val id: Long,
    val email: String,
    val displayName: String,
    val imapHost: String,
    val imapPort: Int,
    val imapSecurity: String,
    val imapUsername: String?,
    val smtpHost: String,
    val smtpPort: Int,
    val smtpSecurity: String,
    val smtpUsername: String?,
    val oauthProvider: String?,
    val isActive: Boolean,
    val isDefault: Boolean,
    val signature: String,
    val syncDays: Int,
    val acceptInvalidCerts: Boolean,
    val enablePriorityFetch: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

data class AutoConfigResult(
    val provider: String?,
    val displayName: String?,
    val imapHost: String,
    val imapPort: Int,
    val imapSecurity: String,
    val smtpHost: String,
    val smtpPort: Int,
    val smtpSecurity: String,
    val detectionMethod: String?,
)

data class EmailSummary(
    val uid: Long,
    val messageId: String?,
    val from: String,
    val fromName: String?,
    val subject: String,
    val preview: String,
    val date: String,
    val isRead: Boolean,
    val isStarred: Boolean,
    val hasAttachments: Boolean,
    val accountId: String? = null,
    val accountEmail: String? = null,
    val accountName: String? = null,
    val accountColor: String? = null,
)

data class FetchResult(
    val emails: List<EmailSummary>,
    val total: Int,
    val hasMore: Boolean,
)

data class Folder(
    val name: String,
    val path: String,
    val folderType: String,
    val delimiter: String,
    val isSubscribed: Boolean,
    val isSelectable: Boolean,
    val unreadCount: Int,
    val totalCount: Int,
)

data class ParsedEmail(
    val uid: Long,
    val messageId: String?,
    val from: String,
    val fromName: String?,
    val to: List<String>,
    val cc: List<String>,
    val subject: String,
    val date: String,
    val bodyText: String?,
    val bodyHtml: String?,
    val isRead: Boolean,
    val isStarred: Boolean,
    val attachments: List<AttachmentInfo>,
)

data class AttachmentInfo(
    val filename: String,
    val contentType: String,
    val size: Long,
    val index: Long,
    val contentId: String?,
    val isInline: Boolean,
)

data class DbEmailSummary(
    val id: Long,
    val messageId: String,
    val uid: Long,
    val fromAddress: String,
    val fromName: String?,
    val subject: String,
    val preview: String,
    val date: String,
    val isRead: Boolean,
    val isStarred: Boolean,
    val hasAttachments: Boolean,
    val hasInlineImages: Boolean,
)

data class SendAttachment(
    val path: String,
    val filename: String,
    val contentType: String,
)

data class EmailFilter(
    val id: Long,
    val accountId: Long,
    val name: String,
    val description: String?,
    val isEnabled: Boolean,
    val priority: Int,
    val matchLogic: String,
    val conditionsJson: String,
    val actionsJson: String,
    val matchedCount: Int,
    val lastMatchedAt: String?,
    val createdAt: String,
    val updatedAt: String,
)

data class EmailTemplate(
    val id: Long,
    val accountId: Long?,
    val name: String,
    val description: String?,
    val category: String,
    val subjectTemplate: String,
    val bodyHtmlTemplate: String,
    val bodyTextTemplate: String?,
    val tagsJson: String,
    val isEnabled: Boolean,
    val isFavorite: Boolean,
    val usageCount: Long,
    val lastUsedAt: String?,
    val createdAt: String,
    val updatedAt: String,
)

// Sync data classes

data class SyncResult(
    val accountsSynced: Boolean,
    val contactsSynced: Boolean,
    val preferencesSynced: Boolean,
    val signaturesSynced: Boolean,
    val errors: List<String>,
    val conflictsJson: String,
)

data class SyncConfig(
    val enabled: Boolean,
    val userId: String?,
    val deviceId: String,
    val deviceName: String,
    val platform: String,
    val lastSyncAt: String?,
    val syncAccounts: Boolean,
    val syncContacts: Boolean,
    val syncPreferences: Boolean,
    val syncSignatures: Boolean,
)

data class SyncStatus(
    val dataType: String,
    val version: Int,
    val lastSyncAt: String?,
    val status: String,
)

data class DeviceInfo(
    val deviceId: String,
    val deviceName: String,
    val platform: String,
    val lastSeenAt: String,
    val createdAt: String,
)

data class QueueStats(
    val pendingCount: Int,
    val inProgressCount: Int,
    val failedCount: Int,
    val completedCount: Int,
    val totalCount: Int,
)

data class SyncSnapshot(
    val id: Long,
    val dataType: String,
    val version: Long,
    val snapshotHash: String,
    val deviceId: String,
    val operation: String,
    val itemsCount: Int,
    val syncStatus: String,
    val errorMessage: String?,
    val createdAt: String,
)

data class SchedulerStatus(
    val enabled: Boolean,
    val running: Boolean,
    val intervalMinutes: Long,
    val lastRun: String?,
    val nextRun: String?,
)

// OAuth data classes

data class OAuthStartResult(
    val authUrl: String,
    val csrfState: String,
)

data class OAuthCompleteResult(
    val email: String,
    val displayName: String?,
    val accessToken: String,
    val refreshToken: String?,
    val imapHost: String,
    val imapPort: Int,
    val smtpHost: String,
    val smtpPort: Int,
)

data class Label(
    val id: Long,
    val accountId: Long?,
    val name: String,
    val color: String,
    val sortOrder: Int,
    val createdAt: String,
    val updatedAt: String,
)

data class EmailAlias(
    val id: Long,
    val accountId: Long,
    val aliasEmail: String,
    val aliasName: String?,
    val isDefault: Boolean,
    val isEnabled: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * Bridge interface - expect/actual pattern for KMP.
 * Android: UniFFI generated Kotlin bindings
 * iOS: UniFFI generated Swift bindings via cinterop
 */
expect class OwlivionBridge() {
    // Lifecycle
    suspend fun initialize(dataDir: String, cacheDir: String)
    fun destroy()

    // Account Management
    suspend fun autoconfigDetect(email: String): AutoConfigResult
    suspend fun accountTestImap(host: String, port: Int, security: String, email: String, password: String)
    suspend fun accountTestSmtp(host: String, port: Int, security: String, email: String, password: String)
    suspend fun accountAdd(config: AccountConfig): String
    suspend fun accountList(): List<Account>
    suspend fun accountConnect(accountId: String)
    suspend fun accountDelete(accountId: String)

    // Email Operations
    suspend fun folderList(accountId: String): List<Folder>
    suspend fun emailList(accountId: String, folder: String?, page: Int, pageSize: Int): FetchResult
    suspend fun emailGet(accountId: String, uid: Long, folder: String?): ParsedEmail
    suspend fun emailMarkRead(accountId: String, uid: Long, read: Boolean, folder: String?)
    suspend fun emailMarkStarred(accountId: String, uid: Long, starred: Boolean, folder: String?)
    suspend fun emailMove(accountId: String, uid: Long, targetFolder: String, folder: String?)
    suspend fun emailDelete(accountId: String, uid: Long, permanent: Boolean, folder: String?)
    suspend fun emailSearch(accountId: String, query: String): List<DbEmailSummary>

    // Send Email
    suspend fun emailSend(
        accountId: String,
        to: List<String>,
        cc: List<String>,
        bcc: List<String>,
        subject: String,
        bodyText: String?,
        bodyHtml: String?,
        attachments: List<SendAttachment>,
    )

    // Filter Operations
    suspend fun filterList(accountId: Long): List<EmailFilter>
    suspend fun filterGet(filterId: Long): EmailFilter
    suspend fun filterAdd(
        accountId: Long,
        name: String,
        description: String?,
        isEnabled: Boolean,
        priority: Int,
        matchLogic: String,
        conditionsJson: String,
        actionsJson: String,
    ): Long

    suspend fun filterUpdate(
        filterId: Long,
        accountId: Long,
        name: String,
        description: String?,
        isEnabled: Boolean,
        priority: Int,
        matchLogic: String,
        conditionsJson: String,
        actionsJson: String,
    )

    suspend fun filterDelete(filterId: Long)
    suspend fun filterToggle(filterId: Long)

    // Template Operations
    suspend fun templateList(accountId: Long): List<EmailTemplate>
    suspend fun templateGet(templateId: Long): EmailTemplate
    suspend fun templateAdd(
        accountId: Long?,
        name: String,
        description: String?,
        category: String,
        subjectTemplate: String,
        bodyHtmlTemplate: String,
        bodyTextTemplate: String?,
        tagsJson: String,
        isEnabled: Boolean,
        isFavorite: Boolean,
    ): Long

    suspend fun templateUpdate(
        templateId: Long,
        accountId: Long?,
        name: String,
        description: String?,
        category: String,
        subjectTemplate: String,
        bodyHtmlTemplate: String,
        bodyTextTemplate: String?,
        tagsJson: String,
        isEnabled: Boolean,
        isFavorite: Boolean,
    )

    suspend fun templateDelete(templateId: Long)
    suspend fun templateToggle(templateId: Long)
    suspend fun templateToggleFavorite(templateId: Long)
    suspend fun templateIncrementUsage(templateId: Long)
    suspend fun templateSearch(accountId: Long, query: String, limit: Int): List<EmailTemplate>

    // Sync Operations
    suspend fun syncRegister(email: String, password: String, masterPassword: String)
    suspend fun syncLogin(email: String, password: String)
    suspend fun syncLogout()
    suspend fun syncStart(masterPassword: String): SyncResult
    suspend fun syncGetConfig(): SyncConfig
    suspend fun syncGetStatus(): List<SyncStatus>
    suspend fun syncListDevices(): List<DeviceInfo>
    suspend fun syncRevokeDevice(deviceId: String)
    fun syncGetQueueStats(): QueueStats
    fun syncRetryFailed(): Int
    fun syncClearCompletedQueue(olderThanDays: Int): Int
    fun syncClearFailedQueue(): Int
    suspend fun syncGetHistory(dataType: String, limit: Int): List<SyncSnapshot>

    // Scheduler Operations
    suspend fun schedulerStart()
    suspend fun schedulerStop()
    suspend fun schedulerGetStatus(): SchedulerStatus

    // OAuth Operations
    fun oauthStartFlow(provider: String): OAuthStartResult
    suspend fun oauthHandleCallback(provider: String, authorizationCode: String, csrfState: String): OAuthCompleteResult

    // Label Operations
    fun labelCreate(accountId: Long?, name: String, color: String): Label
    fun labelList(accountId: Long?): List<Label>
    fun labelUpdate(id: Long, name: String?, color: String?): Label
    fun labelDelete(id: Long)
    fun emailAddLabel(emailId: Long, labelId: Long)
    fun emailRemoveLabel(emailId: Long, labelId: Long)
    fun emailGetLabels(emailId: Long): List<Label>
    fun labelGetEmailIds(labelId: Long): List<Long>

    // Alias Operations
    fun aliasAdd(accountId: Long, aliasEmail: String, aliasName: String?): Long
    fun aliasList(accountId: Long): List<EmailAlias>
    fun aliasUpdate(aliasId: Long, aliasEmail: String?, aliasName: String?)
    fun aliasDelete(aliasId: Long)
    fun aliasToggle(aliasId: Long)
    fun aliasSetDefault(aliasId: Long, accountId: Long)
}
