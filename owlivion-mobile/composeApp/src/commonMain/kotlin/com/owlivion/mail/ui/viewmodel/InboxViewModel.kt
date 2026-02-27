package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.Account
import com.owlivion.mail.core.EmailSummary
import com.owlivion.mail.core.Folder
import com.owlivion.mail.data.repository.AccountRepository
import com.owlivion.mail.data.repository.EmailRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class InboxState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val accounts: List<Account> = emptyList(),
    val currentAccountId: String? = null,
    val folders: List<Folder> = emptyList(),
    val currentFolder: String = "INBOX",
    val emails: List<EmailSummary> = emptyList(),
    val totalEmails: Int = 0,
    val hasMore: Boolean = false,
    val page: Int = 0,
    val errorMessage: String? = null,
    val isConnecting: Boolean = false,
)

class InboxViewModel(
    private val accountRepo: AccountRepository,
    private val emailRepo: EmailRepository,
) : ScreenModel {

    private val _state = MutableStateFlow(InboxState())
    val state: StateFlow<InboxState> = _state.asStateFlow()

    fun loadInitial() {
        screenModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)

            try {
                // Get accounts
                val accounts = accountRepo.listAccounts()
                if (accounts.isEmpty()) {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        accounts = emptyList(),
                        errorMessage = "Hesap bulunamadi. Lutfen bir hesap ekleyin.",
                    )
                    return@launch
                }

                val account = accounts.first()
                val accountId = account.id.toString()

                _state.value = _state.value.copy(
                    accounts = accounts,
                    currentAccountId = accountId,
                    isConnecting = true,
                )

                // Connect to IMAP
                accountRepo.connectAccount(accountId)

                _state.value = _state.value.copy(isConnecting = false)

                // Load folders
                val folders = emailRepo.listFolders(accountId)
                _state.value = _state.value.copy(folders = folders)

                // Fetch first page of emails
                fetchEmails(accountId, "INBOX", page = 0)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isConnecting = false,
                    errorMessage = "Baglanamadi: ${e.message}",
                )
            }
        }
    }

    fun refresh() {
        val accountId = _state.value.currentAccountId ?: return
        val folder = _state.value.currentFolder

        screenModelScope.launch {
            _state.value = _state.value.copy(isRefreshing = true, errorMessage = null)
            try {
                fetchEmails(accountId, folder, page = 0)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isRefreshing = false,
                    errorMessage = "Yenileme basarisiz: ${e.message}",
                )
            }
        }
    }

    fun loadMoreEmails() {
        val accountId = _state.value.currentAccountId ?: return
        val folder = _state.value.currentFolder
        if (!_state.value.hasMore || _state.value.isLoading) return

        screenModelScope.launch {
            try {
                val nextPage = _state.value.page + 1
                val result = emailRepo.listEmails(accountId, folder, nextPage, PAGE_SIZE)
                _state.value = _state.value.copy(
                    emails = _state.value.emails + result.emails,
                    totalEmails = result.total,
                    hasMore = result.hasMore,
                    page = nextPage,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    errorMessage = "Daha fazla yukleme basarisiz: ${e.message}",
                )
            }
        }
    }

    fun selectFolder(folder: String) {
        val accountId = _state.value.currentAccountId ?: return
        _state.value = _state.value.copy(currentFolder = folder)

        screenModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                fetchEmails(accountId, folder, page = 0)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = "Klasor yuklenemedi: ${e.message}",
                )
            }
        }
    }

    fun markRead(uid: Long, read: Boolean) {
        val accountId = _state.value.currentAccountId ?: return
        val folder = _state.value.currentFolder

        screenModelScope.launch {
            try {
                emailRepo.markRead(accountId, uid, read, folder)
                _state.value = _state.value.copy(
                    emails = _state.value.emails.map {
                        if (it.uid == uid) it.copy(isRead = read) else it
                    }
                )
            } catch (_: Exception) {}
        }
    }

    fun markStarred(uid: Long, starred: Boolean) {
        val accountId = _state.value.currentAccountId ?: return
        val folder = _state.value.currentFolder

        screenModelScope.launch {
            try {
                emailRepo.markStarred(accountId, uid, starred, folder)
                _state.value = _state.value.copy(
                    emails = _state.value.emails.map {
                        if (it.uid == uid) it.copy(isStarred = starred) else it
                    }
                )
            } catch (_: Exception) {}
        }
    }

    fun deleteEmail(uid: Long) {
        val accountId = _state.value.currentAccountId ?: return
        val folder = _state.value.currentFolder

        screenModelScope.launch {
            try {
                emailRepo.deleteEmail(accountId, uid, permanent = false, folder)
                _state.value = _state.value.copy(
                    emails = _state.value.emails.filter { it.uid != uid }
                )
            } catch (_: Exception) {}
        }
    }

    fun archiveEmail(uid: Long) {
        val accountId = _state.value.currentAccountId ?: return
        val folder = _state.value.currentFolder

        screenModelScope.launch {
            try {
                emailRepo.moveEmail(accountId, uid, "Archive", folder)
                _state.value = _state.value.copy(
                    emails = _state.value.emails.filter { it.uid != uid }
                )
            } catch (_: Exception) {}
        }
    }

    fun switchAccount(accountId: String) {
        if (accountId == _state.value.currentAccountId) return

        screenModelScope.launch {
            _state.value = _state.value.copy(
                currentAccountId = accountId,
                currentFolder = "INBOX",
                isConnecting = true,
                errorMessage = null,
            )

            try {
                accountRepo.connectAccount(accountId)
                _state.value = _state.value.copy(isConnecting = false)

                val folders = emailRepo.listFolders(accountId)
                _state.value = _state.value.copy(folders = folders)

                fetchEmails(accountId, "INBOX", page = 0)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isConnecting = false,
                    isLoading = false,
                    errorMessage = "Hesap degistirilemedi: ${e.message}",
                )
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    private suspend fun fetchEmails(accountId: String, folder: String, page: Int) {
        val result = emailRepo.listEmails(accountId, folder, page, PAGE_SIZE)
        _state.value = _state.value.copy(
            emails = result.emails,
            totalEmails = result.total,
            hasMore = result.hasMore,
            page = page,
            isLoading = false,
            isRefreshing = false,
        )
    }

    companion object {
        private const val PAGE_SIZE = 50
    }
}
