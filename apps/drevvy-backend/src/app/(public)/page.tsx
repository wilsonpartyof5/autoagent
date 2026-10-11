import type { Metadata } from 'next';
import Link from 'next/link';
import { QRCode } from '@/components/landing/qr-code';
import { StoreBadges } from '@/components/landing/store-badges';
import { Footer } from '@/components/landing/footer';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'Drevvy - Get the Real Out-the-Door Price',
  description:
    "Stop guessing what you'll actually pay for a car. Drevvy's AI contacts dealers for you and gets a clear, written out-the-door price. $97/month for up to 10 cars.",
  openGraph: {
    title: 'Drevvy - Get the Real Out-the-Door Price',
    description:
      "Stop guessing what you'll actually pay for a car. Drevvy's AI contacts dealers for you and gets a clear, written out-the-door price.",
    type: 'website',
    url: 'https://www.drevvy.com',
    siteName: 'Drevvy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drevvy - Get the Real Out-the-Door Price',
    description:
      "Stop guessing what you'll actually pay for a car. Drevvy's AI contacts dealers for you.",
  },
  alternates: {
    canonical: 'https://www.drevvy.com',
  },
};

const faqs = [
  {
    question: 'What is an out-the-door price?',
    answer:
      "The out-the-door (OTD) price is the total amount you'll pay to drive the car home, including taxes, registration, documentation fees, and any dealer add-ons. It's the only price that matters when comparing deals.",
  },
  {
    question: 'How does Drevvy get prices from dealers?',
    answer:
      "Our AI contacts dealers through email, text, and phone calls on your behalf. We ask for a clear, itemized out-the-door quote so you know exactly what you're paying for—no surprises at the finance desk.",
  },
  {
    question: 'Why $97 per month?',
    answer:
      "For $97/month, you get Drevvy working on up to 10 vehicles at once. That's complete transparency on every car you're considering. Most shoppers save far more than that by knowing the real price before they walk in.",
  },
  {
    question: "What if I'm not ready to buy?",
    answer:
      "That's fine. Use Drevvy to research and understand real pricing in your market. When you're ready, you'll have actual out-the-door quotes instead of guesses.",
  },
  {
    question: 'Do dealers know who I am?',
    answer:
      "No. We only share your first name and general location (for accurate tax estimates). Dealers never get your phone number, email, or address unless you decide to move forward with a specific vehicle.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Your subscription renews monthly through the App Store or Google Play. Cancel anytime from your phone settings—no calls, no hassle.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Drevvy
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <Link
            href="/get"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Get the app
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Stop guessing.{' '}
              <span className="gradient-showing">Get the real price.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Drevvy contacts dealers for you and gets a clear, written out-the-door price.
              No surprises. No hidden fees. Just transparency.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <StoreBadges />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How Drevvy works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card rounded-xl p-6 card-elevated text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Find a car</h3>
              <p className="text-muted-foreground">
                Browse listings in the app. When you find one you like, tap &quot;Get Best Price.&quot;
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 card-elevated text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">We contact the dealer</h3>
              <p className="text-muted-foreground">
                Our AI reaches out by email, text, and call to request a complete, itemized out-the-door quote.
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 card-elevated text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Get the real price</h3>
              <p className="text-muted-foreground">
                See the full breakdown: taxes, fees, add-ons—everything. No more surprises in the finance office.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-lg mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple pricing</h2>
            <p className="text-muted-foreground mb-8">
              One plan. Complete transparency on every car.
            </p>
            <div className="bg-card rounded-2xl p-8 card-elevated">
              <div className="mb-6">
                <span className="text-5xl font-bold">{LEGAL.SUBSCRIPTION_PRICE}</span>
                <span className="text-muted-foreground">/{LEGAL.SUBSCRIPTION_PERIOD}</span>
              </div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Up to {LEGAL.VEHICLE_LIMIT} vehicles at once</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Full out-the-door price breakdown</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Email, text, and call outreach</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Your info stays private until you decide</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Cancel anytime from your phone</span>
                </li>
              </ul>
              <Link
                href="/get"
                className="block w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-center hover:bg-primary-700 transition-colors"
              >
                Get started
              </Link>
              <p className="text-xs text-muted-foreground mt-4">
                Billed monthly through the App Store or Google Play
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Dealers */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">For dealerships</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Drevvy helps shoppers get clarity—not haggle. When we reach out, we&apos;re asking for
              an itemized quote, not a discount. Buyers who know the price are ready to move.
            </p>
            <Link
              href="/dealers"
              className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
            >
              Learn more about how we work with dealers
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group bg-card rounded-xl card-elevated overflow-hidden"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <h3 className="font-semibold pr-4">{faq.question}</h3>
                  <svg
                    className="w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-muted-foreground">
                  <p>{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready for transparency?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Download Drevvy and find out what you&apos;ll actually pay.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="bg-white p-4 rounded-xl">
                <QRCode size={140} className="text-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm opacity-80 mb-3">Scan to download</p>
                <StoreBadges showWaitlist={false} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
