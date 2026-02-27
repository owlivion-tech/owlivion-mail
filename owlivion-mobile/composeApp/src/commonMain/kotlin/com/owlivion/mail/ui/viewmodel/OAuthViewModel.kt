package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.OAuthCompleteResult
import com.owlivion.mail.data.repository.OAuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OAuthState(
    val provider: String? = null,
    val authUrl: String? = null,
    val csrfState: String? = null,
    val isStarting: Boolean = false,
    val isHandlingCallback: Boolean = false,
    val result: OAuthCompleteResult? = null,
    val isAccountAdded: Boolean = false,
    val errorMessage: String? = null,
)

class OAuthViewModel(
    private val oauthRepo: OAuthRepository,
) : ScreenModel {

    private val _state = MutableStateFlow(OAuthState())
    val state: StateFlow<OAuthState> = _state.asStateFlow()

    fun startFlow(provider: String) {
        screenModelScope.launch {
            _state.value = _state.value.copy(isStarting = true, errorMessage = null, provider = provider)
            try {
                val startResult = oauthRepo.startFlow(provider)
                _state.value = _state.value.copy(
                    isStarting = false,
                    authUrl = startResult.authUrl,
                    csrfState = startResult.csrfState,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isStarting = false,
                    errorMessage = e.message ?: "OAuth baslatma basarisiz",
                )
            }
        }
    }

    fun handleCallback(code: String, state: String) {
        val provider = _state.value.provider ?: return
        val expectedState = _state.value.csrfState
        if (expectedState != null && expectedState != state) {
            _state.value = _state.value.copy(errorMessage = "CSRF dogrulamasi basarisiz")
            return
        }
        screenModelScope.launch {
            _state.value = _state.value.copy(isHandlingCallback = true, errorMessage = null)
            try {
                val result = oauthRepo.handleCallback(provider, code, state)
                oauthRepo.addOAuthAccount(result, provider)
                _state.value = _state.value.copy(
                    isHandlingCallback = false,
                    result = result,
                    isAccountAdded = true,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isHandlingCallback = false,
                    errorMessage = e.message ?: "OAuth tamamlama basarisiz",
                )
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    fun reset() {
        _state.value = OAuthState()
    }
}
