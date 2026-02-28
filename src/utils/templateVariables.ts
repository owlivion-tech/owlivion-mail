import type { TemplateVariable, TemplateContext, EmailAddress, Account } from '../types';
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

/**
 * Create localized template variables
 */
function createTemplateVariables(lang: string): TemplateVariable[] {
  const t = (key: string) => getTranslation(lang, key);
  return [
    // Sender variables
    {
      key: 'sender_name',
      label: t('templateVariables.senderName'),
      description: t('templateVariables.senderNameDesc'),
      example: 'Ali Veli',
      category: 'sender',
    },
    {
      key: 'sender_email',
      label: t('templateVariables.senderEmail'),
      description: t('templateVariables.senderEmailDesc'),
      example: 'ali@example.com',
      category: 'sender',
    },
    {
      key: 'sender_title',
      label: t('templateVariables.senderTitle'),
      description: t('templateVariables.senderTitleDesc'),
      example: 'Software Developer',
      category: 'sender',
    },
    {
      key: 'sender_phone',
      label: t('templateVariables.senderPhone'),
      description: t('templateVariables.senderPhoneDesc'),
      example: '+90 555 123 4567',
      category: 'sender',
    },
    {
      key: 'sender_company',
      label: t('templateVariables.senderCompany'),
      description: t('templateVariables.senderCompanyDesc'),
      example: 'Owlivion',
      category: 'sender',
    },
    {
      key: 'sender_website',
      label: t('templateVariables.senderWebsite'),
      description: t('templateVariables.senderWebsiteDesc'),
      example: 'https://owlivion.com',
      category: 'sender',
    },

    // Recipient variables
    {
      key: 'recipient_name',
      label: t('templateVariables.recipientName'),
      description: t('templateVariables.recipientNameDesc'),
      example: 'Jane Doe',
      category: 'recipient',
    },
    {
      key: 'recipient_email',
      label: t('templateVariables.recipientEmail'),
      description: t('templateVariables.recipientEmailDesc'),
      example: 'jane@example.com',
      category: 'recipient',
    },
    {
      key: 'recipient_company',
      label: t('templateVariables.recipientCompany'),
      description: t('templateVariables.recipientCompanyDesc'),
      example: 'ABC Corp',
      category: 'recipient',
    },

    // DateTime variables
    {
      key: 'date',
      label: t('templateVariables.date'),
      description: t('templateVariables.dateDesc'),
      example: '06/02/2026',
      category: 'datetime',
    },
    {
      key: 'time',
      label: t('templateVariables.time'),
      description: t('templateVariables.timeDesc'),
      example: '14:30',
      category: 'datetime',
    },
    {
      key: 'datetime',
      label: t('templateVariables.datetime'),
      description: t('templateVariables.datetimeDesc'),
      example: '06/02/2026 14:30',
      category: 'datetime',
    },
  ];
}

/**
 * Available template variables (default English, backward compat)
 */
export const TEMPLATE_VARIABLES: TemplateVariable[] = createTemplateVariables('en');

/**
 * Get localized template variables
 */
export function getTemplateVariables(lang: string = 'en'): TemplateVariable[] {
  return createTemplateVariables(lang);
}

/**
 * Build template context from account and recipient data
 */
