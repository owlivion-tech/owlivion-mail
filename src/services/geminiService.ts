// ============================================================================
// Owlivion Mail - Gemini AI Service
// ============================================================================
// SECURITY HARDENED: API key in headers, input sanitization, rate limiting

import type { AIReplyRequest, AIReplyResponse, Settings } from '../types';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000; // Minimum 1 second between requests
const MAX_REQUESTS_PER_MINUTE = 10;
const requestTimestamps: number[] = [];

/**
 * SECURITY: Check rate limits before making API request
 */
function checkRateLimit(): void {
  const now = Date.now();

  // Check minimum interval
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
    throw new Error('Too many requests. Please wait a moment.');
  }

  // Check requests per minute
  const oneMinuteAgo = now - 60000;
  const recentRequests = requestTimestamps.filter(t => t > oneMinuteAgo);
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    throw new Error('Rate limit exceeded. Please wait a minute.');
  }

  // Update tracking
  lastRequestTime = now;
  requestTimestamps.push(now);

  // Clean old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }
}

/**
 * SECURITY: Sanitize email content before sending to AI
 * Removes sensitive headers and PII patterns
 */
function sanitizeEmailContent(content: string, maxLength: number = 10000): string {
  if (!content) return '';

  let sanitized = content;

  // Remove potentially sensitive headers if present
  sanitized = sanitized.replace(/^(X-[A-Za-z-]+|Received|DKIM-Signature|Authentication-Results|ARC-[A-Za-z-]+):.*$/gmi, '');

  // Remove email addresses from headers (keep in body for context)
  sanitized = sanitized.replace(/^(From|To|Cc|Bcc|Reply-To|Return-Path):.*$/gmi, '[Header removed]');

  // Remove potential credit card numbers
  sanitized = sanitized.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED]');

  // Remove potential SSN patterns
  sanitized = sanitized.replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, '[REDACTED]');

  // Remove potential phone numbers (Turkish format)
  sanitized = sanitized.replace(/\b0?5\d{2}[- ]?\d{3}[- ]?\d{2}[- ]?\d{2}\b/g, '[REDACTED]');

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '\n[Content truncated]';
  }

  return sanitized.trim();
}

/**
 * SECURITY: Make API request with key in header instead of URL
 */
async function makeGeminiRequest(
  apiKey: string,
  body: object,
  timeout: number = 30000
): Promise<Response> {
  checkRateLimit();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // SECURITY: API key passed in x-goog-api-key header instead of URL query parameter
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // SECURITY: Key in header, not URL
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate AI reply for an email
 */
export async function generateReply(
  request: AIReplyRequest,
  apiKey: string
): Promise<AIReplyResponse> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in Settings > AI.');
  }

  const systemPrompt = getSystemPrompt(request.tone, request.language);
  // SECURITY: Sanitize email content before sending to AI
  const sanitizedContent = sanitizeEmailContent(request.emailContent);
  const userPrompt = getUserPrompt({ ...request, emailContent: sanitizedContent });

  const response = await makeGeminiRequest(apiKey, {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response generated');
  }

  return {
    reply: text.trim(),
  };
}

/**
 * Summarize an email
 */
