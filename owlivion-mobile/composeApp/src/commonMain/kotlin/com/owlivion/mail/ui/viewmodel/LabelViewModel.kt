package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.Label
import com.owlivion.mail.data.repository.LabelRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LabelScreenState(
    val labels: List<Label> = emptyList(),
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val editingLabel: Label? = null,
    val showAddDialog: Boolean = false,
)

class LabelViewModel(
    private val labelRepo: LabelRepository,
    private val accountId: Long?,
) : ScreenModel {

    private val _state = MutableStateFlow(LabelScreenState())
    val state: StateFlow<LabelScreenState> = _state.asStateFlow()

    init {
        loadLabels()
    }

    fun loadLabels() {
        screenModelScope.launch(Dispatchers.Default) {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val labels = labelRepo.list(accountId)
                _state.value = _state.value.copy(labels = labels, isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Etiketler yuklenemedi",
                )
            }
        }
    }

    fun createLabel(name: String, color: String) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                labelRepo.create(accountId, name, color)
                _state.value = _state.value.copy(showAddDialog = false)
                loadLabels()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Etiket olusturulamadi")
            }
        }
    }

    fun updateLabel(id: Long, name: String?, color: String?) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                labelRepo.update(id, name, color)
                _state.value = _state.value.copy(editingLabel = null)
                loadLabels()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Etiket guncellenemedi")
            }
        }
    }

    fun deleteLabel(id: Long) {
        screenModelScope.launch(Dispatchers.Default) {
            try {
                labelRepo.delete(id)
                loadLabels()
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = e.message ?: "Etiket silinemedi")
            }
        }
    }

    fun showAddDialog() {
        _state.value = _state.value.copy(showAddDialog = true)
    }

    fun hideAddDialog() {
        _state.value = _state.value.copy(showAddDialog = false)
    }

    fun startEditing(label: Label) {
        _state.value = _state.value.copy(editingLabel = label)
    }

    fun cancelEditing() {
        _state.value = _state.value.copy(editingLabel = null)
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }
}
