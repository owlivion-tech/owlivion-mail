package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.data.repository.AIRepository
import com.owlivion.mail.data.service.PhishingAnalysis
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AISettingsState(
    val apiKey: String = "",
    val autoSummarize: Boolean = false,
    val autoPhishingDetection: Boolean = true,
    val replyTone: String = "professional",
    val isTesting: Boolean = false,
    val testResult: Boolean? = null,
    val errorMessage: String? = null,
    val successMessage: String? = null,
)

data class AIEmailState(
    val summary: String? = null,
    val sentiment: String? = null,
    val phishingAnalysis: PhishingAnalysis? = null,
    val generatedReply: String? = null,
    val isAnalyzing: Boolean = false,
    val isSummarizing: Boolean = false,
    val isGeneratingReply: Boolean = false,
    val errorMessage: String? = null,
)

class AISettingsViewModel(
    private val aiRepo: AIRepository,
) : ScreenModel {

    private val _state = MutableStateFlow(AISettingsState())
    val state: StateFlow<AISettingsState> = _state.asStateFlow()

    fun updateApiKey(key: String) {
        _state.value = _state.value.copy(apiKey = key, testResult = null)
    }

    fun updateAutoSummarize(enabled: Boolean) {
        _state.value = _state.value.copy(autoSummarize = enabled)
    }

    fun updateAutoPhishingDetection(enabled: Boolean) {
        _state.value = _state.value.copy(autoPhishingDetection = enabled)
    }

    fun updateReplyTone(tone: String) {
        _state.value = _state.value.copy(replyTone = tone)
    }

    fun testConnection() {
        val key = _state.value.apiKey
        if (key.isBlank()) {
            _state.value = _state.value.copy(errorMessage = "API anahtari giriniz")
            return
        }
        screenModelScope.launch {
            _state.value = _state.value.copy(isTesting = true, testResult = null, errorMessage = null)
            try {
                val success = aiRepo.testConnection(key)
                _state.value = _state.value.copy(
                    isTesting = false,
                    testResult = success,
                    successMessage = if (success) "Baglanti basarili" else null,
                    errorMessage = if (!success) "Baglanti basarisiz" else null,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isTesting = false,
                    testResult = false,
                    errorMessage = e.message ?: "Test basarisiz",
                )
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

class AIEmailViewModel(
    private val aiRepo: AIRepository,
    private val apiKey: String,
) : ScreenModel {

    private val _state = MutableStateFlow(AIEmailState())
    val state: StateFlow<AIEmailState> = _state.asStateFlow()

    fun summarize(content: String) {
        if (apiKey.isBlank()) return
        screenModelScope.launch {
            _state.value = _state.value.copy(isSummarizing = true, errorMessage = null)
            try {
                val summary = aiRepo.summarize(apiKey, content)
                _state.value = _state.value.copy(summary = summary, isSummarizing = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSummarizing = false,
                    errorMessage = e.message ?: "Ozetleme basarisiz",
                )
            }
        }
    }

    fun analyzePhishing(fromEmail: String, subject: String, body: String) {
        if (apiKey.isBlank()) return
        screenModelScope.launch {
            _state.value = _state.value.copy(isAnalyzing = true, errorMessage = null)
            try {
                val analysis = aiRepo.analyzePhishing(apiKey, fromEmail, subject, body)
                _state.value = _state.value.copy(phishingAnalysis = analysis, isAnalyzing = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isAnalyzing = false,
                    errorMessage = e.message ?: "Analiz basarisiz",
                )
            }
        }
    }

    fun generateReply(content: String, tone: String = "professional") {
        if (apiKey.isBlank()) return
        screenModelScope.launch {
            _state.value = _state.value.copy(isGeneratingReply = true, errorMessage = null)
            try {
                val reply = aiRepo.generateReply(apiKey, content, tone)
                _state.value = _state.value.copy(generatedReply = reply, isGeneratingReply = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isGeneratingReply = false,
                    errorMessage = e.message ?: "Yanit uretme basarisiz",
                )
            }
        }
    }

    fun analyzeSentiment(content: String) {
        if (apiKey.isBlank()) return
        screenModelScope.launch {
            try {
                val sentiment = aiRepo.analyzeSentiment(apiKey, content)
                _state.value = _state.value.copy(sentiment = sentiment)
            } catch (_: Exception) {
                // Sentiment analysis is optional, don't show error
            }
        }
    }

    fun clearReply() {
        _state.value = _state.value.copy(generatedReply = null)
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }
}