export async function summarizeEmail(
  emailContent: string,
  language: 'tr' | 'en' = 'tr',
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in Settings > AI.');
  }

  // SECURITY: Sanitize email content
  const sanitizedContent = sanitizeEmailContent(emailContent);

  const prompt =
    language === 'tr'
      ? `Bu e-postayı kısa ve öz bir şekilde özetle (3-5 cümle). Ana konuyu, önemli noktaları ve varsa eylem öğelerini belirt:

E-posta:
${sanitizedContent}

Özet:`
      : `Summarize this email concisely (3-5 sentences). Include the main topic, key points, and any action items:

Email:
${sanitizedContent}

Summary:`;

  const response = await makeGeminiRequest(apiKey, {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 256,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

/**
 * Extract action items from an email
 */
export async function extractActionItems(
  emailContent: string,
  language: 'tr' | 'en' = 'tr',
  apiKey?: string
): Promise<string[]> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in Settings > AI.');
  }

  // SECURITY: Sanitize email content
  const sanitizedContent = sanitizeEmailContent(emailContent);

  const prompt =
    language === 'tr'
      ? `Bu e-postadan yapılması gereken işleri (action items) çıkar. Her bir maddeyi ayrı bir satırda, madde işareti olmadan yaz. Eğer eylem öğesi yoksa "YOK" yaz.

E-posta:
${sanitizedContent}

Eylem öğeleri:`
      : `Extract action items from this email. List each item on a separate line without bullet points. If there are no action items, write "NONE".

Email:
${sanitizedContent}

Action items:`;

  const response = await makeGeminiRequest(apiKey, {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 256,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

  if (text === 'YOK' || text === 'NONE') {
    return [];
  }

  return text
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);
}

/**
 * Analyze email sentiment
 */
export async function analyzeSentiment(
  emailContent: string,
  apiKey?: string
): Promise<'positive' | 'negative' | 'neutral'> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in Settings > AI.');
  }

  // SECURITY: Sanitize email content
  const sanitizedContent = sanitizeEmailContent(emailContent, 5000);

  const prompt = `Analyze the sentiment of this email and respond with exactly one word: "positive", "negative", or "neutral".

Email:
${sanitizedContent}

Sentiment:`;

  const response = await makeGeminiRequest(apiKey, {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 10,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || '';

  if (text.includes('positive')) return 'positive';
  if (text.includes('negative')) return 'negative';
  return 'neutral';
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemPrompt(
  tone: Settings['aiReplyTone'],
  language: 'tr' | 'en'
): string {
  const toneDescriptions = {
    tr: {
      professional:
        'Profesyonel ve resmi bir ton kullan. İş ortamına uygun, net ve kibar ol.',
      friendly: 'Samimi ve sıcak bir ton kullan. Dostça ama saygılı ol.',
      formal: 'Çok resmi bir ton kullan. Protokollere uygun, diplomatik ol.',
      casual: 'Günlük ve rahat bir ton kullan. Doğal ve samimi ol.',
    },
    en: {
      professional:
        'Use a professional and business-appropriate tone. Be clear, concise, and polite.',
      friendly:
        'Use a friendly and warm tone. Be approachable while maintaining respect.',
      formal:
        'Use a very formal tone. Be diplomatic and follow proper protocol.',
      casual: 'Use a casual and relaxed tone. Be natural and conversational.',
    },
  };

  const languageInstruction =
    language === 'tr'
      ? 'Yanıtı Türkçe olarak yaz.'
      : 'Write the response in English.';

  return `Sen bir e-posta yazma asistanısın. ${toneDescriptions[language][tone]} ${languageInstruction}

Kurallar:
- Sadece yanıt metnini yaz, ekstra açıklama ekleme
- Selamlama ve kapanış ekle (mesela "Merhaba" ve "Saygılarımla")
- Kısa ve öz ol
- Orijinal e-postanın bağlamını dikkate al`;
}

function getUserPrompt(request: AIReplyRequest): string {
  const contextPart = request.context
    ? `\n\nÖnceki konuşma:\n${sanitizeEmailContent(request.context, 3000)}`
    : '';

  return `${
    request.language === 'tr'
      ? 'Aşağıdaki e-postaya uygun bir yanıt yaz'
      : 'Write an appropriate reply to the following email'
  }:

---
${request.emailContent}
---${contextPart}

${request.language === 'tr' ? 'Yanıt' : 'Reply'}:`;
}

/**
 * Test API connection
 */
export async function testConnection(apiKey?: string): Promise<boolean> {
  if (!apiKey) {
    return false;
  }
  try {
    const response = await makeGeminiRequest(apiKey, {
      contents: [
        {
          parts: [{ text: 'Say "OK" if you can read this.' }],
        },
      ],
    }, 10000);

    return response.ok;
  } catch {
    return false;
  }
}
