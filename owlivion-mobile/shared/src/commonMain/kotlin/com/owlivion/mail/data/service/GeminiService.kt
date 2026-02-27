package com.owlivion.mail.data.service

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Gemini AI Service - HTTP calls to Google Generative AI API.
 * Implements: summarization, reply generation, phishing detection, sentiment analysis.
 */
class GeminiService {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val client = HttpClient {
        install(ContentNegotiation) {
            json(json)
        }
    }

    private val baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

    // Simple rate limiting - tracks request count per session
    private var requestCount = 0

    private suspend fun throttle() {
        if (requestCount > 0) {
            kotlinx.coroutines.delay(2000) // 2s between requests
        }
        requestCount++
    }

    private suspend fun generateContent(apiKey: String, prompt: String): String {
        throttle()
        val response = client.post("$baseUrl?key=$apiKey") {
            contentType(ContentType.Application.Json)
            setBody(GeminiRequest(
                contents = listOf(
                    GeminiContent(parts = listOf(GeminiPart(text = prompt)))
                ),
                safetySettings = listOf(
                    SafetySetting("HARM_CATEGORY_HARASSMENT", "BLOCK_NONE"),
                    SafetySetting("HARM_CATEGORY_HATE_SPEECH", "BLOCK_NONE"),
                    SafetySetting("HARM_CATEGORY_SEXUALLY_EXPLICIT", "BLOCK_NONE"),
                    SafetySetting("HARM_CATEGORY_DANGEROUS_CONTENT", "BLOCK_NONE"),
                ),
            ))
        }
        val result: GeminiResponse = response.body()
        return result.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
            ?: throw Exception("Gemini yanit uretmedi")
    }

    /**
     * Summarize an email in the given language.
     */
    suspend fun summarizeEmail(
        apiKey: String,
        emailContent: String,
        language: String = "tr",
    ): String {
        val sanitized = sanitizeContent(emailContent)
        val langLabel = if (language == "tr") "Turkce" else "English"
        val prompt = """
            Asagidaki e-posta icerigini $langLabel olarak 2-3 cumle ile ozetle.
            Sadece ozeti yaz, baska bir sey ekleme.

            E-posta:
            $sanitized
        """.trimIndent()
        return generateContent(apiKey, prompt)
    }

    /**
     * Generate a reply to an email.
     */
    suspend fun generateReply(
        apiKey: String,
        emailContent: String,
        tone: String = "professional",
        language: String = "tr",
    ): String {
        val sanitized = sanitizeContent(emailContent)
        val langLabel = if (language == "tr") "Turkce" else "English"
        val toneLabel = when (tone) {
            "professional" -> "profesyonel"
            "friendly" -> "samimi"
            "formal" -> "resmi"
            "casual" -> "gundelik"
            else -> "profesyonel"
        }
        val prompt = """
            Asagidaki e-postaya $langLabel olarak $toneLabel bir tonda yanit yaz.
            Sadece yanit metnini yaz, "Konu:" veya "Sayin" gibi basliklar ekleme.
            Selamlama ve kapanisla birlikte yaz.

            E-posta:
            $sanitized
        """.trimIndent()
        return generateContent(apiKey, prompt)
    }

    /**
     * Analyze an email for phishing indicators.
     */
    suspend fun analyzePhishing(
        apiKey: String,
        fromEmail: String,
        subject: String,
        body: String,
        language: String = "tr",
    ): PhishingAnalysis {
        val sanitized = sanitizeContent(body)
        val prompt = """
            Asagidaki e-postayi phishing (oltalama) saldirisina karsi analiz et.
            JSON formatinda yanit ver (baska hicbir sey yazma):
            {"isPhishing": true/false, "riskLevel": "low"/"medium"/"high"/"critical", "score": 0-100, "reasons": ["neden1", "neden2"], "recommendations": ["oneri1"]}

            Gonderen: $fromEmail
            Konu: $subject
            Icerik:
            $sanitized
        """.trimIndent()

        return try {
            val response = generateContent(apiKey, prompt)
            val jsonStr = response.trim()
                .removePrefix("```json").removePrefix("```")
                .removeSuffix("```").trim()
            json.decodeFromString<PhishingAnalysis>(jsonStr)
        } catch (e: Exception) {
            // Fallback: rule-based basic check
            ruleBasedPhishingCheck(fromEmail, subject, body)
        }
    }

