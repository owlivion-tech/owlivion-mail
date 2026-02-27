package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.EmailAlias
import com.owlivion.mail.data.repository.AliasRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AliasScreenState(
    val aliases: List<EmailAlias> = emptyList(),
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val showAddDialog: Boolean = false,
)

class AliasViewModel(
    private val aliasRepo: AliasRepository,
    private val accountId: Long,
) : ScreenModel {

    private val _state = MutableStateFlow(AliasScreenState())
    val state: StateFlow<AliasScreenState> = _state.asStateFlow()

    init {
        loadAliases()
    }

    fun loadAliases() {
        screenModelScope.launch(Dispatchers.Default) {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val aliases = aliasRepo.list(accountId)
                _state.value = _state.value.copy(aliases = aliases, isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Alias'lar yuklenemedi",
                )
            }
        }
    }

    fun addAlias(aliasEmail: String, aliasName: String?) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                aliasRepo.add(accountId, aliasEmail, aliasName)
                _state.value = _state.value.copy(showAddDialog = false)
                loadAliases()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Alias eklenemedi")
            }
        }
    }

    fun deleteAlias(aliasId: Long) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                aliasRepo.delete(aliasId)
                loadAliases()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Alias silinemedi")
            }
        }
    }

    fun toggleAlias(aliasId: Long) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                aliasRepo.toggle(aliasId)
                loadAliases()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Alias degistirilemedi")
            }
        }
    }

    fun setDefault(aliasId: Long) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                aliasRepo.setDefault(aliasId, accountId)
                loadAliases()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Varsayilan alias ayarlanamadi")
            }
        }
    }

    fun showAddDialog() {
        _state.value = _state.value.copy(showAddDialog = true)
    }

    fun hideAddDialog() {
        _state.value = _state.value.copy(showAddDialog = false)
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }
}
