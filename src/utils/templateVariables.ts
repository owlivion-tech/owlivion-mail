import type { TemplateVariable, TemplateContext, EmailAddress, Account } from '../types';

/**
 * Available template variables with Turkish labels
 */
export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Sender variables
  {
    key: 'sender_name',
    label: 'Gönderen Adı',
    description: 'E-posta gönderenin tam adı',
    example: 'Ali Veli',
    category: 'sender',
  },
  {
    key: 'sender_email',
    label: 'Gönderen Email',
    description: 'Gönderen email adresi',
    example: 'ali@example.com',
    category: 'sender',
  },
  {
    key: 'sender_title',
    label: 'Gönderen Ünvan',
    description: 'Gönderenin iş ünvanı',
    example: 'Yazılım Geliştirici',
    category: 'sender',
  },
  {
    key: 'sender_phone',
    label: 'Gönderen Telefon',
    description: 'Gönderenin telefon numarası',
    example: '+90 555 123 4567',
    category: 'sender',
  },
  {
    key: 'sender_company',
    label: 'Gönderen Şirket',
    description: 'Gönderenin çalıştığı şirket',
    example: 'Owlivion',
    category: 'sender',
  },
  {
    key: 'sender_website',
    label: 'Gönderen Website',
    description: 'Gönderenin website adresi',
    example: 'https://owlivion.com',
    category: 'sender',
  },

  // Recipient variables
  {
    key: 'recipient_name',
    label: 'Alıcı Adı',
    description: 'E-posta alıcısının adı',
    example: 'Ayşe Yılmaz',
    category: 'recipient',
  },
  {
    key: 'recipient_email',
    label: 'Alıcı Email',
    description: 'Alıcının email adresi',
    example: 'ayse@example.com',
    category: 'recipient',
  },
  {
    key: 'recipient_company',
    label: 'Alıcı Şirket',
    description: 'Alıcının çalıştığı şirket',
    example: 'ABC Corp',
    category: 'recipient',
  },

  // DateTime variables
  {
    key: 'date',
    label: 'Tarih',
    description: 'Bugünün tarihi (GG/AA/YYYY)',
    example: '06/02/2026',
    category: 'datetime',
  },
  {
    key: 'time',
    label: 'Saat',
    description: 'Şu anki saat (SS:DD)',
    example: '14:30',
    category: 'datetime',
  },
  {
    key: 'datetime',
    label: 'Tarih ve Saat',
    description: 'Bugünün tarihi ve saati',
    example: '06/02/2026 14:30',
    category: 'datetime',
  },
];

/**
 * Build template context from account and recipient data
 */
export function buildTemplateContext(
  account?: Account,
  recipient?: EmailAddress,
  customVars?: Record<string, string>
): TemplateContext {
  const now = new Date();

  // Format date and time
  const date = now.toLocaleDateString('tr-TR');
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
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
export function validateTemplateSyntax(template: string): {
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
    errors.push('Şablon sözdizimi hatası: Parantezler dengeli değil');
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
export function previewTemplate(template: string): string {
  const sampleContext: TemplateContext = {
    sender_name: 'Ali Veli',
    sender_email: 'ali@example.com',
    sender_title: 'Yazılım Geliştirici',
    sender_phone: '+90 555 123 4567',
    sender_company: 'Owlivion',
    sender_website: 'https://owlivion.com',
    recipient_name: 'Ayşe Yılmaz',
    recipient_email: 'ayse@example.com',
    recipient_company: 'ABC Corp',
    date: new Date().toLocaleDateString('tr-TR'),
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    datetime: new Date().toLocaleString('tr-TR'),
  };

  return replaceTemplateVariables(template, sampleContext);
}

/**
 * Get variables by category
 */
export function getVariablesByCategory(
  category: 'sender' | 'recipient' | 'datetime' | 'custom'
): TemplateVariable[] {
  return TEMPLATE_VARIABLES.filter(v => v.category === category);
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
