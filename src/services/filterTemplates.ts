// ============================================================================
// Owlivion Mail - Predefined Filter Templates
// ============================================================================

import type { FilterTemplate } from '../types';
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
 * Predefined filter templates for common use cases
 */
function createFilterTemplates(lang: string): FilterTemplate[] {
  const t = (key: string) => getTranslation(lang, key);

  return [
  // ============================================================================
  // SPAM & SECURITY
  // ============================================================================
  {
    id: 'spam-keywords',
    name: t('filterTemplates.spamKeywords'),
    description: t('filterTemplates.spamKeywordsDesc'),
    category: 'spam',
    icon: '🚫',
    priority: 100,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'kazandınız' },
      { field: 'subject', operator: 'contains', value: 'tıklayın' },
      { field: 'subject', operator: 'contains', value: 'ücretsiz' },
      { field: 'body', operator: 'contains', value: 'viagra' },
      { field: 'body', operator: 'contains', value: 'lottery' },
    ],
    actions: [
      { action: 'mark_as_spam' },
      { action: 'mark_as_read' },
    ],
  },
  {
    id: 'suspicious-links',
    name: t('filterTemplates.suspiciousLinks'),
    description: t('filterTemplates.suspiciousLinksDesc'),
    category: 'spam',
    icon: '⚠️',
    priority: 95,
    conditions: [
      { field: 'body', operator: 'contains', value: 'verify your account' },
      { field: 'body', operator: 'contains', value: 'update payment' },
      { field: 'body', operator: 'contains', value: 'suspended account' },
      { field: 'body', operator: 'contains', value: 'hesabınızı doğrulayın' },
    ],
    actions: [
      { action: 'mark_as_spam' },
    ],
  },

  // ============================================================================
  // PROMOTIONS & MARKETING
  // ============================================================================
  {
    id: 'promotions',
    name: t('filterTemplates.promotions'),
    description: t('filterTemplates.promotionsDesc'),
    category: 'promotions',
    icon: '🏷️',
    priority: 50,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'promosyon' },
      { field: 'subject', operator: 'contains', value: 'indirim' },
      { field: 'subject', operator: 'contains', value: 'kampanya' },
      { field: 'subject', operator: 'contains', value: 'fırsat' },
      { field: 'subject', operator: 'contains', value: 'sale' },
      { field: 'subject', operator: 'contains', value: 'discount' },
      { field: 'subject', operator: 'contains', value: '%' },
    ],
    actions: [
      { action: 'add_label', label: 'Promosyonlar' },
    ],
  },
  {
    id: 'unsubscribe',
    name: t('filterTemplates.unsubscribe'),
    description: t('filterTemplates.unsubscribeDesc'),
    category: 'promotions',
    icon: '📧',
    priority: 45,
    conditions: [
      { field: 'body', operator: 'contains', value: 'unsubscribe' },
      { field: 'body', operator: 'contains', value: 'abonelikten çık' },
    ],
    actions: [
      { action: 'add_label', label: 'Newsletter' },
      { action: 'mark_as_read' },
    ],
  },

  // ============================================================================
  // SOCIAL MEDIA
  // ============================================================================
  {
    id: 'social-notifications',
    name: t('filterTemplates.socialNotifications'),
    description: t('filterTemplates.socialNotificationsDesc'),
    category: 'social',
    icon: '👥',
    priority: 40,
    conditions: [
      { field: 'from', operator: 'contains', value: 'facebook.com' },
      { field: 'from', operator: 'contains', value: 'twitter.com' },
      { field: 'from', operator: 'contains', value: 'instagram.com' },
      { field: 'from', operator: 'contains', value: 'linkedin.com' },
      { field: 'from', operator: 'contains', value: 'facebookmail.com' },
      { field: 'from', operator: 'contains', value: 'x.com' },
    ],
    actions: [
      { action: 'add_label', label: 'Sosyal Medya' },
    ],
  },

  // ============================================================================
  // NEWSLETTERS
  // ============================================================================
  {
    id: 'newsletters',
    name: t('filterTemplates.newsletters'),
    description: t('filterTemplates.newslettersDesc'),
    category: 'newsletters',
    icon: '📰',
    priority: 30,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'newsletter' },
      { field: 'subject', operator: 'contains', value: 'haftalık özet' },
      { field: 'subject', operator: 'contains', value: 'digest' },
      { field: 'subject', operator: 'contains', value: 'bülten' },
    ],
    actions: [
      { action: 'add_label', label: 'Newsletter' },
    ],
  },

  // ============================================================================
  // WORK & IMPORTANT
  // ============================================================================
  {
    id: 'important-work',
    name: t('filterTemplates.importantWork'),
    description: t('filterTemplates.importantWorkDesc'),
    category: 'work',
    icon: '⭐',
    priority: 90,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'urgent' },
      { field: 'subject', operator: 'contains', value: 'acil' },
      { field: 'subject', operator: 'contains', value: 'asap' },
      { field: 'subject', operator: 'contains', value: 'important' },
      { field: 'subject', operator: 'contains', value: 'önemli' },
    ],
    actions: [
      { action: 'mark_as_starred' },
      { action: 'add_label', label: 'Önemli' },
    ],
  },
  {
    id: 'meeting-invites',
    name: t('filterTemplates.meetingInvites'),
    description: t('filterTemplates.meetingInvitesDesc'),
    category: 'work',
    icon: '📅',
    priority: 60,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'meeting' },
      { field: 'subject', operator: 'contains', value: 'toplantı' },
      { field: 'subject', operator: 'contains', value: 'invite' },
      { field: 'subject', operator: 'contains', value: 'davet' },
      { field: 'body', operator: 'contains', value: 'calendar event' },
    ],
    actions: [
      { action: 'add_label', label: 'Toplantılar' },
    ],
  },

  // ============================================================================
  // ORGANIZATION
  // ============================================================================
  {
    id: 'with-attachments',
    name: t('filterTemplates.withAttachments'),
    description: t('filterTemplates.withAttachmentsDesc'),
    category: 'organization',
    icon: '📎',
    priority: 20,
    conditions: [
      { field: 'has_attachment', operator: 'equals', value: 'true' },
    ],
    actions: [
      { action: 'add_label', label: 'Ekler' },
    ],
  },
  {
    id: 'receipts',
    name: t('filterTemplates.receipts'),
    description: t('filterTemplates.receiptsDesc'),
    category: 'organization',
    icon: '🧾',
    priority: 55,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'fatura' },
      { field: 'subject', operator: 'contains', value: 'makbuz' },
      { field: 'subject', operator: 'contains', value: 'receipt' },
      { field: 'subject', operator: 'contains', value: 'invoice' },
      { field: 'subject', operator: 'contains', value: 'sipariş' },
      { field: 'subject', operator: 'contains', value: 'order confirmation' },
    ],
    actions: [
      { action: 'add_label', label: 'Faturalar' },
      { action: 'mark_as_starred' },
    ],
  },
  {
    id: 'auto-archive-read',
    name: t('filterTemplates.autoArchiveRead'),
    description: t('filterTemplates.autoArchiveReadDesc'),
    category: 'organization',
    icon: '📦',
    priority: 10,
    conditions: [
      { field: 'subject', operator: 'not_contains', value: '' }, // Dummy condition - will match all
    ],
    actions: [
      { action: 'archive' },
    ],
  },
  ];
}

