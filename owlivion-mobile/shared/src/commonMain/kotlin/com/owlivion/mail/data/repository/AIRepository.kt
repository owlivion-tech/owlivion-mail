package com.owlivion.mail.data.repository

import com.owlivion.mail.data.service.GeminiService
import com.owlivion.mail.data.service.PhishingAnalysis

class AIRepository(private val geminiService: GeminiService) {

    suspend fun summarize(apiKey: String, content: String, language: String = "tr"): String {
        return geminiService.summarizeEmail(apiKey, content, language)
    }

    suspend fun generateReply(
        apiKey: String,
        content: String,
        tone: String = "professional",
        language: String = "tr",
    ): String {
        return geminiService.generateReply(apiKey, content, tone, language)
    }

    suspend fun analyzePhishing(
        apiKey: String,
        fromEmail: String,
        subject: String,
        body: String,
        language: String = "tr",
    ): PhishingAnalysis {
        return geminiService.analyzePhishing(apiKey, fromEmail, subject, body, language)
    }

    suspend fun analyzeSentiment(apiKey: String, content: String): String {
        return geminiService.analyzeSentiment(apiKey, content)
    }

    suspend fun testConnection(apiKey: String): Boolean {
        return geminiService.testConnection(apiKey)
    }
}