export function buildTemplateContext(
  account?: Account,
  recipient?: EmailAddress,
  customVars?: Record<string, string>,
  lang: string = 'en'
): TemplateContext {
  const now = new Date();
  const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US';

  // Format date and time
  const date = now.toLocaleDateString(dateLocale);
  const time = now.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  const datetime = `${date} ${time}`;

  // Extract sender info from account signature or defaults
  const senderName = account?.email.split('@')[0] || '';
  const senderEmail = account?.email || '';

  // Parse signature for additional info (if exists)
  let senderTitle = '';
  let senderPhone = '';
  let senderCompany = '';
  let senderWebsite = '';

  if (account?.signature) {
    // Simple parsing - could be enhanced
    const lines = account.signature.replace(/<[^>]*>/g, '').split('\n');
    lines.forEach(line => {
      if (line.includes('Tel:') || line.includes('Phone:')) {
        senderPhone = line.split(':')[1]?.trim() || '';
      }
      if (line.includes('Website:') || line.includes('Web:')) {
        senderWebsite = line.split(':')[1]?.trim() || '';
      }
    });
  }

  // Extract recipient info
  const recipientName = recipient?.name || '';
  const recipientEmail = recipient?.email || '';

  const context: TemplateContext = {
    sender_name: senderName,
    sender_email: senderEmail,
    sender_title: senderTitle,
    sender_phone: senderPhone,
    sender_company: senderCompany,
    sender_website: senderWebsite,
    recipient_name: recipientName,
    recipient_email: recipientEmail,
    recipient_company: '',
    date,
    time,
    datetime,
    ...customVars,
  };

  return context;
}

/**
 * Replace template variables with actual values
 * Format: {{ variable_name }}
 */
export function replaceTemplateVariables(
  template: string,
  context: TemplateContext
): string {
  if (!template) return '';

  let result = template;

  // Replace all variables in format {{ variable_name }}
  const regex = /\{\{\s*(\w+)\s*\}\}/g;

  result = result.replace(regex, (_match, key) => {
    const value = context[key];
    // If value exists and is not empty, use it. Otherwise, remove the placeholder.
    return value && value.trim() !== '' ? value : '';
  });

  return result;
}

/**
 * Extract all template variables from a template string
 */
export function extractTemplateVariables(template: string): string[] {
  if (!template) return [];

  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Validate template syntax and check for unknown variables
 */
export function validateTemplateSyntax(template: string, lang: string = 'en'): {
  valid: boolean;
  errors: string[];
  unknownVariables: string[];
} {
  const errors: string[] = [];
  const unknownVariables: string[] = [];

  if (!template) {
    return { valid: true, errors, unknownVariables };
  }

  // Check for unclosed braces
  const openBraces = (template.match(/\{\{/g) || []).length;
  const closeBraces = (template.match(/\}\}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push(getTranslation(lang, 'templateForm.templateSyntaxError'));
  }

  // Extract variables and check if they're known
  const usedVars = extractTemplateVariables(template);
  const knownVars = TEMPLATE_VARIABLES.map(v => v.key);

  usedVars.forEach(varName => {
    if (!knownVars.includes(varName)) {
      unknownVariables.push(varName);
    }
  });

  const valid = errors.length === 0;

  return { valid, errors, unknownVariables };
}

/**
 * Generate a preview of the template with sample data
 */
export function previewTemplate(template: string, lang: string = 'en'): string {
  const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const sampleContext: TemplateContext = {
    sender_name: 'Ali Veli',
    sender_email: 'ali@example.com',
    sender_title: 'Software Developer',
    sender_phone: '+90 555 123 4567',
    sender_company: 'Owlivion',
    sender_website: 'https://owlivion.com',
    recipient_name: 'Jane Doe',
    recipient_email: 'jane@example.com',
    recipient_company: 'ABC Corp',
    date: new Date().toLocaleDateString(dateLocale),
    time: new Date().toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }),
    datetime: new Date().toLocaleString(dateLocale),
  };

  return replaceTemplateVariables(template, sampleContext);
}

/**
 * Get variables by category
 */
export function getVariablesByCategory(
  category: 'sender' | 'recipient' | 'datetime' | 'custom',
  lang: string = 'en'
): TemplateVariable[] {
  return getTemplateVariables(lang).filter(v => v.category === category);
}

/**
 * Insert a variable at cursor position in a text input
 */
export function insertVariableAtCursor(
  currentValue: string,
  cursorPosition: number,
  variableKey: string
): { newValue: string; newCursorPosition: number } {
  const variable = `{{ ${variableKey} }}`;
  const before = currentValue.substring(0, cursorPosition);
  const after = currentValue.substring(cursorPosition);
  const newValue = before + variable + after;
  const newCursorPosition = cursorPosition + variable.length;

  return { newValue, newCursorPosition };
}
