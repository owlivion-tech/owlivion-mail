package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.*
import com.owlivion.mail.data.repository.SyncRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SyncScreenState(
    // Auth
    val isLoggedIn: Boolean = false,
    val authEmail: String = "",
    val authPassword: String = "",
    val masterPassword: String = "",
    val isRegistering: Boolean = false,
    val isLoggingIn: Boolean = false,
    val showRegisterForm: Boolean = false,
    // Sync config/status
    val config: SyncConfig? = null,
    val statuses: List<SyncStatus> = emptyList(),
    val devices: List<DeviceInfo> = emptyList(),
    val queueStats: QueueStats? = null,
    val schedulerStatus: SchedulerStatus? = null,
    // Sync operation
    val isSyncing: Boolean = false,
    val lastSyncResult: SyncResult? = null,
    // General
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
)

class SyncViewModel(
    private val syncRepo: SyncRepository,
) : ScreenModel {

    private val _state = MutableStateFlow(SyncScreenState())
    val state: StateFlow<SyncScreenState> = _state.asStateFlow()

    init {
        loadSyncState()
    }

    private fun loadSyncState() {
        screenModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val config = syncRepo.getConfig()
                val isLoggedIn = config.userId != null
                _state.value = _state.value.copy(
                    config = config,
                    isLoggedIn = isLoggedIn,
                    isLoading = false,
                )
                if (isLoggedIn) {
                    loadDetails()
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isLoggedIn = false,
                )
            }
        }
    }

    private suspend fun loadDetails() {
        try {
            val statuses = syncRepo.getStatus()
            val devices = syncRepo.listDevices()
            val queueStats = syncRepo.getQueueStats()
            val schedulerStatus = syncRepo.schedulerGetStatus()
            _state.value = _state.value.copy(
                statuses = statuses,
                devices = devices,
                queueStats = queueStats,
                schedulerStatus = schedulerStatus,
            )
        } catch (_: Exception) { }
    }

    // Auth field updates
    fun updateAuthEmail(value: String) {
        _state.value = _state.value.copy(authEmail = value)
    }

    fun updateAuthPassword(value: String) {
        _state.value = _state.value.copy(authPassword = value)
    }

    fun updateMasterPassword(value: String) {
        _state.value = _state.value.copy(masterPassword = value)
    }

    fun toggleRegisterForm() {
        _state.value = _state.value.copy(
            showRegisterForm = !_state.value.showRegisterForm,
            errorMessage = null,
        )
    }

    fun register() {
        val s = _state.value
        if (s.authEmail.isBlank() || s.authPassword.isBlank() || s.masterPassword.isBlank()) {
            _state.value = s.copy(errorMessage = "Tum alanlari doldurun")
            return
        }
        screenModelScope.launch {
            _state.value = _state.value.copy(isRegistering = true, errorMessage = null)
            try {
                syncRepo.register(s.authEmail, s.authPassword, s.masterPassword)
                syncRepo.login(s.authEmail, s.authPassword)
                _state.value = _state.value.copy(
                    isRegistering = false,
                    isLoggedIn = true,
                    successMessage = "Hesap olusturuldu ve giris yapildi",
                )
                loadSyncState()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isRegistering = false,
                    errorMessage = e.message ?: "Kayit basarisiz",
                )
            }
        }
    }

    fun login() {
        val s = _state.value
        if (s.authEmail.isBlank() || s.authPassword.isBlank()) {
            _state.value = s.copy(errorMessage = "E-posta ve sifre gerekli")
            return
        }
        screenModelScope.launch {
            _state.value = _state.value.copy(isLoggingIn = true, errorMessage = null)
            try {
                syncRepo.login(s.authEmail, s.authPassword)
                _state.value = _state.value.copy(isLoggingIn = false, isLoggedIn = true)
                loadSyncState()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoggingIn = false,
                    errorMessage = e.message ?: "Giris basarisiz",
                )
            }
        }
    }

    fun logout() {
        screenModelScope.launch {
            try {
                syncRepo.logout()
                _state.value = SyncScreenState()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message)
            }
        }
    }

    fun startSync() {
        val s = _state.value
        if (s.masterPassword.isBlank()) {
            _state.value = s.copy(errorMessage = "Master sifre gerekli")
            return
        }
        screenModelScope.launch {
            _state.value = _state.value.copy(isSyncing = true, errorMessage = null)
            try {
                val result = syncRepo.startSync(s.masterPassword)
                _state.value = _state.value.copy(
                    isSyncing = false,
                    lastSyncResult = result,
                    successMessage = "Senkronizasyon tamamlandi",
                )
                loadDetails()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSyncing = false,
                    errorMessage = e.message ?: "Senkronizasyon basarisiz",
                )
            }
        }
    }

    fun revokeDevice(deviceId: String) {
        screenModelScope.launch {
            try {
                syncRepo.revokeDevice(deviceId)
                val devices = syncRepo.listDevices()
                _state.value = _state.value.copy(devices = devices)
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message)
            }
        }
    }

    fun retryFailed() {
        screenModelScope.launch {
            try {
                syncRepo.retryFailed()
                val queueStats = syncRepo.getQueueStats()
                _state.value = _state.value.copy(queueStats = queueStats)
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message)
            }
        }
    }

    fun toggleScheduler() {
        screenModelScope.launch {
            try {
                val current = _state.value.schedulerStatus
                if (current?.running == true) {
                    syncRepo.schedulerStop()
                } else {
                    syncRepo.schedulerStart()
                }
                val status = syncRepo.schedulerGetStatus()
                _state.value = _state.value.copy(schedulerStatus = status)
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message)
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    fun clearSuccess() {
        _state.value = _state.value.copy(successMessage = null)
    }
}
