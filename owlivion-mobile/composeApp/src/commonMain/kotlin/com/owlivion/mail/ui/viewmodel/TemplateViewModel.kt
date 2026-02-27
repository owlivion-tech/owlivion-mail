package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.EmailTemplate
import com.owlivion.mail.data.repository.TemplateRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class TemplateListState(
    val templates: List<EmailTemplate> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val searchQuery: String = "",
    val selectedCategory: String? = null,
    val showCreateDialog: Boolean = false,
)

data class TemplateEditState(
    val name: String = "",
    val description: String = "",
    val category: String = "custom",
    val subjectTemplate: String = "",
    val bodyTextTemplate: String = "",
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
)

class TemplateViewModel(
    private val templateRepo: TemplateRepository,
    private val accountId: Long,
) : ScreenModel {

    private val _state = MutableStateFlow(TemplateListState())
    val state: StateFlow<TemplateListState> = _state.asStateFlow()

    private val _editState = MutableStateFlow(TemplateEditState())
    val editState: StateFlow<TemplateEditState> = _editState.asStateFlow()

    init {
        loadTemplates()
    }

    fun loadTemplates() {
        screenModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val templates = templateRepo.listTemplates(accountId)
                _state.value = _state.value.copy(
                    templates = templates,
                    isLoading = false,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = "Sablonlar yuklenemedi: ${e.message}",
                )
            }
        }
    }

    fun toggleFavorite(templateId: Long) {
        screenModelScope.launch {
            try {
                templateRepo.toggleFavorite(templateId)
                loadTemplates()
            } catch (_: Exception) {}
        }
    }

    fun deleteTemplate(templateId: Long) {
        screenModelScope.launch {
            try {
                templateRepo.deleteTemplate(templateId)
                loadTemplates()
            } catch (_: Exception) {}
        }
    }

    fun showCreateDialog() {
        _editState.value = TemplateEditState()
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

    fun updateEditCategory(category: String) {
        _editState.value = _editState.value.copy(category = category)
    }

    fun updateEditSubject(subject: String) {
        _editState.value = _editState.value.copy(subjectTemplate = subject)
    }

    fun updateEditBody(body: String) {
        _editState.value = _editState.value.copy(bodyTextTemplate = body)
    }

    fun saveTemplate() {
        val edit = _editState.value
        if (edit.name.isBlank()) {
            _editState.value = edit.copy(errorMessage = "Sablon adi bos olamaz")
            return
        }

        screenModelScope.launch {
            _editState.value = _editState.value.copy(isSaving = true, errorMessage = null)
            try {
                templateRepo.addTemplate(
                    accountId = accountId,
                    name = edit.name,
                    description = edit.description.ifBlank { null },
                    category = edit.category,
                    subjectTemplate = edit.subjectTemplate,
                    bodyHtmlTemplate = "",
                    bodyTextTemplate = edit.bodyTextTemplate.ifBlank { null },
                )
                _editState.value = _editState.value.copy(isSaving = false)
                _state.value = _state.value.copy(showCreateDialog = false)
                loadTemplates()
            } catch (e: Exception) {
                _editState.value = _editState.value.copy(
                    isSaving = false,
                    errorMessage = "Sablon kaydedilemedi: ${e.message}",
                )
            }
        }
    }

    val categories = listOf(
        "custom" to "Ozel",
        "business" to "Is",
        "personal" to "Kisisel",
        "customer_support" to "Destek",
        "sales" to "Satis",
        "marketing" to "Pazarlama",
        "internal" to "Dahili",
    )

    fun getCategoryLabel(key: String): String {
        return categories.find { it.first == key }?.second ?: key
    }
}
