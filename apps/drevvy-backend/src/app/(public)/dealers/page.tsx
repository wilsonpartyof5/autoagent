import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/landing/footer';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'For Dealerships - Drevvy',
  description: 'Information for dealerships about how Drevvy works, how we contact you, and how to opt out.',
};

export default function DealersPage() {
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

      {/* Hero */}
      <section className="py-12 md:py-16 bg-muted/50">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">For Dealerships</h1>
          <p className="text-lg text-muted-foreground">
            Drevvy helps car shoppers get transparency on out-the-door pricing. Here&apos;s what that means for
            your dealership.
          </p>
        </div>
      </section>

      {/* Content */}
      <article className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Who We Are</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy is a consumer car-buying app that helps shoppers understand what they&apos;ll actually pay
                for a vehicle. Our subscribers use the app to browse inventory, and when they find a car they
                like, they ask us to get the full out-the-door price.
              </p>
              <p className="text-muted-foreground">
                We&apos;re not trying to undercut your pricing or force discounts. We simply ask for an itemized
                breakdown so the shopper knows what to expect. Buyers who understand the price are better
                prepared and more likely to move forward.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">How We Contact You</h2>
              <p className="text-muted-foreground mb-4">
                When a subscriber requests pricing on one of your vehicles, our AI agent reaches out to your
                dealership using the following methods, in order:
              </p>
              <ol className="list-decimal pl-6 text-muted-foreground space-y-3">
                <li>
                  <strong>Email first:</strong> We send an email to your sales or internet department requesting
                  an itemized out-the-door quote for the specific vehicle.
                </li>
                <li>
                  <strong>Phone call:</strong> If we don&apos;t receive a response, we may call your sales line to
                  speak with someone about the inquiry.
                </li>
                <li>
                  <strong>Text message:</strong> We only text after you&apos;ve engaged with us—either by texting
                  our number first, responding to our email or call, or agreeing in conversation to receive
                  texts about this inquiry.
                </li>
              </ol>
              <p className="text-muted-foreground mt-4">
                We open with a short hello: &quot;Hi, this is Drevvy, working for [first name].&quot; We do not lead
                with &quot;I&apos;m an AI.&quot; We share the shopper&apos;s first name and general location for tax
                estimation purposes.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">AI Caller and Call Recording Notice</h2>
              <p className="text-muted-foreground mb-4">
                <strong>Our caller is an AI.</strong> When Drevvy calls your dealership, the call is made by an
                AI-powered voice agent, not a human. The opening is still &quot;Hi, this is Drevvy, working for
                [first name].&quot; If you ask whether you&apos;re speaking with an AI, our agent tells the truth:
                &quot;I&apos;m Drevvy&apos;s AI, working for [first name].&quot; It will not deny being an AI.
              </p>
              <p className="text-muted-foreground mb-4">
                <strong>Calls may be recorded.</strong> For quality assurance, training, dispute resolution, and
                compliance purposes, phone calls from Drevvy may be recorded. By continuing a conversation with
                our agent, you acknowledge this recording.
              </p>
              <p className="text-muted-foreground">
                If you have questions about our AI or recording practices, contact us at{' '}
                <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">What We Ask For</h2>
              <p className="text-muted-foreground mb-4">
                Our request is straightforward: an itemized out-the-door price that includes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Vehicle selling price</li>
                <li>Documentation fee</li>
                <li>Applicable taxes</li>
                <li>Title and registration fees</li>
                <li>Any required or optional add-ons (clearly labeled)</li>
                <li>Total out-the-door price</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We&apos;re not asking for your best price or requesting discounts. We&apos;re asking for
                transparency—the same information a buyer would see on the final paperwork.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">What We Share</h2>
              <p className="text-muted-foreground mb-4">
                When we contact you on behalf of a shopper, we share only:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>The shopper&apos;s first name</li>
                <li>Their state of registration (for accurate tax estimation)</li>
                <li>Their ZIP code (for local fee calculations)</li>
              </ul>
              <p className="text-muted-foreground mt-4 font-medium">
                We do not share the shopper&apos;s phone number, email address, or home address.
              </p>
              <p className="text-muted-foreground mt-4">
                If the shopper decides to move forward with the vehicle, they will contact you directly using
                the information you provide.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Benefits for Your Dealership</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Qualified leads:</strong> Drevvy subscribers have paid for the service. They&apos;re
                  actively shopping and serious about buying.
                </li>
                <li>
                  <strong>No surprises:</strong> Shoppers who know the price upfront are less likely to walk
                  away in the finance office.
                </li>
                <li>
                  <strong>Reduced back-and-forth:</strong> Providing a clear quote means less
                  back-and-forth on price.
                </li>
                <li>
                  <strong>Your pricing:</strong> We share what you tell us. You control the numbers.
                </li>
              </ul>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">How to Opt Out</h2>
              <p className="text-muted-foreground mb-4">
                If you&apos;d prefer not to receive inquiries from Drevvy, you have several options:
              </p>

              <h3 className="text-lg font-medium mt-6 mb-3">Individual Opt-Out</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>
                  <strong>Text STOP:</strong> Reply STOP to any text message from our system
                </li>
                <li>
                  <strong>Tell our agent:</strong> During a call, say you&apos;d like to be removed
                </li>
              </ul>

              <h3 className="text-lg font-medium mt-6 mb-3">Opt Out Your Entire Dealership</h3>
              <p className="text-muted-foreground mb-4">
                To remove your entire dealership from all Drevvy outreach (email, phone, and text), email us at:
              </p>
              <p className="text-muted-foreground mb-4">
                <a href={`mailto:${LEGAL.OPTOUT_EMAIL}`} className="text-primary hover:underline font-medium">
                  {LEGAL.OPTOUT_EMAIL}
                </a>
              </p>
              <p className="text-muted-foreground mb-4">
                Include your dealership name, address, and the phone numbers/email addresses you want removed.
                We will process your request within 48 hours.
              </p>
              <p className="text-muted-foreground">
                Once opted out, your dealership will not receive any future inquiries from Drevvy unless you
                contact us to opt back in.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Questions?</h2>
              <p className="text-muted-foreground mb-4">
                We&apos;re happy to answer any questions about how Drevvy works or how we interact with your
                dealership.
              </p>
              <p className="text-muted-foreground">
                <strong>Email:</strong>{' '}
                <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.SUPPORT_EMAIL}
                </a>
                <br />
                <strong>Website:</strong>{' '}
                <a href={LEGAL.WEBSITE_URL} className="text-primary hover:underline">
                  {LEGAL.WEBSITE_URL}
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">About Drevvy</h2>
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
