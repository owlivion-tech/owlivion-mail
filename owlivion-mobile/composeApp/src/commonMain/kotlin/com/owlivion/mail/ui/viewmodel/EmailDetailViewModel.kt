package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.AttachmentInfo
import com.owlivion.mail.core.ParsedEmail
import com.owlivion.mail.data.repository.EmailRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class EmailDetailState(
    val isLoading: Boolean = true,
    val email: ParsedEmail? = null,
    val errorMessage: String? = null,
    val isDeleted: Boolean = false,
)

class EmailDetailViewModel(
    private val emailRepo: EmailRepository,
    private val accountId: String,
    private val uid: Long,
    private val folder: String?,
) : ScreenModel {

    private val _state = MutableStateFlow(EmailDetailState())
    val state: StateFlow<EmailDetailState> = _state.asStateFlow()

    fun loadEmail() {
        screenModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val email = emailRepo.getEmail(accountId, uid, folder)
                _state.value = _state.value.copy(
                    isLoading = false,
                    email = email,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = "E-posta yuklenemedi: ${e.message}",
                )
            }
        }
    }

    fun toggleStarred() {
        val email = _state.value.email ?: return
        val newStarred = !email.isStarred

        screenModelScope.launch {
            try {
                emailRepo.markStarred(accountId, uid, newStarred, folder)
                _state.value = _state.value.copy(
                    email = email.copy(isStarred = newStarred),
                )
            } catch (_: Exception) {}
        }
    }

    fun markUnread() {
        screenModelScope.launch {
            try {
                emailRepo.markRead(accountId, uid, false, folder)
                _state.value = _state.value.copy(
                    email = _state.value.email?.copy(isRead = false),
                )
            } catch (_: Exception) {}
        }
    }

    fun deleteEmail() {
        screenModelScope.launch {
            try {
                emailRepo.deleteEmail(accountId, uid, permanent = false, folder)
                _state.value = _state.value.copy(isDeleted = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    errorMessage = "Silme basarisiz: ${e.message}",
                )
            }
        }
    }

    fun moveToArchive() {
        screenModelScope.launch {
            try {
                emailRepo.moveEmail(accountId, uid, "Archive", folder)
                _state.value = _state.value.copy(isDeleted = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    errorMessage = "Arsivleme basarisiz: ${e.message}",
                )
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }
}