/** Default (backward compat) - uses 'en' */
export const FILTER_TEMPLATES: FilterTemplate[] = createFilterTemplates('en');

/**
 * Get localized filter templates
 */
export function getFilterTemplates(lang: string = 'en'): FilterTemplate[] {
  return createFilterTemplates(lang);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: FilterTemplate['category'], lang: string = 'en'): FilterTemplate[] {
  return getFilterTemplates(lang).filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string, lang: string = 'en'): FilterTemplate | undefined {
  return getFilterTemplates(lang).find(t => t.id === id);
}

/**
 * Get all template categories (localized)
 */
export function getTemplateCategories(lang: string = 'en') {
  const t = (key: string) => getTranslation(lang, key);
  return [
    { id: 'spam', name: t('filterTemplates.catSpamSecurity'), icon: '🚫' },
    { id: 'promotions', name: t('filterTemplates.catPromotions'), icon: '🏷️' },
    { id: 'social', name: t('filterTemplates.catSocial'), icon: '👥' },
    { id: 'newsletters', name: t('filterTemplates.catNewsletters'), icon: '📰' },
    { id: 'work', name: t('filterTemplates.catWork'), icon: '⭐' },
    { id: 'organization', name: t('filterTemplates.catOrganization'), icon: '📁' },
  ] as const;
}

/** @deprecated Use getTemplateCategories(lang) instead */
export const TEMPLATE_CATEGORIES = getTemplateCategories('en');
