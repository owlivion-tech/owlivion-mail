package com.owlivion.mail.data.repository

import com.owlivion.mail.core.*

class OAuthRepository(private val bridge: OwlivionBridge) {

    fun startFlow(provider: String): OAuthStartResult {
        return bridge.oauthStartFlow(provider)
    }

    suspend fun handleCallback(
        provider: String,
        authorizationCode: String,
        csrfState: String,
    ): OAuthCompleteResult {
        return bridge.oauthHandleCallback(provider, authorizationCode, csrfState)
    }

    suspend fun addOAuthAccount(result: OAuthCompleteResult, provider: String) {
        val security = if (provider == "microsoft") "starttls" else "ssl"
        bridge.accountAdd(
            AccountConfig(
                email = result.email,
                displayName = result.displayName ?: result.email,
                password = result.accessToken,
                imapHost = result.imapHost,
                imapPort = result.imapPort,
                imapSecurity = "ssl",
                smtpHost = result.smtpHost,
                smtpPort = result.smtpPort,
                smtpSecurity = security,
                oauthProvider = provider,
            )
        )
    }
}
