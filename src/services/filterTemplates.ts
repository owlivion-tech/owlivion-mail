// ============================================================================
// Owlivion Mail - Predefined Filter Templates
// ============================================================================

import type { FilterTemplate } from '../types';

/**
 * Predefined filter templates for common use cases
 */
export const FILTER_TEMPLATES: FilterTemplate[] = [
  // ============================================================================
  // SPAM & SECURITY
  // ============================================================================
  {
    id: 'spam-keywords',
    name: 'Spam Anahtar Kelimeler',
    description: 'Yaygın spam kelimelerini içeren emailleri otomatik spam klasörüne taşır',
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
    name: 'Şüpheli Linkler',
    description: 'Phishing denemesi olabilecek şüpheli linkleri içeren emailleri spam klasörüne taşır',
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
    name: 'Promosyonlar',
    description: 'İndirim, kampanya ve promosyon emaillerini etiketler',
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
    name: 'Abonelik İptali Var',
    description: 'Unsubscribe linki içeren marketing emaillerini etiketler',
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
    name: 'Sosyal Medya Bildirimleri',
    description: 'Facebook, Twitter, Instagram, LinkedIn bildirimlerini etiketler',
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
    name: 'Haber Bültenleri',
    description: 'Newsletter ve blog güncellemelerini etiketler ve okundu işaretler',
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
    name: 'Önemli İş Emailleri',
    description: 'Acil, önemli veya ASAP kelimelerini içeren iş emaillerini yıldızlar',
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
    name: 'Toplantı Davetleri',
    description: 'Toplantı ve etkinlik davetlerini etiketler',
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
    name: 'Ekli Dosyalar',
    description: 'Ek içeren tüm emailleri etiketler',
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
    name: 'Faturalar ve Makbuzlar',
    description: 'Fatura, makbuz ve sipariş onaylarını etiketler',
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
    name: 'Okunmuşları Arşivle',
    description: '7 günden eski okunmuş emailleri otomatik arşivler (manuel uygulama gerektirir)',
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

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: FilterTemplate['category']): FilterTemplate[] {
  return FILTER_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): FilterTemplate | undefined {
  return FILTER_TEMPLATES.find(t => t.id === id);
}

/**
 * Get all template categories
 */
export const TEMPLATE_CATEGORIES = [
  { id: 'spam', name: 'Spam & Güvenlik', icon: '🚫' },
  { id: 'promotions', name: 'Promosyonlar', icon: '🏷️' },
  { id: 'social', name: 'Sosyal Medya', icon: '👥' },
  { id: 'newsletters', name: 'Haber Bültenleri', icon: '📰' },
  { id: 'work', name: 'İş & Önemli', icon: '⭐' },
  { id: 'organization', name: 'Organizasyon', icon: '📁' },
] as const;
