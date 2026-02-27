package com.owlivion.mail.core

import uniffi.owlivion_core.FfiOwlivionCore
import uniffi.owlivion_core.FfiCoreConfig
import uniffi.owlivion_core.FfiAccount
import uniffi.owlivion_core.FfiAutoConfig
import uniffi.owlivion_core.FfiFolder
import uniffi.owlivion_core.FfiFetchResult
import uniffi.owlivion_core.FfiMailEmailSummary
import uniffi.owlivion_core.FfiParsedEmail
import uniffi.owlivion_core.FfiEmailAttachment
import uniffi.owlivion_core.FfiDbEmailSummary
import uniffi.owlivion_core.FfiEmailFilter
import uniffi.owlivion_core.FfiEmailTemplate
import uniffi.owlivion_core.FfiSyncResult
import uniffi.owlivion_core.FfiSyncConfig
import uniffi.owlivion_core.FfiSyncStatus
import uniffi.owlivion_core.FfiDeviceInfo
import uniffi.owlivion_core.FfiQueueStats
import uniffi.owlivion_core.FfiSyncSnapshot
import uniffi.owlivion_core.FfiSchedulerStatus
import uniffi.owlivion_core.FfiOAuthStartResult
import uniffi.owlivion_core.FfiOAuthCompleteResult
import uniffi.owlivion_core.FfiLabel
import uniffi.owlivion_core.FfiEmailAlias

/**
 * Android actual implementation of OwlivionBridge.
 * Uses UniFFI-generated Kotlin bindings to call Rust owlivion-core.
 */
