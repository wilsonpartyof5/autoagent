import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/landing/footer';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'Terms of Service - Drevvy',
  description: 'Terms of Service for the Drevvy car-buying app.',
};

export default function TermsPage() {
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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            Effective Date: {LEGAL.EFFECTIVE_DATE}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Agreement to Terms</h2>
              <p className="text-muted-foreground mb-4">
                These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you and{' '}
                {LEGAL.ENTITY_NAME} (&quot;Drevvy,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your use of the{' '}
                {LEGAL.APP_NAME} mobile application (the &quot;App&quot;) and related services.
              </p>
              <p className="text-muted-foreground">
                By downloading, installing, or using the App, you agree to be bound by these Terms. If you do
                not agree to these Terms, do not use the App.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Description of Service</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy is a car-buying assistance service that helps you obtain out-the-door pricing information
                from vehicle dealerships. Our service includes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Browsing vehicle inventory listings</li>
                <li>Requesting pricing information on vehicles you select</li>
                <li>Our AI agent contacting dealerships on your behalf via email, phone, and text message</li>
                <li>Receiving compiled pricing information and fee breakdowns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Agent Authorization</h2>
              <p className="text-muted-foreground mb-4">
                When you request pricing on a vehicle, you authorize Drevvy&apos;s AI agent to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Contact dealerships via email, telephone, and text message</li>
                <li>Identify as acting on your behalf using your first name</li>
                <li>Request itemized out-the-door pricing, including all taxes, fees, and add-ons</li>
                <li>Receive and compile responses for your review</li>
                <li>Record phone calls for quality assurance, training, and compliance purposes</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                You understand that our agent communicates with dealerships as your representative and that
                dealerships may respond with pricing information based on this representation.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">AI and Call Recording Disclosure</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy uses artificial intelligence, including services provided by OpenAI, to power our agent&apos;s
                communications with dealerships. When our AI agent makes phone calls on your behalf:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>The caller is an AI system, not a human</li>
                <li>If asked, the AI will identify itself as an AI</li>
                <li>Calls may be recorded for quality assurance, training, dispute resolution, and compliance</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                By using our service, you acknowledge and consent to this AI-powered outreach on your behalf.
                For more information about how we use AI, see our{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Key Packs and Billing</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">One-time key packs</h3>
              <p className="text-muted-foreground mb-4">
                Asking and shopping are free. Keys come from a pack you buy. Market intelligence and
                save use one key. Opening a dealer conversation uses a second key from the same
                balance. If a dealer does not reply within 7 days, the conversation key is returned.
                Packs are one-time purchases and never expire:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                {LEGAL.KEY_PACKS.map((pack) => (
                  <li key={pack.keys}>
                    {pack.keys === 1 ? '1 key' : `${pack.keys} keys`} for {pack.price} ({pack.perKey} per key)
                    {pack.name === 'Recommended' ? ' — Recommended' : ''}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mb-4">
                There is no subscription and no automatic renewal. Keys you buy stay on your account until
                you use them. The market + save key is not returned for silence; only the dealer-conversation
                key is returned after 7 days with no reply.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Payment Processing</h3>
              <p className="text-muted-foreground mb-4">
                All payments are processed through Apple App Store or Google Play Store. Drevvy does not
                directly handle your payment information. Payment terms, including refunds and disputes, are
                governed by the applicable app store&apos;s policies. You can restore a previous purchase
                from the App.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">No Guarantee of Price</h2>
              <p className="text-muted-foreground mb-4 font-medium">
                Drevvy provides pricing information for informational purposes only. We do not guarantee:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>The accuracy of pricing information provided by dealerships</li>
                <li>That a dealership will honor any quoted price</li>
                <li>Vehicle availability at the time of your inquiry or purchase</li>
                <li>That final purchase terms will match preliminary quotes</li>
                <li>Any specific savings or discount amount</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Prices may change, vehicles may be sold, and final terms are subject to negotiation and
                dealership policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Dealer as Seller</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy is not a party to any vehicle purchase transaction. The dealership is the seller and is
                solely responsible for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Vehicle condition, title, and history</li>
                <li>All warranties and guarantees</li>
                <li>Compliance with sales, consumer protection, and vehicle laws</li>
                <li>Financing terms and credit decisions</li>
                <li>Delivery and registration</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Any disputes related to a vehicle purchase must be resolved directly with the dealership.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">SMS Terms</h2>
              <p className="text-muted-foreground mb-4">
                As part of our service, Drevvy&apos;s agent sends text messages to dealership personnel to request
                pricing information. The following terms apply to our SMS program:
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Program Description</h3>
              <p className="text-muted-foreground mb-4">
                <strong>Program Name:</strong> {LEGAL.SMS_PROGRAM_NAME}
              </p>
              <p className="text-muted-foreground mb-4">
                Our AI agent texts dealership sales staff to request itemized out-the-door pricing on specific
                vehicles a shopper selects.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Message Frequency</h3>
              <p className="text-muted-foreground mb-4">
                Message frequency varies based on the number of pricing requests and dealer response patterns.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Rates and Fees</h3>
              <p className="text-muted-foreground mb-4">
                Message and data rates may apply. Check with your wireless carrier for details about your
                messaging plan.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Opt-Out</h3>
              <p className="text-muted-foreground mb-4">
                Dealership personnel who receive texts from our system may reply STOP at any time to opt out of
                receiving further messages.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Help</h3>
              <p className="text-muted-foreground mb-4">
                For help, reply HELP to any message or contact us at{' '}
                <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.SUPPORT_EMAIL}
                </a>
                .
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Carrier Disclaimer</h3>
              <p className="text-muted-foreground mb-4">
                Carriers are not liable for delayed or undelivered messages.
              </p>

              <p className="text-muted-foreground">
                For more information, see our{' '}
                <Link href="/sms" className="text-primary hover:underline">
                  SMS Program Information
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">User Conduct</h2>
              <p className="text-muted-foreground mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Use the App for any unlawful purpose</li>
                <li>Provide false or misleading information</li>
                <li>Interfere with or disrupt the App or its servers</li>
                <li>Attempt to gain unauthorized access to any part of the App</li>
                <li>Use the App to harass dealerships or their employees</li>
                <li>Resell, redistribute, or commercially exploit the service without authorization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Aggregated Market Insights</h2>
              <p className="text-muted-foreground">
                Drevvy may create and share de-identified, aggregated market insights from App activity with
                dealerships and partners. These insights never identify individual shoppers. For details, see
                our{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Intellectual Property</h2>
              <p className="text-muted-foreground">
                The App, including its design, features, content, and code, is owned by {LEGAL.ENTITY_NAME} and
                protected by intellectual property laws. You may not copy, modify, distribute, or create
                derivative works based on our intellectual property without written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Disclaimer of Warranties</h2>
              <p className="text-muted-foreground mb-4">
                THE APP AND SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className="text-muted-foreground">
                WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY
                INFORMATION PROVIDED THROUGH THE APP IS ACCURATE OR COMPLETE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL.ENTITY_NAME.toUpperCase()} SHALL NOT BE LIABLE
                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATED TO YOUR USE OF THE APP,
                EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p className="text-muted-foreground">
                OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM YOUR USE OF THE APP SHALL NOT EXCEED THE AMOUNT
                YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold harmless {LEGAL.ENTITY_NAME}, its officers, directors,
                employees, and agents from any claims, damages, losses, or expenses (including reasonable
                attorneys&apos; fees) arising from your use of the App, your violation of these Terms, or your
                violation of any rights of another party.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the State of South
                Carolina, without regard to its conflict of law principles. Any disputes arising under these
                Terms shall be resolved in the state or federal courts located in South Carolina.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may modify these Terms at any time. We will notify you of material changes by posting an
                update in the App or by other reasonable means. Your continued use of the App after such changes
                constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Termination</h2>
              <p className="text-muted-foreground">
                We may terminate or suspend your access to the App at any time, with or without cause, and with
                or without notice. Upon termination, your right to use the App will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Severability</h2>
              <p className="text-muted-foreground">
                If any provision of these Terms is found to be invalid or unenforceable, the remaining
                provisions will continue in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <p className="text-muted-foreground mb-4">
                {LEGAL.ENTITY_NAME}
                <br />
                {LEGAL.BUSINESS_ADDRESS}
              </p>
              <ul className="list-none text-muted-foreground space-y-2">
                <li>
                  <strong>General support:</strong>{' '}
                  <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.SUPPORT_EMAIL}
                  </a>
                </li>
                <li>
                  <strong>Privacy inquiries:</strong>{' '}
                  <a href={`mailto:${LEGAL.PRIVACY_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.PRIVACY_EMAIL}
                  </a>
                </li>
                <li>
                  <strong>Opt-out requests:</strong>{' '}
                  <a href={`mailto:${LEGAL.OPTOUT_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.OPTOUT_EMAIL}
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </article>

      <Footer />
    </main>
  );
}
