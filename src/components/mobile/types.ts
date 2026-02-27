import type { EmailAddress } from '../../types';

// Mobile component email type - matches App.tsx's internal Email interface
export interface MobileEmail {
  id: string;
  from: { name: string; email: string };
  to: EmailAddress[];
  subject: string;
  preview: string;
  body: string;
  bodyHtml?: string;
  bodyText?: string;
  date: Date;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  hasImages: boolean;
  accountId?: string;
  attachments?: Array<{
    index: number;
    filename: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
  }>;
  archived?: boolean;
  deleted?: boolean;
  isDraft?: boolean;
}
