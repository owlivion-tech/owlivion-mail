// ============================================================================
// Owlivion Mail - Ollama Local LLM Service
// ============================================================================
// 100% local AI — no data leaves the device

import { invoke } from '@tauri-apps/api/core';
import type { CategorizationResult, PhishingAnalysis } from './geminiService';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// ============================================================================
// Core API
// ============================================================================

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

async function ollamaGenerate(
  prompt: string,
  model: string,
  baseUrl: string = DEFAULT_OLLAMA_URL,
  systemPrompt?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 1024,
    },
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await invoke<OllamaGenerateResponse>('ollama_request', {
    url: `${baseUrl}/api/generate`,
    body,
  });

  return response.response || '';
}

// ============================================================================
// Model Management
// ============================================================================

export async function listModels(baseUrl: string = DEFAULT_OLLAMA_URL): Promise<OllamaModel[]> {
  try {
    const response = await invoke<{ models: OllamaModel[] }>('ollama_list_models', { baseUrl });
    return response.models || [];
  } catch {
    return [];
  }
}

export async function testConnection(baseUrl: string = DEFAULT_OLLAMA_URL): Promise<boolean> {
  try {
    const models = await listModels(baseUrl);
    return models.length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Email Categorization (Local)
// ============================================================================

export async function categorizeEmail(
  email: { from: { name: string; email: string }; subject: string; body: string },
  availableLabels: string[],
  language: 'tr' | 'en' = 'tr',
  model: string = 'llama3.2',
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<CategorizationResult> {
  const labelList = availableLabels.length > 0
    ? availableLabels.join(', ')
    : 'Work, Personal, Finance, Newsletter, Social, Updates, Promotions';

  const truncatedBody = (email.body || '').slice(0, 3000);

  const prompt = language === 'tr'
    ? `Asagidaki e-postayi analiz et ve kategorize et.

Gonderen: ${email.from.name} <${email.from.email}>
Konu: ${email.subject}
Icerik: ${truncatedBody}

Mevcut etiketler: ${labelList}

JSON formatinda yanit ver (baska bir sey yazma):
{"suggestedLabels": ["etiket1"], "newLabelSuggestions": [], "confidence": 0.8, "reasoning": "kisa aciklama"}`
    : `Analyze and categorize this email.

From: ${email.from.name} <${email.from.email}>
Subject: ${email.subject}
Content: ${truncatedBody}

Available labels: ${labelList}

Respond in JSON only (nothing else):
{"suggestedLabels": ["label1"], "newLabelSuggestions": [], "confidence": 0.8, "reasoning": "brief explanation"}`;

  try {
    const response = await ollamaGenerate(prompt, model, baseUrl,
      'You are an email categorization assistant. Always respond with valid JSON only.');

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || 'uncategorized',
        suggestedLabels: (parsed.suggestedLabels || []).slice(0, 3),
        newLabelSuggestions: (parsed.newLabelSuggestions || []).slice(0, 2),
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || '',
      };
    }
  } catch (err) {
    console.error('Ollama categorization failed:', err);
  }

  return { category: 'uncategorized', suggestedLabels: [], newLabelSuggestions: [], confidence: 0, reasoning: '' };
}

// ============================================================================
// Email Summarization (Local)
// ============================================================================

export async function summarizeEmail(
  emailContent: string,
  language: 'tr' | 'en' = 'tr',
  model: string = 'llama3.2',
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<string> {
  const truncated = emailContent.slice(0, 5000);

  const prompt = language === 'tr'
    ? `Bu e-postayi 2-3 cumle ile ozetle:\n\n${truncated}`
    : `Summarize this email in 2-3 sentences:\n\n${truncated}`;

  try {
    return await ollamaGenerate(prompt, model, baseUrl,
      language === 'tr'
        ? 'Sen bir e-posta ozetleme asistanisin. Kisa ve net ozetler yaz.'
        : 'You are an email summarization assistant. Write brief, clear summaries.');
  } catch (err) {
    console.error('Ollama summarization failed:', err);
    return '';
  }
}

// ============================================================================
// AI Reply Generation (Local)
// ============================================================================

export async function generateReply(
  emailContent: string,
  tone: 'professional' | 'friendly' | 'formal' | 'casual',
  senderName: string,
  language: 'tr' | 'en' = 'tr',
  model: string = 'llama3.2',
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<string> {
  const truncated = emailContent.slice(0, 4000);
  const toneMap = {
    professional: language === 'tr' ? 'profesyonel' : 'professional',
    friendly: language === 'tr' ? 'samimi' : 'friendly',
    formal: language === 'tr' ? 'resmi' : 'formal',
    casual: language === 'tr' ? 'gunluk' : 'casual',
  };

  const prompt = language === 'tr'
    ? `Bu e-postaya ${toneMap[tone]} tonda bir yanit yaz. Imza olarak "${senderName}" kullan.\n\nE-posta:\n${truncated}`
    : `Write a ${toneMap[tone]} reply to this email. Sign as "${senderName}".\n\nEmail:\n${truncated}`;

  try {
    return await ollamaGenerate(prompt, model, baseUrl,
      language === 'tr'
        ? 'Sen bir e-posta yazma asistanisin. Sadece e-posta yanitini yaz.'
        : 'You are an email writing assistant. Write only the email reply.');
  } catch (err) {
    console.error('Ollama reply generation failed:', err);
    return '';
  }
}

// ============================================================================
// Phishing Analysis (Local)
// ============================================================================

// PhishingAnalysis type imported at the top from geminiService

export async function analyzePhishing(
  email: { from: { name: string; email: string }; subject: string; body: string },
  language: 'tr' | 'en' = 'tr',
  model: string = 'llama3.2',
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<PhishingAnalysis> {
  const truncated = (email.body || '').slice(0, 3000);

  const prompt = language === 'tr'
    ? `Bu e-postayi phishing/dolandiricilik acisindan analiz et.

Gonderen: ${email.from.name} <${email.from.email}>
Konu: ${email.subject}
Icerik: ${truncated}

JSON formatinda yanit ver:
{"score": 0-100, "riskLevel": "low|medium|high|critical", "indicators": ["gosterge1"], "recommendation": "tavsiye"}`
    : `Analyze this email for phishing/fraud.

From: ${email.from.name} <${email.from.email}>
Subject: ${email.subject}
Content: ${truncated}

Respond in JSON only:
{"score": 0-100, "riskLevel": "low|medium|high|critical", "indicators": ["indicator1"], "recommendation": "advice"}`;

  try {
    const response = await ollamaGenerate(prompt, model, baseUrl,
      'You are a cybersecurity expert analyzing emails for phishing. Respond with JSON only.');

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const score = Math.min(100, Math.max(0, parsed.score || 0));
      const riskLevel = ['low', 'medium', 'high', 'critical'].includes(parsed.riskLevel) ? parsed.riskLevel : 'low';
      const reasons = Array.isArray(parsed.indicators) ? parsed.indicators : [];
      const recommendation = parsed.recommendation || '';
      return {
        isPhishing: score >= 50,
        riskLevel,
        score,
        reasons,
        recommendations: recommendation ? [recommendation] : [],
      };
    }
  } catch (err) {
    console.error('Ollama phishing analysis failed:', err);
  }

  return { isPhishing: false, riskLevel: 'low', score: 0, reasons: [], recommendations: [] };
}
