import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/landing/footer';
import { legalDraftPublishEnabled } from '@/lib/legal-publish';
import {
  DRAFT_DELETE_ACCOUNT_ALREADY_SENT,
  DRAFT_DELETE_ACCOUNT_DELETED,
  DRAFT_DELETE_ACCOUNT_EMAIL_AFTER,
  DRAFT_DELETE_ACCOUNT_EMAIL_BEFORE,
  DRAFT_DELETE_ACCOUNT_IN_APP,
  DRAFT_DELETE_ACCOUNT_INTRO,
  DRAFT_DELETE_ACCOUNT_KEPT,
  DRAFT_DELETE_ACCOUNT_MESSAGES,
  DRAFT_DELETE_ACCOUNT_PAYMENTS,
  LEGAL,
} from '@/lib/legal-constants';

export function generateMetadata(): Metadata {
  if (!legalDraftPublishEnabled()) notFound();
  return {
    title: 'Delete your account - Drevvy',
    description: 'How to delete a Drevvy shopper account from the app or by email, and what we delete or keep.',
  };
}

export default function DeleteAccountPage() {
  if (!legalDraftPublishEnabled()) notFound();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Drevvy
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      <article className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Delete your Drevvy account</h1>
          <p className="text-muted-foreground mb-8">{DRAFT_DELETE_ACCOUNT_INTRO}</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">In the app</h2>
              <p className="text-muted-foreground">{DRAFT_DELETE_ACCOUNT_IN_APP}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">By email</h2>
              <p className="text-muted-foreground">
                {DRAFT_DELETE_ACCOUNT_EMAIL_BEFORE}{' '}
                <a href={`mailto:${LEGAL.PRIVACY_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.PRIVACY_EMAIL}
                </a>{' '}
                {DRAFT_DELETE_ACCOUNT_EMAIL_AFTER}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">What we delete</h2>
              <p className="text-muted-foreground">{DRAFT_DELETE_ACCOUNT_DELETED}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">What we keep</h2>
              <p className="text-muted-foreground mb-4">{DRAFT_DELETE_ACCOUNT_KEPT}</p>
              <p className="text-muted-foreground mb-4">{DRAFT_DELETE_ACCOUNT_MESSAGES}</p>
              <p className="text-muted-foreground mb-4">{DRAFT_DELETE_ACCOUNT_ALREADY_SENT}</p>
              <p className="text-muted-foreground">{DRAFT_DELETE_ACCOUNT_PAYMENTS}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Privacy policy</h2>
              <p className="text-muted-foreground mb-4">
                Read the{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{' '}
                for the rest of how Drevvy handles information.
              </p>
              <p className="text-muted-foreground">
                {LEGAL.ENTITY_NAME}
                <br />
                {LEGAL.BUSINESS_ADDRESS}
              </p>
            </section>
          </div>
        </div>
      </article>

      <Footer />
    </main>
  );
}
