// ============================================================================
// Unified AI Service — Multi-Provider Abstraction
// ============================================================================
// Supports: Gemini, Claude, OpenAI, Ollama
// Public: User selects provider + provides API key
// Private: Defaults to Claude with owner's key
//

import type { Settings } from '../types';
import { isPrivateBuild } from '../config/buildVariant';
import * as geminiService from './geminiService';
import * as ollamaService from './ollamaService';
import type { PhishingAnalysis } from './geminiService';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AIProvider = Settings['aiProvider'];

export interface AIReplyOptions {
  emailContent: string;
  emailSubject: string;
  senderName: string;
  tone: Settings['aiReplyTone'];
  language: 'tr' | 'en';
}

export interface AIReplyResult {
  reply: string;
  provider: AIProvider;
}

export interface AISummarizeResult {
  summary: string;
  provider: AIProvider;
}

export interface AIPhishingResult extends PhishingAnalysis {
  provider: AIProvider;
}

// ─── Provider Config ────────────────────────────────────────────────────────

interface ProviderInfo {
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyUrl?: string;
  apiKeyPlaceholder: string;
  models: string[];
  defaultModel: string;
}

export const PROVIDERS: Record<AIProvider, ProviderInfo> = {
  gemini: {
    name: 'Google Gemini',
    description: 'Google AI — fast, reliable, free tier available',
    requiresApiKey: true,
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    apiKeyPlaceholder: 'AIzaSy...',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash',
  },
  claude: {
    name: 'Anthropic Claude',
    description: 'Claude AI — excellent reasoning, nuanced writing',
    requiresApiKey: true,
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyPlaceholder: 'sk-ant-...',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT models — widely used, versatile',
    requiresApiKey: true,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyPlaceholder: 'sk-...',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    defaultModel: 'gpt-4o-mini',
  },
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run AI locally — 100% private, no data leaves your device',
    requiresApiKey: false,
    apiKeyPlaceholder: '',
    models: ['llama3.2', 'llama3.1', 'mistral', 'phi3', 'gemma2'],
    defaultModel: 'llama3.2',
  },
};

// ─── Effective Settings ─────────────────────────────────────────────────────

export function getEffectiveProvider(settings: Settings): AIProvider {
  if (isPrivateBuild) return 'claude';
  return settings.aiProvider || 'gemini';
}

export function getEffectiveApiKey(settings: Settings): string | undefined {
  const provider = getEffectiveProvider(settings);

  if (isPrivateBuild && provider === 'claude') {
    // Private build: Use configured key or env
    return settings.aiApiKey || undefined;
  }

  // Use universal key, or fall back to legacy gemini key
  return settings.aiApiKey || (provider === 'gemini' ? settings.geminiApiKey : undefined);
}

export function getEffectiveModel(settings: Settings): string {
  const provider = getEffectiveProvider(settings);
  return settings.aiModel || PROVIDERS[provider].defaultModel;
}

// ─── Claude API ─────────────────────────────────────────────────────────────

async function claudeGenerate(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string = 'claude-sonnet-4-20250514',
  maxTokens: number = 1024,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ─── OpenAI API ─────────────────────────────────────────────────────────────

async function openaiGenerate(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string = 'gpt-4o-mini',
  maxTokens: number = 1024,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Prompt Templates ───────────────────────────────────────────────────────

function getReplySystemPrompt(tone: string, language: string): string {
  const lang = language === 'tr' ? 'Turkish' : 'English';
  const toneMap: Record<string, string> = {
    professional: 'professional and business-appropriate',
    friendly: 'warm and approachable',
    formal: 'highly formal and respectful',
    casual: 'relaxed and conversational',
  };
  const toneDesc = toneMap[tone] || toneMap.professional;

  return `You are an email assistant. Write a ${toneDesc} reply in ${lang}.
Keep it concise and natural. Only output the reply text — no subject line, no greetings metadata, no explanations.`;
}

function getSummarizeSystemPrompt(language: string): string {
  const lang = language === 'tr' ? 'Turkish' : 'English';
  return `Summarize this email in 2-3 sentences in ${lang}. Be concise and capture the key points. Only output the summary.`;
}

function getPhishingSystemPrompt(language: string): string {
  const lang = language === 'tr' ? 'Turkish' : 'English';
  return `You are a cybersecurity expert. Analyze this email for phishing indicators.
Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "isPhishing": boolean,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "score": number (0-100),
  "reasons": ["reason1", "reason2"],
  "recommendations": ["rec1", "rec2"]
}
Provide reasons and recommendations in ${lang}.`;
}

// ─── Sanitization ───────────────────────────────────────────────────────────

function sanitizeContent(content: string, maxLength: number = 5000): string {
  let clean = content;
  // Remove excessive whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  // Truncate
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength) + '...';
  }
  return clean;
}

