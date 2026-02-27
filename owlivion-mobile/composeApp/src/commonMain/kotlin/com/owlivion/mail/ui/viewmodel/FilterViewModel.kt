package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.EmailFilter
import com.owlivion.mail.data.repository.FilterRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class FilterListState(
    val filters: List<EmailFilter> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val showCreateDialog: Boolean = false,
)

data class FilterEditState(
    val name: String = "",
    val description: String = "",
    val matchLogic: String = "all",
    val conditionField: String = "from",
    val conditionOperator: String = "contains",
    val conditionValue: String = "",
    val actionType: String = "mark_as_read",
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
)

class FilterViewModel(
    private val filterRepo: FilterRepository,
    private val accountId: Long,
) : ScreenModel {

    private val _state = MutableStateFlow(FilterListState())
    val state: StateFlow<FilterListState> = _state.asStateFlow()

    private val _editState = MutableStateFlow(FilterEditState())
    val editState: StateFlow<FilterEditState> = _editState.asStateFlow()

    init {
        loadFilters()
    }

    fun loadFilters() {
        screenModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val filters = filterRepo.listFilters(accountId)
                _state.value = _state.value.copy(
                    filters = filters,
                    isLoading = false,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = "Filtreler yuklenemedi: ${e.message}",
                )
            }
        }
    }

    fun toggleFilter(filterId: Long) {
        screenModelScope.launch {
            try {
                filterRepo.toggleFilter(filterId)
                loadFilters()
            } catch (_: Exception) {}
        }
    }

    fun deleteFilter(filterId: Long) {
        screenModelScope.launch {
            try {
                filterRepo.deleteFilter(filterId)
                loadFilters()
            } catch (_: Exception) {}
        }
    }

    fun showCreateDialog() {
        _editState.value = FilterEditState()
        _state.value = _state.value.copy(showCreateDialog = true)
    }

    fun hideCreateDialog() {
        _state.value = _state.value.copy(showCreateDialog = false)
    }

    fun updateEditName(name: String) {
        _editState.value = _editState.value.copy(name = name)
    }

    fun updateEditDescription(desc: String) {
        _editState.value = _editState.value.copy(description = desc)
    }

    fun updateEditMatchLogic(logic: String) {
        _editState.value = _editState.value.copy(matchLogic = logic)
    }

    fun updateEditConditionField(field: String) {
        _editState.value = _editState.value.copy(conditionField = field)
    }

    fun updateEditConditionOperator(op: String) {
        _editState.value = _editState.value.copy(conditionOperator = op)
    }

    fun updateEditConditionValue(value: String) {
        _editState.value = _editState.value.copy(conditionValue = value)
    }

    fun updateEditActionType(action: String) {
        _editState.value = _editState.value.copy(actionType = action)
    }

    fun saveFilter() {
        val edit = _editState.value
        if (edit.name.isBlank()) {
            _editState.value = edit.copy(errorMessage = "Filtre adi bos olamaz")
            return
        }
        if (edit.conditionValue.isBlank()) {
            _editState.value = edit.copy(errorMessage = "Kosul degeri bos olamaz")
            return
        }

        val conditionsJson = """[{"field":"${edit.conditionField}","operator":"${edit.conditionOperator}","value":"${edit.conditionValue.replace("\"", "\\\"")}"}]"""
        val actionsJson = """[{"action":"${edit.actionType}"}]"""

        screenModelScope.launch {
            _editState.value = _editState.value.copy(isSaving = true, errorMessage = null)
            try {
                filterRepo.addFilter(
                    accountId = accountId,
                    name = edit.name,
                    description = edit.description.ifBlank { null },
                    matchLogic = edit.matchLogic,
                    conditionsJson = conditionsJson,
                    actionsJson = actionsJson,
                )
                _editState.value = _editState.value.copy(isSaving = false)
                _state.value = _state.value.copy(showCreateDialog = false)
                loadFilters()
            } catch (e: Exception) {
                _editState.value = _editState.value.copy(
                    isSaving = false,
                    errorMessage = "Filtre kaydedilemedi: ${e.message}",
                )
            }
        }
    }

    val conditionFields = listOf(
        "from" to "Gonderen",
        "to" to "Alici",
        "subject" to "Konu",
        "body" to "Icerik",
        "has_attachment" to "Ek Dosya",
    )

    val conditionOperators = listOf(
        "contains" to "Icerir",
        "not_contains" to "Icermez",
        "equals" to "Esittir",
        "not_equals" to "Esit Degil",
        "starts_with" to "Baslar",
        "ends_with" to "Biter",
    )

    val actionTypes = listOf(
        "mark_as_read" to "Okundu Isaretle",
        "mark_as_starred" to "Yildizla",
        "mark_as_spam" to "Spam Isaretle",
        "archive" to "Arsivle",
        "delete" to "Sil",
    )

    fun getConditionFieldLabel(key: String): String {
        return conditionFields.find { it.first == key }?.second ?: key
    }

    fun getConditionOperatorLabel(key: String): String {
        return conditionOperators.find { it.first == key }?.second ?: key
    }

    fun getActionTypeLabel(key: String): String {
        return actionTypes.find { it.first == key }?.second ?: key
    }
}
