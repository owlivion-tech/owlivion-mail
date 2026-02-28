// ============================================================================
// Owlivion Mail - Gemini AI Service
// ============================================================================
// SECURITY HARDENED: API key in headers, input sanitization, rate limiting

import type { AIReplyRequest, AIReplyResponse, Settings } from '../types';
import { en } from '../i18n/locales/en';
import type { TranslationKeys } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

const locales: Record<string, TranslationKeys> = { en, tr };

function getTranslation(lang: string, key: string): string {
  const translations = locales[lang] || locales.en;
  const keys = key.split('.');
  let current: unknown = translations;
  for (const k of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return key;
    current = (current as Record<string, unknown>)[k];
  }
  return typeof current === 'string' ? current : key;
}

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Rate limiting state (adjusted for Gemini free tier: 15 req/min)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 4000; // Minimum 4 seconds between requests (safer)
const MAX_REQUESTS_PER_MINUTE = 10; // Keep under free tier limit (15/min)
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
export async function makeGeminiRequest(
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
  const detectedLanguage = detectLanguage(request.emailContent);
  const language = request.language || detectedLanguage;

  if (!apiKey) {
    throw new Error(getTranslation(language, 'aiReply.apiKeyRequired'));
  }

  const systemPrompt = getSystemPrompt(request.tone, language);
  // SECURITY: Sanitize email content before sending to AI
  const sanitizedContent = sanitizeEmailContent(request.emailContent);
  const userPrompt = getUserPrompt({ ...request, language, emailContent: sanitizedContent });

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
  language?: 'tr' | 'en',
  apiKey?: string
): Promise<string> {
  // Auto-detect language if not provided
  const detectedLanguage = language || detectLanguage(emailContent);

  if (!apiKey) {
    throw new Error(getTranslation(detectedLanguage, 'aiReply.apiKeyRequired'));
  }

  // SECURITY: Sanitize email content
  const sanitizedContent = sanitizeEmailContent(emailContent);

  const prompt = `${getTranslation(detectedLanguage, 'gemini.summarizePrompt')}

${getTranslation(detectedLanguage, 'gemini.emailLabel')}
${sanitizedContent}

${getTranslation(detectedLanguage, 'gemini.summaryLabel')}`;

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
  language?: 'tr' | 'en',
  apiKey?: string
): Promise<string[]> {
  // Auto-detect language if not provided
  const detectedLanguage = language || detectLanguage(emailContent);

  if (!apiKey) {
    throw new Error(getTranslation(detectedLanguage, 'aiReply.apiKeyRequired'));
  }

  // SECURITY: Sanitize email content
  const sanitizedContent = sanitizeEmailContent(emailContent);

  const prompt = `${getTranslation(detectedLanguage, 'gemini.actionItemsPrompt')}

${getTranslation(detectedLanguage, 'gemini.emailLabel')}
${sanitizedContent}

${getTranslation(detectedLanguage, 'gemini.actionItemsLabel')}`;

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

  const noneToken = getTranslation(detectedLanguage, 'gemini.none');
  if (text === noneToken || text === 'YOK' || text === 'NONE') {
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
  apiKey?: string,
  language?: 'tr' | 'en'
): Promise<'positive' | 'negative' | 'neutral'> {
  const lang = language || 'en';

  if (!apiKey) {
    throw new Error(getTranslation(lang, 'aiReply.apiKeyRequired'));
  }

  // SECURITY: Sanitize email content
  const sanitizedContent = sanitizeEmailContent(emailContent, 5000);

  const prompt = `${getTranslation(lang, 'gemini.sentimentPrompt')}

${getTranslation(lang, 'gemini.emailLabel')}
${sanitizedContent}

${getTranslation(lang, 'gemini.sentimentLabel')}`;

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

/**
 * Detect language of text (simple heuristic)
 * Returns 'tr' for Turkish, 'en' for English
 */
function detectLanguage(text: string): 'tr' | 'en' {
  if (!text || text.length < 10) return 'tr'; // Default to Turkish

  // Turkish-specific characters
  const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;

  // Common Turkish words
  const turkishWords = /\b(ve|bir|bu|için|ile|olan|gibi|daha|çok|ben|sen|biz|siz|var|yok|ama|veya)\b/gi;

  // Common English words
  const englishWords = /\b(the|and|is|are|was|were|have|has|been|will|would|could|should|can|may|must|this|that|with|from|they|their)\b/gi;

  const hasTurkishChars = turkishChars.test(text);
  const turkishWordCount = (text.match(turkishWords) || []).length;
  const englishWordCount = (text.match(englishWords) || []).length;

  // If has Turkish characters, likely Turkish
  if (hasTurkishChars) return 'tr';

  // Compare word counts
  if (turkishWordCount > englishWordCount) return 'tr';
  if (englishWordCount > turkishWordCount) return 'en';

  // Default to Turkish for Turkish users
  return 'tr';
}

function getSystemPrompt(
  tone: Settings['aiReplyTone'],
  language: 'tr' | 'en'
): string {
  const toneMap: Record<string, string> = {
    professional: 'professionalTone',
    friendly: 'friendlyTone',
    formal: 'formalTone',
    casual: 'casualTone',
  };

  const toneDescription = getTranslation(language, `gemini.${toneMap[tone]}`);
  const languageInstruction = getTranslation(language, language === 'tr' ? 'gemini.writeTurkish' : 'gemini.writeEnglish');

  return `Sen bir e-posta yazma asistanısın. ${toneDescription} ${languageInstruction}

Kurallar:
- Sadece yanıt metnini yaz, ekstra açıklama ekleme
- Selamlama ve kapanış ekle (mesela "Merhaba" ve "Saygılarımla")
- Kısa ve öz ol
- Orijinal e-postanın bağlamını dikkate al`;
}

function getUserPrompt(request: AIReplyRequest): string {
  const lang = request.language || 'tr';
  const contextPart = request.context
    ? `\n\nÖnceki konuşma:\n${sanitizeEmailContent(request.context, 3000)}`
    : '';

  return `${getTranslation(lang, 'gemini.replyToEmail')}:

---
${request.emailContent}
---${contextPart}

${getTranslation(lang, 'gemini.replyLabel')}:`;
}

// ============================================================================
// Phishing Detection
// ============================================================================

export interface PhishingAnalysis {
  isPhishing: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  reasons: string[];
  recommendations: string[];
}

/**
 * Analyze email for phishing indicators using AI
 */
export async function analyzePhishing(
  email: {
    from: { name: string; email: string };
    subject: string;
    body: string;
    bodyHtml?: string;
  },
  language: 'tr' | 'en' = 'tr',
  apiKey?: string
): Promise<PhishingAnalysis> {
  if (!apiKey) {
    // Fall back to rule-based detection if no API key
    return ruleBasedPhishingDetection(email, language);
  }

  try {
    // SECURITY: Sanitize email content
    const sanitizedBody = sanitizeEmailContent(email.body, 8000);

    // Extract links from HTML for analysis
    const links = extractLinks(email.bodyHtml || email.body);

    const linksSection = links.length > 0
      ? `${getTranslation(language, 'gemini.linksFound')}\n${links.slice(0, 10).map(l => `- ${l}`).join('\n')}`
      : '';

    const prompt = `${getTranslation(language, 'gemini.phishingExpert')}

${getTranslation(language, 'gemini.senderLabel')} ${email.from.name} <${email.from.email}>
${getTranslation(language, 'gemini.subjectLabel')} ${email.subject}
${getTranslation(language, 'gemini.contentLabel')}
${sanitizedBody}

${linksSection}

${getTranslation(language, 'gemini.analysisCriteria')}

JSON formatında yanıt ver (sadece JSON, açıklama yok) / Respond in JSON format only (no explanation):
{
  "isPhishing": boolean,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "score": 0-100,
  "reasons": ["reason1", "reason2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

    const response = await makeGeminiRequest(apiKey, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
      },
    });

    if (!response.ok) {
      // Fall back to rule-based on API error
      return ruleBasedPhishingDetection(email, language);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        isPhishing: result.isPhishing ?? false,
        riskLevel: result.riskLevel ?? 'low',
        score: Math.min(100, Math.max(0, result.score ?? 0)),
        reasons: result.reasons ?? [],
        recommendations: result.recommendations ?? [],
      };
    }

    return ruleBasedPhishingDetection(email, language);
  } catch {
    // Fall back to rule-based on any error
    return ruleBasedPhishingDetection(email, language);
  }
}

/**
 * Extract links from email content
 */
function extractLinks(content: string): string[] {
  const linkRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = content.match(linkRegex) || [];
  return [...new Set(matches)];
}

/**
 * Rule-based phishing detection (fallback when AI unavailable)
 */
function ruleBasedPhishingDetection(
  email: {
    from: { name: string; email: string };
    subject: string;
    body: string;
    bodyHtml?: string;
  },
  language: 'tr' | 'en'
): PhishingAnalysis {
  const reasons: string[] = [];
  let score = 0;
  const content = (email.body + ' ' + email.subject).toLowerCase();
  const fromEmail = email.from.email.toLowerCase();
  const fromName = email.from.name.toLowerCase();

  // 1. Sender mismatch detection (IMPROVED: More strict matching to reduce false positives)
  const knownBrands = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook', 'netflix', 'bank', 'instagram', 'whatsapp', 'telegram'];
  for (const brand of knownBrands) {
    // Only flag if sender name EXACTLY matches or STARTS with the brand (e.g., "PayPal" or "PayPal Support")
    // Ignore if brand is just mentioned in context (e.g., "Update about PayPal integration")
    const nameWords = fromName.split(/\s+/);
    const hasBrandAsWord = nameWords.some(word => word === brand || word === brand + '.' || word === brand + ',');

    if (hasBrandAsWord && !fromEmail.includes(brand)) {
      score += 30;
      reasons.push(getTranslation(language, 'gemini.brandMismatch').replace('{brand}', brand));
    }
  }

  // 2. Suspicious domains
  const suspiciousTlds = ['.xyz', '.top', '.click', '.link', '.info', '.tk', '.ml', '.ga', '.cf', '.gq'];
  for (const tld of suspiciousTlds) {
    if (fromEmail.endsWith(tld)) {
      score += 20;
      reasons.push(getTranslation(language, 'gemini.suspiciousTld').replace('{tld}', tld));
    }
  }

  // 3. Urgency keywords
  const urgencyKeywords = language === 'tr'
    ? ['acil', 'hemen', 'şimdi', 'son şans', 'hesabınız kapatılacak', 'askıya alındı', '24 saat', '48 saat', 'derhal']
    : ['urgent', 'immediately', 'act now', 'last chance', 'suspended', 'closed', '24 hours', '48 hours', 'verify now'];

  for (const keyword of urgencyKeywords) {
    if (content.includes(keyword)) {
      score += 10;
      reasons.push(getTranslation(language, 'gemini.urgencyKeyword').replace('{keyword}', keyword));
      break; // Only count once
    }
  }

  // 4. Sensitive info requests
  const sensitiveKeywords = language === 'tr'
    ? ['şifre', 'parola', 'kredi kartı', 'kart numarası', 'cvv', 'tc kimlik', 'banka hesabı', 'iban', 'pin kod']
    : ['password', 'credit card', 'card number', 'cvv', 'ssn', 'social security', 'bank account', 'iban', 'pin'];

  for (const keyword of sensitiveKeywords) {
    if (content.includes(keyword)) {
      score += 15;
      reasons.push(getTranslation(language, 'gemini.sensitiveRequest').replace('{keyword}', keyword));
      break;
    }
  }

  // 5. Suspicious links in HTML
  const links = extractLinks(email.bodyHtml || email.body);
  for (const link of links) {
    // Check for IP address URLs
    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(link)) {
      score += 25;
      reasons.push(getTranslation(language, 'gemini.suspiciousIpLink'));
      break;
    }
    // Check for URL shorteners
    const shorteners = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly'];
    for (const shortener of shorteners) {
      if (link.includes(shortener)) {
        score += 15;
        reasons.push(getTranslation(language, 'gemini.shortenedLink').replace('{shortener}', shortener));
        break;
      }
    }
  }

  // 6. Too good to be true
  const scamKeywords = language === 'tr'
    ? ['kazandınız', 'ödül', 'piyango', 'miras', 'milyon dolar', 'ücretsiz', 'hediye']
    : ['you won', 'winner', 'lottery', 'inheritance', 'million dollars', 'free gift', 'prize'];

  for (const keyword of scamKeywords) {
    if (content.includes(keyword)) {
      score += 20;
      reasons.push(getTranslation(language, 'gemini.fraudIndicator').replace('{keyword}', keyword));
      break;
    }
  }

  // Determine risk level (UPDATED: Higher thresholds to reduce false positives)
  let riskLevel: PhishingAnalysis['riskLevel'];
  if (score >= 80) riskLevel = 'critical';   // Was 60 - very high confidence phishing
  else if (score >= 60) riskLevel = 'high';  // Was 40 - likely phishing
  else if (score >= 30) riskLevel = 'medium'; // Was 20 - suspicious but uncertain
  else riskLevel = 'low';

  // Generate recommendations
  const recommendations: string[] = [];
  if (score >= 30) {
    recommendations.push(getTranslation(language, 'gemini.dontClickLinks'));
    recommendations.push(getTranslation(language, 'gemini.dontShareInfo'));
    if (score >= 60) {
      recommendations.push(getTranslation(language, 'gemini.markAsSpam'));
      recommendations.push(getTranslation(language, 'gemini.goToOfficialSite'));
    }
  }

  return {
    isPhishing: score >= 60,  // FIXED: Was 40, now 60 to reduce false positives
    riskLevel,
    score: Math.min(100, score),
    reasons,
    recommendations,
  };
}

// ============================================================================
// Email Tracking Detection
// ============================================================================

export interface TrackingAnalysis {
  hasTracking: boolean;
  isMarketingEmail: boolean;
  trackingPixels: TrackingPixel[];
  trackingLinks: string[];
  trackingServices: string[];
  recommendations: string[];
}

export interface TrackingPixel {
  url: string;
  service: string;
  type: 'pixel' | 'beacon' | 'image';
}

// Known email tracking/marketing services
const TRACKING_DOMAINS: Record<string, string> = {
  // Email Service Providers
  'mailchimp.com': 'Mailchimp',
  'list-manage.com': 'Mailchimp',
  'mailchi.mp': 'Mailchimp',
  'sendgrid.net': 'SendGrid',
  'sendgrid.com': 'SendGrid',
  'hubspot.com': 'HubSpot',
  'hs-analytics.net': 'HubSpot',
  'hubspotemail.net': 'HubSpot',
  'constantcontact.com': 'Constant Contact',
  'ctctcdn.com': 'Constant Contact',
  'mailgun.org': 'Mailgun',
  'mailgun.com': 'Mailgun',
  'amazonses.com': 'Amazon SES',
  'awstrack.me': 'Amazon SES',
  'sendinblue.com': 'Sendinblue',
  'sibforms.com': 'Sendinblue',
  'getresponse.com': 'GetResponse',
  'activecampaign.com': 'ActiveCampaign',
  'klaviyo.com': 'Klaviyo',
  'drip.com': 'Drip',
  'convertkit.com': 'ConvertKit',
  'moosend.com': 'Moosend',
  'omnisend.com': 'Omnisend',
  'mailerlite.com': 'MailerLite',
  'campaignmonitor.com': 'Campaign Monitor',
  'cmail19.com': 'Campaign Monitor',
  'cmail20.com': 'Campaign Monitor',
  'postmarkapp.com': 'Postmark',
  'intercom.io': 'Intercom',
  'intercomcdn.com': 'Intercom',
  'mixmax.com': 'Mixmax',
  'yesware.com': 'Yesware',
  'mailtrack.io': 'Mailtrack',
  'streak.com': 'Streak',
  'bananatag.com': 'Bananatag',
  'cirrusinsight.com': 'Cirrus Insight',
  'salesloft.com': 'SalesLoft',
  'outreach.io': 'Outreach',
  'reply.io': 'Reply.io',
  'lemlist.com': 'Lemlist',
  'woodpecker.co': 'Woodpecker',

  // Analytics & Tracking
  'google-analytics.com': 'Google Analytics',
  'doubleclick.net': 'Google Ads',
  'googleadservices.com': 'Google Ads',
  'facebook.com/tr': 'Facebook Pixel',
  'pixel.facebook.com': 'Facebook Pixel',
  'ads.linkedin.com': 'LinkedIn Ads',
  'px.ads.linkedin.com': 'LinkedIn Pixel',
  'twitter.com/i/adsct': 'Twitter Ads',
  't.co': 'Twitter',

  // Turkish Marketing Services
  'euromsg.com': 'Euromessage',
  'emarsys.net': 'Emarsys',
  'iletimerkezi.com': 'İleti Merkezi',
  'netgsm.com.tr': 'Netgsm',

  // Other Tracking
  'litmus.com': 'Litmus',
  'emailonacid.com': 'Email on Acid',
  'returnpath.net': 'Return Path',
  'validity.com': 'Validity',
  'sparkpost.com': 'SparkPost',
  'mandrillapp.com': 'Mandrill',
  'exacttarget.com': 'Salesforce Marketing',
  'sfmc-content.com': 'Salesforce Marketing',
  'pardot.com': 'Pardot',
  'marketo.com': 'Marketo',
  'mktocdn.com': 'Marketo',
  'eloqua.com': 'Oracle Eloqua',
  'braze.com': 'Braze',
  'iterable.com': 'Iterable',
  'customer.io': 'Customer.io',
  'sailthru.com': 'Sailthru',
  'responsys.net': 'Oracle Responsys',
  'cheetahmail.com': 'Cheetah Digital',
  'experian.com': 'Experian',
  'acxiom.com': 'Acxiom',
  'bluekai.com': 'Oracle BlueKai',
  'krxd.net': 'Krux',
  'demdex.net': 'Adobe Audience Manager',
  'omtrdc.net': 'Adobe Analytics',
};

/**
 * Detect email tracking and marketing indicators
 */
export function detectEmailTracking(bodyHtml: string, language: 'tr' | 'en' = 'tr'): TrackingAnalysis {
  const trackingPixels: TrackingPixel[] = [];
  const trackingLinks: string[] = [];
  const trackingServicesSet = new Set<string>();
  const recommendations: string[] = [];

  if (!bodyHtml) {
    return {
      hasTracking: false,
      isMarketingEmail: false,
      trackingPixels: [],
      trackingLinks: [],
      trackingServices: [],
      recommendations: [],
    };
  }

  const htmlLower = bodyHtml.toLowerCase();

  // 1. Detect tracking pixels (1x1 images or very small images)
  const imgRegex = /<img[^>]*>/gi;
  const imgMatches = bodyHtml.match(imgRegex) || [];

  for (const img of imgMatches) {
    const srcMatch = img.match(/src=["']([^"']+)["']/i);
    const widthMatch = img.match(/width=["']?(\d+)/i);
    const heightMatch = img.match(/height=["']?(\d+)/i);
    const styleMatch = img.match(/style=["']([^"']+)["']/i);

    if (srcMatch) {
      const src = srcMatch[1];
      const width = widthMatch ? parseInt(widthMatch[1]) : null;
      const height = heightMatch ? parseInt(heightMatch[1]) : null;

      // Check for tiny images (tracking pixels)
      const isTinyImage = (width !== null && width <= 3) || (height !== null && height <= 3);

      // Check for hidden images via style
      const isHidden = styleMatch && (
        styleMatch[1].includes('display:none') ||
        styleMatch[1].includes('display: none') ||
        styleMatch[1].includes('visibility:hidden') ||
        styleMatch[1].includes('opacity:0') ||
        (styleMatch[1].includes('width:1') || styleMatch[1].includes('width: 1')) ||
        (styleMatch[1].includes('height:1') || styleMatch[1].includes('height: 1'))
      );

      // Check if URL matches known tracking domains
      const service = getTrackingService(src);

      if (isTinyImage || isHidden || service) {
        trackingPixels.push({
          url: src,
          service: service || 'Unknown',
          type: (isTinyImage || isHidden) ? 'pixel' : 'beacon',
        });
        if (service) {
          trackingServicesSet.add(service);
        }
      }
    }
  }

  // 2. Detect tracking links
  const linkRegex = /href=["']([^"']+)["']/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(bodyHtml)) !== null) {
    const url = linkMatch[1];
    const service = getTrackingService(url);

    if (service) {
      trackingLinks.push(url);
      trackingServicesSet.add(service);
    }

    // Check for click tracking patterns
    if (
      url.includes('/track/') ||
      url.includes('/click/') ||
      url.includes('/c/') ||
      url.includes('?utm_') ||
      url.includes('&utm_') ||
      url.includes('/redirect/') ||
      url.includes('/r/') ||
      url.includes('/l/') ||
      url.includes('click.') ||
      url.includes('track.') ||
      url.includes('email.') ||
      url.includes('links.') ||
      url.includes('go.') ||
      url.includes('open.')
    ) {
      if (!trackingLinks.includes(url)) {
        trackingLinks.push(url);
      }
    }
  }

  // 3. Detect marketing email indicators
  const marketingIndicators = [
    'unsubscribe',
    'abonelikten çık',
    'aboneliği iptal',
    'listeden çık',
    'tercihlerinizi yönet',
    'manage preferences',
    'email preferences',
    'opt-out',
    'opt out',
    'view in browser',
    'tarayıcıda görüntüle',
    'web versiyonu',
    'privacy policy',
    'gizlilik politikası',
    '© 20', // Copyright year
    'all rights reserved',
    'tüm hakları saklıdır',
  ];

  let marketingScore = 0;
  for (const indicator of marketingIndicators) {
    if (htmlLower.includes(indicator)) {
      marketingScore++;
    }
  }

  const isMarketingEmail = marketingScore >= 2 || trackingServicesSet.size > 0;
  const hasTracking = trackingPixels.length > 0 || trackingLinks.length > 0;

  // Generate recommendations
  if (hasTracking) {
    recommendations.push(getTranslation(language, 'gemini.hasTrackingPixels'));
  }

  if (isMarketingEmail) {
    recommendations.push(getTranslation(language, 'gemini.isMarketingEmail'));
    if (htmlLower.includes('unsubscribe') || htmlLower.includes('abonelik')) {
      recommendations.push(getTranslation(language, 'gemini.canUnsubscribe'));
    }
  }

  if (trackingServicesSet.size > 0) {
    recommendations.push(`${getTranslation(language, 'gemini.detectedServices')} ${Array.from(trackingServicesSet).join(', ')}`);
  }

  return {
    hasTracking,
    isMarketingEmail,
    trackingPixels,
    trackingLinks: [...new Set(trackingLinks)].slice(0, 10), // Limit to 10
    trackingServices: Array.from(trackingServicesSet),
    recommendations,
  };
}

/**
 * Get tracking service name from URL
 */
function getTrackingService(url: string): string | null {
  const urlLower = url.toLowerCase();

  for (const [domain, service] of Object.entries(TRACKING_DOMAINS)) {
    if (urlLower.includes(domain)) {
      return service;
    }
  }

  return null;
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

/**
 * Extract text from Gemini API response JSON
 */
export function extractGeminiText(data: Record<string, unknown>): string {
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  return candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

/**
 * Email categorization result
 */
export interface CategorizationResult {
  category: string;
  confidence: number;
  subcategory?: string;
  suggestedLabels?: string[];
  newLabelSuggestions?: string[];
  reasoning?: string;
}
