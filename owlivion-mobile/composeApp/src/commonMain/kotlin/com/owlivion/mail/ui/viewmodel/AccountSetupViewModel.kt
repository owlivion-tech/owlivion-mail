package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.AccountConfig
import com.owlivion.mail.core.AutoConfigResult
import com.owlivion.mail.data.repository.AccountRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AccountSetupState(
    val step: SetupStep = SetupStep.Input,
    val isLoading: Boolean = false,
    val statusMessage: String? = null,
    val errorMessage: String? = null,
    val autoConfig: AutoConfigResult? = null,
    val addedAccountId: String? = null,
)

enum class SetupStep {
    Input,
    Detecting,
    Testing,
    Adding,
    Success,
}

class AccountSetupViewModel(
    private val accountRepo: AccountRepository,
) : ScreenModel {

    private val _state = MutableStateFlow(AccountSetupState())
    val state: StateFlow<AccountSetupState> = _state.asStateFlow()

    fun addAccount(
        email: String,
        password: String,
        displayName: String,
        manualConfig: ManualConfig?,
    ) {
        screenModelScope.launch {
            _state.value = _state.value.copy(
                isLoading = true,
                errorMessage = null,
                step = SetupStep.Detecting,
                statusMessage = "Sunucu ayarlari tespit ediliyor...",
            )

            try {
                val config = if (manualConfig != null) {
                    // Manual config provided
                    AutoConfigResult(
                        provider = null,
                        displayName = null,
                        imapHost = manualConfig.imapHost,
                        imapPort = manualConfig.imapPort,
                        imapSecurity = manualConfig.imapSecurity,
                        smtpHost = manualConfig.smtpHost,
                        smtpPort = manualConfig.smtpPort,
                        smtpSecurity = manualConfig.smtpSecurity,
                        detectionMethod = "manual",
                    )
                } else {
                    // Auto-detect
                    accountRepo.detectAutoconfig(email)
                }

                _state.value = _state.value.copy(
                    autoConfig = config,
                    step = SetupStep.Testing,
                    statusMessage = "IMAP baglantisi test ediliyor...",
                )

                // Test IMAP
                accountRepo.testImap(
                    host = config.imapHost,
                    port = config.imapPort,
                    security = config.imapSecurity,
                    email = email,
                    password = password,
                )

                _state.value = _state.value.copy(
                    statusMessage = "SMTP baglantisi test ediliyor...",
                )

                // Test SMTP
                accountRepo.testSmtp(
                    host = config.smtpHost,
                    port = config.smtpPort,
                    security = config.smtpSecurity,
                    email = email,
                    password = password,
                )

                _state.value = _state.value.copy(
                    step = SetupStep.Adding,
                    statusMessage = "Hesap ekleniyor...",
                )

                // Add account
                val accountId = accountRepo.addAccount(
                    AccountConfig(
                        email = email,
                        displayName = displayName.ifBlank { email },
                        password = password,
                        imapHost = config.imapHost,
                        imapPort = config.imapPort,
                        imapSecurity = config.imapSecurity,
                        smtpHost = config.smtpHost,
                        smtpPort = config.smtpPort,
                        smtpSecurity = config.smtpSecurity,
                        isDefault = true,
                    )
                )

                _state.value = _state.value.copy(
                    step = SetupStep.Success,
                    isLoading = false,
                    statusMessage = null,
                    addedAccountId = accountId,
                )
            } catch (e: Exception) {
                val errorMsg = when (_state.value.step) {
                    SetupStep.Detecting -> "Sunucu ayarlari tespit edilemedi: ${e.message}"
                    SetupStep.Testing -> "Baglanti testi basarisiz: ${e.message}"
                    SetupStep.Adding -> "Hesap eklenemedi: ${e.message}"
                    else -> "Beklenmeyen hata: ${e.message}"
                }
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = errorMsg,
                    statusMessage = null,
                    step = SetupStep.Input,
                )
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }
}

data class ManualConfig(
    val imapHost: String,
    val imapPort: Int,
    val imapSecurity: String,
    val smtpHost: String,
    val smtpPort: Int,
    val smtpSecurity: String,
)
