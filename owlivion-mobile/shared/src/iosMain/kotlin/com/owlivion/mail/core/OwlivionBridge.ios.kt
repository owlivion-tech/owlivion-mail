package com.owlivion.mail.core

/**
 * iOS actual implementation of OwlivionBridge.
 * Uses UniFFI-generated Swift bindings via Kotlin/Native cinterop.
 *
 * TODO: Implement after xcframework is built and cinterop is configured (Faz 7).
 */
actual class OwlivionBridge actual constructor() {

    actual suspend fun initialize(dataDir: String, cacheDir: String) {
        throw NotImplementedError("iOS UniFFI bindings not yet implemented (Faz 7)")
    }

    actual fun destroy() {}

    actual suspend fun autoconfigDetect(email: String): AutoConfigResult {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun accountTestImap(
        host: String, port: Int, security: String, email: String, password: String
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun accountTestSmtp(
        host: String, port: Int, security: String, email: String, password: String
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun accountAdd(config: AccountConfig): String {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun accountList(): List<Account> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun accountConnect(accountId: String) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun accountDelete(accountId: String) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun folderList(accountId: String): List<Folder> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailList(
        accountId: String, folder: String?, page: Int, pageSize: Int
    ): FetchResult {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailGet(accountId: String, uid: Long, folder: String?): ParsedEmail {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailMarkRead(
        accountId: String, uid: Long, read: Boolean, folder: String?
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailMarkStarred(
        accountId: String, uid: Long, starred: Boolean, folder: String?
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailMove(
        accountId: String, uid: Long, targetFolder: String, folder: String?
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailDelete(
        accountId: String, uid: Long, permanent: Boolean, folder: String?
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun emailSearch(accountId: String, query: String): List<DbEmailSummary> {
        throw NotImplementedError("iOS not yet implemented")
    }

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
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- Filter Operations ---

    actual suspend fun filterList(accountId: Long): List<EmailFilter> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun filterGet(filterId: Long): EmailFilter {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun filterAdd(
        accountId: Long, name: String, description: String?, isEnabled: Boolean,
        priority: Int, matchLogic: String, conditionsJson: String, actionsJson: String,
    ): Long {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun filterUpdate(
        filterId: Long, accountId: Long, name: String, description: String?, isEnabled: Boolean,
        priority: Int, matchLogic: String, conditionsJson: String, actionsJson: String,
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun filterDelete(filterId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun filterToggle(filterId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- Template Operations ---

    actual suspend fun templateList(accountId: Long): List<EmailTemplate> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateGet(templateId: Long): EmailTemplate {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateAdd(
        accountId: Long?, name: String, description: String?, category: String,
        subjectTemplate: String, bodyHtmlTemplate: String, bodyTextTemplate: String?,
        tagsJson: String, isEnabled: Boolean, isFavorite: Boolean,
    ): Long {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateUpdate(
        templateId: Long, accountId: Long?, name: String, description: String?, category: String,
        subjectTemplate: String, bodyHtmlTemplate: String, bodyTextTemplate: String?,
        tagsJson: String, isEnabled: Boolean, isFavorite: Boolean,
    ) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateDelete(templateId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateToggle(templateId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateToggleFavorite(templateId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateIncrementUsage(templateId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun templateSearch(accountId: Long, query: String, limit: Int): List<EmailTemplate> {
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- Sync Operations ---

    actual suspend fun syncRegister(email: String, password: String, masterPassword: String) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncLogin(email: String, password: String) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncLogout() {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncStart(masterPassword: String): SyncResult {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncGetConfig(): SyncConfig {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncGetStatus(): List<SyncStatus> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncListDevices(): List<DeviceInfo> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncRevokeDevice(deviceId: String) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun syncGetQueueStats(): QueueStats {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun syncRetryFailed(): Int {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun syncClearCompletedQueue(olderThanDays: Int): Int {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun syncClearFailedQueue(): Int {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun syncGetHistory(dataType: String, limit: Int): List<SyncSnapshot> {
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- Scheduler Operations ---

    actual suspend fun schedulerStart() {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun schedulerStop() {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun schedulerGetStatus(): SchedulerStatus {
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- OAuth Operations ---

    actual fun oauthStartFlow(provider: String): OAuthStartResult {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual suspend fun oauthHandleCallback(
        provider: String,
        authorizationCode: String,
        csrfState: String,
    ): OAuthCompleteResult {
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- Label Operations ---

    actual fun labelCreate(accountId: Long?, name: String, color: String): Label {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun labelList(accountId: Long?): List<Label> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun labelUpdate(id: Long, name: String?, color: String?): Label {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun labelDelete(id: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun emailAddLabel(emailId: Long, labelId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun emailRemoveLabel(emailId: Long, labelId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun emailGetLabels(emailId: Long): List<Label> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun labelGetEmailIds(labelId: Long): List<Long> {
        throw NotImplementedError("iOS not yet implemented")
    }

    // --- Alias Operations ---

    actual fun aliasAdd(accountId: Long, aliasEmail: String, aliasName: String?): Long {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun aliasList(accountId: Long): List<EmailAlias> {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun aliasUpdate(aliasId: Long, aliasEmail: String?, aliasName: String?) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun aliasDelete(aliasId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun aliasToggle(aliasId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }

    actual fun aliasSetDefault(aliasId: Long, accountId: Long) {
        throw NotImplementedError("iOS not yet implemented")
    }
}
