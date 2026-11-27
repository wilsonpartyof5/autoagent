import type { Metadata } from 'next';

import { legalDraftPublishEnabled } from '@/lib/legal-publish';

import { PrivacyPageDraft } from './privacy-draft';
import { PrivacyPageLive } from './privacy-live';

export const metadata: Metadata = {
  title: 'Privacy Policy - Drevvy',
  description: 'Privacy Policy for the Drevvy car-buying app. Learn how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  if (legalDraftPublishEnabled()) return <PrivacyPageDraft />;
  return <PrivacyPageLive />;
}