// ─── Unified API ────────────────────────────────────────────────────────────

export async function generateReply(
  options: AIReplyOptions,
  settings: Settings,
): Promise<AIReplyResult> {
  const provider = getEffectiveProvider(settings);
  const apiKey = getEffectiveApiKey(settings);
  const model = getEffectiveModel(settings);
  const systemPrompt = getReplySystemPrompt(options.tone, options.language);
  const userMessage = sanitizeContent(
    `Email from ${options.senderName}:\nSubject: ${options.emailSubject}\n\n${options.emailContent}`
  );

  let reply: string;

  switch (provider) {
    case 'gemini': {
      if (!apiKey) throw new Error('Gemini API key required');
      const result = await geminiService.generateReply(
        { emailContent: options.emailContent, tone: options.tone, language: options.language },
        apiKey
      );
      reply = result.reply;
      break;
    }
    case 'claude': {
      if (!apiKey) throw new Error('Claude API key required');
      reply = await claudeGenerate(systemPrompt, userMessage, apiKey, model);
      break;
    }
    case 'openai': {
      if (!apiKey) throw new Error('OpenAI API key required');
      reply = await openaiGenerate(systemPrompt, userMessage, apiKey, model);
      break;
    }
    case 'ollama': {
      reply = await ollamaService.generateReply(
        options.emailContent,
        options.tone,
        options.senderName,
        options.language,
        settings.ollamaModel || 'llama3.2',
        settings.ollamaUrl || 'http://localhost:11434',
      );
      break;
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  return { reply, provider };
}

export async function summarizeEmail(
  content: string,
  language: 'tr' | 'en',
  settings: Settings,
): Promise<AISummarizeResult> {
  const provider = getEffectiveProvider(settings);
  const apiKey = getEffectiveApiKey(settings);
  const model = getEffectiveModel(settings);
  const systemPrompt = getSummarizeSystemPrompt(language);
  const userMessage = sanitizeContent(content);

  let summary: string;

  switch (provider) {
    case 'gemini': {
      summary = await geminiService.summarizeEmail(content, language, apiKey);
      break;
    }
    case 'claude': {
      if (!apiKey) throw new Error('Claude API key required');
      summary = await claudeGenerate(systemPrompt, userMessage, apiKey, model, 512);
      break;
    }
    case 'openai': {
      if (!apiKey) throw new Error('OpenAI API key required');
      summary = await openaiGenerate(systemPrompt, userMessage, apiKey, model, 512);
      break;
    }
    case 'ollama': {
      summary = await ollamaService.summarizeEmail(
        content, language,
        settings.ollamaModel || 'llama3.2',
        settings.ollamaUrl || 'http://localhost:11434',
      );
      break;
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  return { summary, provider };
}

export async function analyzePhishing(
  email: { from: { name: string; email: string }; subject: string; body: string; bodyHtml?: string },
  language: 'tr' | 'en',
  settings: Settings,
): Promise<AIPhishingResult> {
  const provider = getEffectiveProvider(settings);
  const apiKey = getEffectiveApiKey(settings);
  const model = getEffectiveModel(settings);

  let analysis: PhishingAnalysis;

  switch (provider) {
    case 'gemini': {
      analysis = await geminiService.analyzePhishing(email, language, apiKey);
      break;
    }
    case 'claude':
    case 'openai': {
      if (!apiKey) {
        // Fall back to rule-based
        analysis = await geminiService.analyzePhishing(email, language, undefined);
        break;
      }
      const systemPrompt = getPhishingSystemPrompt(language);
      const userMessage = sanitizeContent(
        `From: ${email.from.name} <${email.from.email}>\nSubject: ${email.subject}\n\n${email.body}`,
        3000
      );

      const responseText = provider === 'claude'
        ? await claudeGenerate(systemPrompt, userMessage, apiKey, model, 512)
        : await openaiGenerate(systemPrompt, userMessage, apiKey, model, 512);

      try {
        // Strip markdown code blocks if present
        const jsonStr = responseText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        analysis = JSON.parse(jsonStr);
      } catch {
        // Parsing failed — fall back to rule-based
        analysis = await geminiService.analyzePhishing(email, language, undefined);
      }
      break;
    }
    case 'ollama': {
      analysis = await ollamaService.analyzePhishing(
        email, language,
        settings.ollamaModel || 'llama3.2',
        settings.ollamaUrl || 'http://localhost:11434',
      );
      break;
    }
    default:
      analysis = await geminiService.analyzePhishing(email, language, undefined);
  }

  return { ...analysis, provider };
}

// Re-export tracking detection (always local, no provider needed)
export { detectEmailTracking } from './geminiService';
