package com.owlivion.mail.data.repository

import com.owlivion.mail.core.*

class EmailRepository(private val bridge: OwlivionBridge) {

    suspend fun listFolders(accountId: String): List<Folder> {
        return bridge.folderList(accountId)
    }

    suspend fun listEmails(
        accountId: String,
        folder: String? = null,
        page: Int = 0,
        pageSize: Int = 50,
    ): FetchResult {
        return bridge.emailList(accountId, folder, page, pageSize)
    }

    suspend fun getEmail(accountId: String, uid: Long, folder: String? = null): ParsedEmail {
        return bridge.emailGet(accountId, uid, folder)
    }

    suspend fun markRead(accountId: String, uid: Long, read: Boolean, folder: String? = null) {
        bridge.emailMarkRead(accountId, uid, read, folder)
    }

    suspend fun markStarred(accountId: String, uid: Long, starred: Boolean, folder: String? = null) {
        bridge.emailMarkStarred(accountId, uid, starred, folder)
    }

    suspend fun moveEmail(accountId: String, uid: Long, targetFolder: String, folder: String? = null) {
        bridge.emailMove(accountId, uid, targetFolder, folder)
    }

    suspend fun deleteEmail(accountId: String, uid: Long, permanent: Boolean = false, folder: String? = null) {
        bridge.emailDelete(accountId, uid, permanent, folder)
    }

    suspend fun searchEmails(accountId: String, query: String): List<DbEmailSummary> {
        return bridge.emailSearch(accountId, query)
    }

    suspend fun sendEmail(
        accountId: String,
        to: List<String>,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
        subject: String,
        bodyText: String? = null,
        bodyHtml: String? = null,
        attachments: List<SendAttachment> = emptyList(),
    ) {
        bridge.emailSend(accountId, to, cc, bcc, subject, bodyText, bodyHtml, attachments)
    }
}
