package com.owlivion.mail.data.repository

import com.owlivion.mail.core.*

class TemplateRepository(private val bridge: OwlivionBridge) {

    suspend fun listTemplates(accountId: Long): List<EmailTemplate> {
        return bridge.templateList(accountId)
    }

    suspend fun getTemplate(templateId: Long): EmailTemplate {
        return bridge.templateGet(templateId)
    }

    suspend fun addTemplate(
        accountId: Long? = null,
        name: String,
        description: String? = null,
        category: String = "custom",
        subjectTemplate: String = "",
        bodyHtmlTemplate: String = "",
        bodyTextTemplate: String? = null,
        tagsJson: String = "[]",
        isEnabled: Boolean = true,
        isFavorite: Boolean = false,
    ): Long {
        return bridge.templateAdd(
            accountId, name, description, category, subjectTemplate,
            bodyHtmlTemplate, bodyTextTemplate, tagsJson, isEnabled, isFavorite,
        )
    }

    suspend fun updateTemplate(
        templateId: Long,
        accountId: Long? = null,
        name: String,
        description: String? = null,
        category: String = "custom",
        subjectTemplate: String = "",
        bodyHtmlTemplate: String = "",
        bodyTextTemplate: String? = null,
        tagsJson: String = "[]",
        isEnabled: Boolean = true,
        isFavorite: Boolean = false,
    ) {
        bridge.templateUpdate(
            templateId, accountId, name, description, category, subjectTemplate,
            bodyHtmlTemplate, bodyTextTemplate, tagsJson, isEnabled, isFavorite,
        )
    }

    suspend fun deleteTemplate(templateId: Long) {
        bridge.templateDelete(templateId)
    }

    suspend fun toggleTemplate(templateId: Long) {
        bridge.templateToggle(templateId)
    }

    suspend fun toggleFavorite(templateId: Long) {
        bridge.templateToggleFavorite(templateId)
    }

    suspend fun incrementUsage(templateId: Long) {
        bridge.templateIncrementUsage(templateId)
    }

    suspend fun searchTemplates(accountId: Long, query: String, limit: Int = 20): List<EmailTemplate> {
        return bridge.templateSearch(accountId, query, limit)
    }
}
