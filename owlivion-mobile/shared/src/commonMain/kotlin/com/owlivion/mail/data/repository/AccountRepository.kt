package com.owlivion.mail.data.repository

import com.owlivion.mail.core.*

class AccountRepository(private val bridge: OwlivionBridge) {

    suspend fun detectAutoconfig(email: String): AutoConfigResult {
        return bridge.autoconfigDetect(email)
    }

    suspend fun testImap(
        host: String, port: Int, security: String, email: String, password: String
    ) {
        bridge.accountTestImap(host, port, security, email, password)
    }

    suspend fun testSmtp(
        host: String, port: Int, security: String, email: String, password: String
    ) {
        bridge.accountTestSmtp(host, port, security, email, password)
    }

    suspend fun addAccount(config: AccountConfig): String {
        return bridge.accountAdd(config)
    }

    suspend fun listAccounts(): List<Account> {
        return bridge.accountList()
    }

    suspend fun connectAccount(accountId: String) {
        bridge.accountConnect(accountId)
    }

    suspend fun deleteAccount(accountId: String) {
        bridge.accountDelete(accountId)
    }
}
