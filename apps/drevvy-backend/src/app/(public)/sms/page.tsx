import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/landing/footer';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'SMS Program Information - Drevvy',
  description: 'SMS program information for Drevvy Vehicle Inquiry Alerts. Details for carriers and reviewers.',
};

export default function SMSPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Content */}
      <article className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">SMS Program Information</h1>
          <p className="text-muted-foreground mb-8">
            {LEGAL.SMS_PROGRAM_NAME}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Program Overview</h2>
              <p className="text-muted-foreground mb-4">
                <strong>Brand/Service Name:</strong> {LEGAL.APP_NAME}
              </p>
              <p className="text-muted-foreground mb-4">
                <strong>Program Name:</strong> {LEGAL.SMS_PROGRAM_NAME}
              </p>
              <p className="text-muted-foreground mb-4">
                <strong>Organization:</strong> {LEGAL.ENTITY_NAME}
              </p>
              <p className="text-muted-foreground">
                Drevvy is a consumer car-buying application. Our AI agent contacts vehicle dealerships on behalf
                of our subscribers to request clear, itemized out-the-door pricing information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">How This SMS Program Works</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy does not send a cold text. A text goes to a dealership salesperson only after that
                person texts our number first.
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>They text first:</strong> A dealership salesperson texts our number about a vehicle
                  inquiry. Later texts stay on that thread.
                </li>
                <li>
                  <strong>No cold texts:</strong> A phone call, an email reply, or a verbal yes is not enough
                  to start a text. We wait until that salesperson texts us.
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Important:</strong> Drevvy only texts dealership business lines—never consumer mobile
                phones. We text dealerships, not shoppers. Shoppers receive information through our mobile app,
                not via SMS.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">Consent Collection</h2>
              <p className="text-muted-foreground mb-4">
                A dealership salesperson is added to this SMS program only when they text our number first.
              </p>
              <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>They text us:</strong> A salesperson sends the first text about a vehicle inquiry.
                </li>
                <li>
                  <strong>We reply on that thread:</strong> Later messages stay with the person who texted,
                  about that same inquiry.
                </li>
              </ol>
              <p className="text-muted-foreground mt-4">
                We do not send a cold text to a dealership&apos;s main line, and we do not start a text because
                someone agreed on a call or answered an email.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Sample Messages</h2>
              <p className="text-muted-foreground mb-4">
                Below are examples of text messages sent through our program:
              </p>

              <div className="space-y-4">
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">After a salesperson texts us:</p>
                  <p className="font-mono text-sm">
                    Hi, is stock #12345 still available? Reply STOP to opt out.
                  </p>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Pricing request:</p>
                  <p className="font-mono text-sm">
                    Hi, this is Drevvy, working for [First Name]. Thanks for your call. Could you text the
                    full out-the-door breakdown when ready? Msg&amp;data rates apply. STOP to opt out.
                  </p>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Follow-up:</p>
                  <p className="font-mono text-sm">
                    Hi, this is Drevvy, working for [First Name]. Just checking on the out-the-door quote for
                    the 2023 Accord. Reply STOP to opt out.
                  </p>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Thank you/confirmation:</p>
                  <p className="font-mono text-sm">
                    Hi, this is Drevvy, working for [First Name]. Got it, thanks. We&apos;ll share this with
                    them. HELP for help, STOP to stop.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Message Frequency</h2>
              <p className="text-muted-foreground">
                Message frequency varies based on the vehicle inquiry. A typical inquiry involves 2–5 messages
                over 3–7 days. We do not send marketing or promotional messages—only messages directly related
                to active vehicle pricing requests.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Opt-Out Instructions</h2>
              <p className="text-muted-foreground mb-4">
                Reply <strong>STOP</strong> to any message to immediately opt out and stop receiving messages.
                You will receive a confirmation message and no further messages will be sent.
              </p>
              <p className="text-muted-foreground">
                You may also opt out by emailing{' '}
                <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.SUPPORT_EMAIL}
                </a>{' '}
                with the phone number you wish to remove.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Help</h2>
              <p className="text-muted-foreground mb-4">
                Reply <strong>HELP</strong> to any message for assistance. You will receive a reply with support
                contact information.
              </p>
              <p className="text-muted-foreground">
                For additional help, contact us at{' '}
                <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Rates and Fees</h2>
              <p className="text-muted-foreground">
                Message and data rates may apply depending on your wireless carrier and plan. Please contact
                your carrier for details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Carrier Liability</h2>
              <p className="text-muted-foreground">
                Wireless carriers are not liable for delayed or undelivered messages.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Privacy</h2>
              <p className="text-muted-foreground mb-4">
                We respect your privacy. No mobile information will be shared with third parties/affiliates for
                marketing/promotional purposes. All other categories exclude text messaging originator opt-in
                data and consent; this information will not be shared with any third parties.
              </p>
              <p className="text-muted-foreground">
                For full details, see our{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Terms of Service</h2>
              <p className="text-muted-foreground">
                By participating in this SMS program, you agree to our{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
              <p className="text-muted-foreground">
                {LEGAL.ENTITY_NAME}
                <br />
                {LEGAL.BUSINESS_ADDRESS}
                <br />
                Email:{' '}
                <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.SUPPORT_EMAIL}
                </a>
                <br />
                Website:{' '}
                <a href={LEGAL.WEBSITE_URL} className="text-primary hover:underline">
                  {LEGAL.WEBSITE_URL}
                </a>
              </p>
            </section>
          </div>
        </div>
      </article>

      <Footer />
    </main>
  );
}