actual class OwlivionBridge actual constructor() {

    private var core: FfiOwlivionCore? = null

    actual suspend fun initialize(dataDir: String, cacheDir: String) {
        System.loadLibrary("owlivion_core")
        core = FfiOwlivionCore(FfiCoreConfig(dataDir, cacheDir))
    }

    actual fun destroy() {
        core?.close()
        core = null
    }

    // --- Account Management ---

    actual suspend fun autoconfigDetect(email: String): AutoConfigResult {
        val result = requireCore().autoconfigDetect(email)
        return result.toCommon()
    }

    actual suspend fun accountTestImap(
        host: String, port: Int, security: String, email: String, password: String
    ) {
        requireCore().accountTestImap(host, port.toUShort(), security, email, password)
    }

    actual suspend fun accountTestSmtp(
        host: String, port: Int, security: String, email: String, password: String
    ) {
        requireCore().accountTestSmtp(host, port.toUShort(), security, email, password)
    }

    actual suspend fun accountAdd(config: AccountConfig): String {
        return requireCore().accountAdd(
            email = config.email,
            displayName = config.displayName,
            password = config.password,
            imapHost = config.imapHost,
            imapPort = config.imapPort.toUShort(),
            imapSecurity = config.imapSecurity,
            smtpHost = config.smtpHost,
            smtpPort = config.smtpPort.toUShort(),
            smtpSecurity = config.smtpSecurity,
            isDefault = config.isDefault,
            acceptInvalidCerts = config.acceptInvalidCerts,
            oauthProvider = config.oauthProvider,
        )
    }

    actual suspend fun accountList(): List<Account> {
        return requireCore().accountList().map { it.toCommon() }
    }

    actual suspend fun accountConnect(accountId: String) {
        requireCore().accountConnect(accountId)
    }

    actual suspend fun accountDelete(accountId: String) {
        requireCore().accountDelete(accountId)
    }

    // --- Email Operations ---

    actual suspend fun folderList(accountId: String): List<Folder> {
        return requireCore().folderList(accountId).map { it.toCommon() }
    }

    actual suspend fun emailList(
        accountId: String, folder: String?, page: Int, pageSize: Int
    ): FetchResult {
        val result = requireCore().emailList(accountId, folder, page.toUInt(), pageSize.toUInt())
        return result.toCommon()
    }

    actual suspend fun emailGet(accountId: String, uid: Long, folder: String?): ParsedEmail {
        val result = requireCore().emailGet(accountId, uid.toUInt(), folder)
        return result.toCommon()
    }

    actual suspend fun emailMarkRead(
        accountId: String, uid: Long, read: Boolean, folder: String?
    ) {
        requireCore().emailMarkRead(accountId, uid.toUInt(), read, folder)
    }

    actual suspend fun emailMarkStarred(
        accountId: String, uid: Long, starred: Boolean, folder: String?
    ) {
        requireCore().emailMarkStarred(accountId, uid.toUInt(), starred, folder)
    }

    actual suspend fun emailMove(
        accountId: String, uid: Long, targetFolder: String, folder: String?
    ) {
        requireCore().emailMove(accountId, uid.toUInt(), targetFolder, folder)
    }

    actual suspend fun emailDelete(
        accountId: String, uid: Long, permanent: Boolean, folder: String?
    ) {
        requireCore().emailDelete(accountId, uid.toUInt(), permanent, folder)
    }

    actual suspend fun emailSearch(accountId: String, query: String): List<DbEmailSummary> {
        return requireCore().emailSearch(accountId, query).map { it.toCommon() }
    }

    // --- Send Email ---

    actual suspend fun emailSend(
        accountId: String,
        to: List<String>,
        cc: List<String>,
        bcc: List<String>,
        subject: String,
        bodyText: String?,
        bodyHtml: String?,
        attachments: List<SendAttachment>,
    ) {
        val ffiAttachments = attachments.map {
            uniffi.owlivion_core.FfiAttachmentPath(
                path = it.path,
                filename = it.filename,
                contentType = it.contentType,
            )
        }
        requireCore().emailSend(
            accountId, to, cc, bcc, subject, bodyText, bodyHtml, ffiAttachments,
        )
    }

    // --- Filter Operations ---

    actual suspend fun filterList(accountId: Long): List<EmailFilter> {
        return requireCore().filterList(accountId).map { it.toCommon() }
    }

    actual suspend fun filterGet(filterId: Long): EmailFilter {
        return requireCore().filterGet(filterId).toCommon()
    }

    actual suspend fun filterAdd(
        accountId: Long,
        name: String,
        description: String?,
        isEnabled: Boolean,
        priority: Int,
        matchLogic: String,
        conditionsJson: String,
        actionsJson: String,
    ): Long {
        return requireCore().filterAdd(
            accountId, name, description, isEnabled, priority, matchLogic, conditionsJson, actionsJson,
        )
    }

    actual suspend fun filterUpdate(
        filterId: Long,
        accountId: Long,
        name: String,
        description: String?,
        isEnabled: Boolean,
        priority: Int,
        matchLogic: String,
        conditionsJson: String,
        actionsJson: String,
    ) {
        requireCore().filterUpdate(
            filterId, accountId, name, description, isEnabled, priority, matchLogic, conditionsJson, actionsJson,
        )
    }

    actual suspend fun filterDelete(filterId: Long) {
        requireCore().filterDelete(filterId)
    }

    actual suspend fun filterToggle(filterId: Long) {
        requireCore().filterToggle(filterId)
    }

    // --- Template Operations ---

    actual suspend fun templateList(accountId: Long): List<EmailTemplate> {
        return requireCore().templateList(accountId).map { it.toCommon() }
    }

    actual suspend fun templateGet(templateId: Long): EmailTemplate {
        return requireCore().templateGet(templateId).toCommon()
    }

    actual suspend fun templateAdd(
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
    ): Long {
        return requireCore().templateAdd(
            accountId, name, description, category, subjectTemplate, bodyHtmlTemplate,
            bodyTextTemplate, tagsJson, isEnabled, isFavorite,
        )
    }

    actual suspend fun templateUpdate(
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
    ) {
        requireCore().templateUpdate(
            templateId, accountId, name, description, category, subjectTemplate,
            bodyHtmlTemplate, bodyTextTemplate, tagsJson, isEnabled, isFavorite,
        )
    }

    actual suspend fun templateDelete(templateId: Long) {
        requireCore().templateDelete(templateId)
    }

    actual suspend fun templateToggle(templateId: Long) {
        requireCore().templateToggle(templateId)
    }

    actual suspend fun templateToggleFavorite(templateId: Long) {
        requireCore().templateToggleFavorite(templateId)
    }

    actual suspend fun templateIncrementUsage(templateId: Long) {
        requireCore().templateIncrementUsage(templateId)
    }

    actual suspend fun templateSearch(accountId: Long, query: String, limit: Int): List<EmailTemplate> {
        return requireCore().templateSearch(accountId, query, limit).map { it.toCommon() }
    }

    // --- Sync Operations ---

    actual suspend fun syncRegister(email: String, password: String, masterPassword: String) {
        requireCore().syncRegister(email, password, masterPassword)
    }

    actual suspend fun syncLogin(email: String, password: String) {
        requireCore().syncLogin(email, password)
    }

    actual suspend fun syncLogout() {
        requireCore().syncLogout()
    }

    actual suspend fun syncStart(masterPassword: String): SyncResult {
        return requireCore().syncStart(masterPassword).toCommon()
    }

    actual suspend fun syncGetConfig(): SyncConfig {
        return requireCore().syncGetConfig().toCommon()
    }

    actual suspend fun syncGetStatus(): List<SyncStatus> {
        return requireCore().syncGetStatus().map { it.toCommon() }
    }

    actual suspend fun syncListDevices(): List<DeviceInfo> {
        return requireCore().syncListDevices().map { it.toCommon() }
    }

    actual suspend fun syncRevokeDevice(deviceId: String) {
        requireCore().syncRevokeDevice(deviceId)
    }

    actual fun syncGetQueueStats(): QueueStats {
        return requireCore().syncGetQueueStats().toCommon()
    }

    actual fun syncRetryFailed(): Int {
        return requireCore().syncRetryFailed()
    }

    actual fun syncClearCompletedQueue(olderThanDays: Int): Int {
        return requireCore().syncClearCompletedQueue(olderThanDays)
    }

    actual fun syncClearFailedQueue(): Int {
        return requireCore().syncClearFailedQueue()
    }

    actual suspend fun syncGetHistory(dataType: String, limit: Int): List<SyncSnapshot> {
        return requireCore().syncGetHistory(dataType, limit).map { it.toCommon() }
    }

    // --- Scheduler Operations ---

    actual suspend fun schedulerStart() {
        requireCore().schedulerStart()
    }

    actual suspend fun schedulerStop() {
        requireCore().schedulerStop()
    }

    actual suspend fun schedulerGetStatus(): SchedulerStatus {
        return requireCore().schedulerGetStatus().toCommon()
    }

    // --- OAuth Operations ---

    actual fun oauthStartFlow(provider: String): OAuthStartResult {
        return requireCore().oauthStartFlow(provider).toCommon()
    }

    actual suspend fun oauthHandleCallback(
        provider: String,
        authorizationCode: String,
        csrfState: String,
    ): OAuthCompleteResult {
        return requireCore().oauthHandleCallback(provider, authorizationCode, csrfState).toCommon()
    }

    // --- Label Operations ---

    actual fun labelCreate(accountId: Long?, name: String, color: String): Label {
        return requireCore().labelCreate(accountId, name, color).toCommon()
    }

    actual fun labelList(accountId: Long?): List<Label> {
        return requireCore().labelList(accountId).map { it.toCommon() }
    }

    actual fun labelUpdate(id: Long, name: String?, color: String?): Label {
        return requireCore().labelUpdate(id, name, color).toCommon()
    }

    actual fun labelDelete(id: Long) {
        requireCore().labelDelete(id)
    }

    actual fun emailAddLabel(emailId: Long, labelId: Long) {
        requireCore().emailAddLabel(emailId, labelId)
    }

    actual fun emailRemoveLabel(emailId: Long, labelId: Long) {
        requireCore().emailRemoveLabel(emailId, labelId)
    }

    actual fun emailGetLabels(emailId: Long): List<Label> {
        return requireCore().emailGetLabels(emailId).map { it.toCommon() }
    }

    actual fun labelGetEmailIds(labelId: Long): List<Long> {
        return requireCore().labelGetEmailIds(labelId)
    }

    // --- Alias Operations ---

    actual fun aliasAdd(accountId: Long, aliasEmail: String, aliasName: String?): Long {
        return requireCore().aliasAdd(accountId, aliasEmail, aliasName)
    }

    actual fun aliasList(accountId: Long): List<EmailAlias> {
        return requireCore().aliasList(accountId).map { it.toCommon() }
    }

    actual fun aliasUpdate(aliasId: Long, aliasEmail: String?, aliasName: String?) {
        requireCore().aliasUpdate(aliasId, aliasEmail, aliasName)
    }

    actual fun aliasDelete(aliasId: Long) {
        requireCore().aliasDelete(aliasId)
    }

    actual fun aliasToggle(aliasId: Long) {
        requireCore().aliasToggle(aliasId)
    }

    actual fun aliasSetDefault(aliasId: Long, accountId: Long) {
        requireCore().aliasSetDefault(aliasId, accountId)
    }

    // --- Helpers ---

    private fun requireCore(): FfiOwlivionCore {
        return core ?: throw IllegalStateException("OwlivionBridge not initialized. Call initialize() first.")
    }
}

