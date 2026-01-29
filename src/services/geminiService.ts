// ============================================================================
// Owlivion Mail - Gemini AI Service
// ============================================================================

import type { AIReplyRequest, AIReplyResponse, Settings } from '../types';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Embedded API Key
const GEMINI_API_KEY = 'REDACTED_API_KEY';

export { GEMINI_API_KEY };

/**
 * Generate AI reply for an email
 */
export async function generateReply(
  request: AIReplyRequest,
  apiKey: string = GEMINI_API_KEY
): Promise<AIReplyResponse> {
  const systemPrompt = getSystemPrompt(request.tone, request.language);
  const userPrompt = getUserPrompt(request);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    }),
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
  apiKey: string = GEMINI_API_KEY
): Promise<string> {
  const prompt =
    language === 'tr'
      ? `Bu e-postayı kısa ve öz bir şekilde özetle (3-5 cümle). Ana konuyu, önemli noktaları ve varsa eylem öğelerini belirt:

E-posta:
${emailContent}

Özet:`
      : `Summarize this email concisely (3-5 sentences). Include the main topic, key points, and any action items:

Email:
${emailContent}

Summary:`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 256,
      },
    }),
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
  apiKey: string = GEMINI_API_KEY
): Promise<string[]> {
  const prompt =
    language === 'tr'
      ? `Bu e-postadan yapılması gereken işleri (action items) çıkar. Her bir maddeyi ayrı bir satırda, madde işareti olmadan yaz. Eğer eylem öğesi yoksa "YOK" yaz.

E-posta:
${emailContent}

Eylem öğeleri:`
      : `Extract action items from this email. List each item on a separate line without bullet points. If there are no action items, write "NONE".

Email:
${emailContent}

Action items:`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 256,
      },
    }),
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
  apiKey: string = GEMINI_API_KEY
): Promise<'positive' | 'negative' | 'neutral'> {
  const prompt = `Analyze the sentiment of this email and respond with exactly one word: "positive", "negative", or "neutral".

Email:
${emailContent}

Sentiment:`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10,
      },
    }),
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
    ? `\n\nÖnceki konuşma:\n${request.context}`
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
export async function testConnection(apiKey: string = GEMINI_API_KEY): Promise<boolean> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Say "OK" if you can read this.' }],
          },
        ],
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