    /**
     * Analyze sentiment of an email.
     */
    suspend fun analyzeSentiment(
        apiKey: String,
        emailContent: String,
    ): String {
        val sanitized = sanitizeContent(emailContent)
        val prompt = """
            Asagidaki e-postanin duygusal tonunu analiz et.
            Sadece su degerlerden birini yaz: positive, negative, neutral
            Baska hicbir sey yazma.

            E-posta:
            $sanitized
        """.trimIndent()
        val result = generateContent(apiKey, prompt).trim().lowercase()
        return when {
            "positive" in result -> "positive"
            "negative" in result -> "negative"
            else -> "neutral"
        }
    }

    /**
     * Test API connection.
     */
    suspend fun testConnection(apiKey: String): Boolean {
        return try {
            generateContent(apiKey, "Merhaba, baglanti testi. 'OK' yaz.")
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun sanitizeContent(content: String): String {
        // Remove potential PII patterns and limit length
        return content
            .replace(Regex("\\b\\d{16}\\b"), "[KART_NO]")
            .replace(Regex("\\b\\d{3}-\\d{2}-\\d{4}\\b"), "[SSN]")
            .take(4000)
    }

    private fun ruleBasedPhishingCheck(from: String, subject: String, body: String): PhishingAnalysis {
        val reasons = mutableListOf<String>()
        var score = 0

        // Check for suspicious patterns
        val lowerBody = body.lowercase()
        val lowerSubject = subject.lowercase()

        if (lowerSubject.contains("acil") || lowerSubject.contains("urgent")) {
            reasons.add("Konu basliginda aciliyet ifadesi")
            score += 15
        }
        if (lowerBody.contains("sifrenizi") || lowerBody.contains("password")) {
            reasons.add("Sifre bilgisi isteniyor")
            score += 25
        }
        if (lowerBody.contains("hesabiniz") && lowerBody.contains("askiya")) {
            reasons.add("Hesap askiya alinma tehdidi")
            score += 20
        }
        if (Regex("https?://\\d+\\.\\d+\\.\\d+\\.\\d+").containsMatchIn(body)) {
            reasons.add("IP adresli URL iceriyor")
            score += 30
        }
        if (from.contains("noreply") && lowerBody.contains("tiklayiniz")) {
            reasons.add("Noreply adresinden link tiklatma")
            score += 10
        }

        val riskLevel = when {
            score >= 60 -> "critical"
            score >= 40 -> "high"
            score >= 20 -> "medium"
            else -> "low"
        }

        return PhishingAnalysis(
            isPhishing = score >= 40,
            riskLevel = riskLevel,
            score = score,
            reasons = reasons.ifEmpty { listOf("Belirgin tehdit tespit edilmedi") },
            recommendations = if (score >= 40) {
                listOf("Bu e-postadaki linklere tiklamayin", "Gondereni dogrulayin")
            } else {
                listOf("Dikkatli olmaya devam edin")
            },
        )
    }
}

// Gemini API request/response models

@Serializable
data class GeminiRequest(
    val contents: List<GeminiContent>,
    @SerialName("safety_settings") val safetySettings: List<SafetySetting> = emptyList(),
)

@Serializable
data class GeminiContent(
    val parts: List<GeminiPart>,
    val role: String = "user",
)

@Serializable
data class GeminiPart(val text: String)

@Serializable
data class SafetySetting(
    val category: String,
    val threshold: String,
)

@Serializable
data class GeminiResponse(
    val candidates: List<GeminiCandidate>? = null,
)

@Serializable
data class GeminiCandidate(
    val content: GeminiContent? = null,
)

// Phishing analysis result
@Serializable
data class PhishingAnalysis(
    val isPhishing: Boolean = false,
    val riskLevel: String = "low",
    val score: Int = 0,
    val reasons: List<String> = emptyList(),
    val recommendations: List<String> = emptyList(),
)