// ============================================================================
// Extension functions: UniFFI types -> Common bridge types
// ============================================================================

private fun FfiAutoConfig.toCommon() = AutoConfigResult(
    provider = provider,
    displayName = displayName,
    imapHost = imapHost,
    imapPort = imapPort.toInt(),
    imapSecurity = imapSecurity,
    smtpHost = smtpHost,
    smtpPort = smtpPort.toInt(),
    smtpSecurity = smtpSecurity,
    detectionMethod = detectionMethod,
)

private fun FfiAccount.toCommon() = Account(
    id = id,
    email = email,
    displayName = displayName,
    imapHost = imapHost,
    imapPort = imapPort,
    imapSecurity = imapSecurity,
    imapUsername = imapUsername,
    smtpHost = smtpHost,
    smtpPort = smtpPort,
    smtpSecurity = smtpSecurity,
    smtpUsername = smtpUsername,
    oauthProvider = oauthProvider,
    isActive = isActive,
    isDefault = isDefault,
    signature = signature,
    syncDays = syncDays,
    acceptInvalidCerts = acceptInvalidCerts,
    enablePriorityFetch = enablePriorityFetch,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

private fun FfiFolder.toCommon() = Folder(
    name = name,
    path = path,
    folderType = folderType,
    delimiter = delimiter,
    isSubscribed = isSubscribed,
    isSelectable = isSelectable,
    unreadCount = unreadCount.toInt(),
    totalCount = totalCount.toInt(),
)

private fun FfiMailEmailSummary.toCommon() = EmailSummary(
    uid = uid.toLong(),
    messageId = messageId,
    from = from,
    fromName = fromName,
    subject = subject,
    preview = preview,
    date = date,
    isRead = isRead,
    isStarred = isStarred,
    hasAttachments = hasAttachments,
    accountId = accountId,
    accountEmail = accountEmail,
    accountName = accountName,
    accountColor = accountColor,
)

private fun FfiFetchResult.toCommon() = FetchResult(
    emails = emails.map { it.toCommon() },
    total = total.toInt(),
    hasMore = hasMore,
)

private fun FfiEmailAttachment.toCommon() = AttachmentInfo(
    filename = filename,
    contentType = contentType,
    size = size.toLong(),
    index = index.toLong(),
    contentId = contentId,
    isInline = isInline,
)

private fun FfiParsedEmail.toCommon() = ParsedEmail(
    uid = uid.toLong(),
    messageId = messageId,
    from = from,
    fromName = fromName,
    to = to,
    cc = cc,
    subject = subject,
    date = date,
    bodyText = bodyText,
    bodyHtml = bodyHtml,
    isRead = isRead,
    isStarred = isStarred,
    attachments = attachments.map { it.toCommon() },
)

private fun FfiEmailFilter.toCommon() = EmailFilter(
    id = id,
    accountId = accountId,
    name = name,
    description = description,
    isEnabled = isEnabled,
    priority = priority,
    matchLogic = matchLogic,
    conditionsJson = conditionsJson,
    actionsJson = actionsJson,
    matchedCount = matchedCount,
    lastMatchedAt = lastMatchedAt,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

private fun FfiEmailTemplate.toCommon() = EmailTemplate(
    id = id,
    accountId = accountId,
    name = name,
    description = description,
    category = category,
    subjectTemplate = subjectTemplate,
    bodyHtmlTemplate = bodyHtmlTemplate,
    bodyTextTemplate = bodyTextTemplate,
    tagsJson = tagsJson,
    isEnabled = isEnabled,
    isFavorite = isFavorite,
    usageCount = usageCount,
    lastUsedAt = lastUsedAt,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

private fun FfiDbEmailSummary.toCommon() = DbEmailSummary(
    id = id,
    messageId = messageId,
    uid = uid.toLong(),
    fromAddress = fromAddress,
    fromName = fromName,
    subject = subject,
    preview = preview,
    date = date,
    isRead = isRead,
    isStarred = isStarred,
    hasAttachments = hasAttachments,
    hasInlineImages = hasInlineImages,
)

// Sync types

private fun FfiSyncResult.toCommon() = SyncResult(
    accountsSynced = accountsSynced,
    contactsSynced = contactsSynced,
    preferencesSynced = preferencesSynced,
    signaturesSynced = signaturesSynced,
    errors = errors,
    conflictsJson = conflictsJson,
)

private fun FfiSyncConfig.toCommon() = SyncConfig(
    enabled = enabled,
    userId = userId,
    deviceId = deviceId,
    deviceName = deviceName,
    platform = platform,
    lastSyncAt = lastSyncAt,
    syncAccounts = syncAccounts,
    syncContacts = syncContacts,
    syncPreferences = syncPreferences,
    syncSignatures = syncSignatures,
)

private fun FfiSyncStatus.toCommon() = SyncStatus(
    dataType = dataType,
    version = version,
    lastSyncAt = lastSyncAt,
    status = status,
)

private fun FfiDeviceInfo.toCommon() = DeviceInfo(
    deviceId = deviceId,
    deviceName = deviceName,
    platform = platform,
    lastSeenAt = lastSeenAt,
    createdAt = createdAt,
)

private fun FfiQueueStats.toCommon() = QueueStats(
    pendingCount = pendingCount,
    inProgressCount = inProgressCount,
    failedCount = failedCount,
    completedCount = completedCount,
    totalCount = totalCount,
)

private fun FfiSyncSnapshot.toCommon() = SyncSnapshot(
    id = id,
    dataType = dataType,
    version = version,
    snapshotHash = snapshotHash,
    deviceId = deviceId,
    operation = operation,
    itemsCount = itemsCount,
    syncStatus = syncStatus,
    errorMessage = errorMessage,
    createdAt = createdAt,
)

private fun FfiSchedulerStatus.toCommon() = SchedulerStatus(
    enabled = enabled,
    running = running,
    intervalMinutes = intervalMinutes.toLong(),
    lastRun = lastRun,
    nextRun = nextRun,
)

// OAuth types

private fun FfiOAuthStartResult.toCommon() = OAuthStartResult(
    authUrl = authUrl,
    csrfState = csrfState,
)

private fun FfiOAuthCompleteResult.toCommon() = OAuthCompleteResult(
    email = email,
    displayName = displayName,
    accessToken = accessToken,
    refreshToken = refreshToken,
    imapHost = imapHost,
    imapPort = imapPort.toInt(),
    smtpHost = smtpHost,
    smtpPort = smtpPort.toInt(),
)

// Label & Alias types

private fun FfiLabel.toCommon() = Label(
    id = id,
    accountId = accountId,
    name = name,
    color = color,
    sortOrder = sortOrder,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

private fun FfiEmailAlias.toCommon() = EmailAlias(
    id = id,
    accountId = accountId,
    aliasEmail = aliasEmail,
    aliasName = aliasName,
    isDefault = isDefault,
    isEnabled = isEnabled,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
