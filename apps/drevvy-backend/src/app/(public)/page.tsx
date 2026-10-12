import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { QRCode } from '@/components/landing/qr-code';
import { StoreBadges } from '@/components/landing/store-badges';
import { Footer } from '@/components/landing/footer';
import { IPhoneFrame } from '@/components/landing/iphone-frame';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'Drevvy - Get the Real Out-the-Door Price',
  description:
    "Stop guessing what you'll actually pay for a car. Drevvy gets you a clear, itemized out-the-door price from dealers—every fee visible, nothing hidden. $97/month for up to 10 cars.",
  openGraph: {
    title: 'Drevvy - Get the Real Out-the-Door Price',
    description:
      "Stop guessing what you'll actually pay for a car. Drevvy gets you a clear, itemized out-the-door price from dealers.",
    type: 'website',
    url: 'https://www.drevvy.com',
    siteName: 'Drevvy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drevvy - Get the Real Out-the-Door Price',
    description:
      "Stop guessing what you'll actually pay for a car. Drevvy gets you transparency on every car.",
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
      "Drevvy contacts dealers through email, text, and phone calls on your behalf. We ask for a clear, itemized out-the-door quote so you know exactly what you're paying for—no surprises at the finance desk.",
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

const stats = [
  {
    value: '$3,350+',
    label: 'above advertised price',
    description: 'In an FTC case, buyers paid more than $3,350 above the advertised price in over 92% of deals.',
    source: 'FTC alleged, Oct 2026',
    sourceUrl: 'https://www.ftc.gov/news-events/news/press-releases/2026/10/ftc-secures-settlement-auto-dealership-group-price-transparency-win-consumers',
  },
  {
    value: '67%',
    label: 'dealers won\'t itemize',
    description: 'Only 33 of 100 dealers sent a full out-the-door breakdown when AI agents asked.',
    source: 'CarEdge mystery shop, 2026',
    sourceUrl: 'https://www.dealeraiguy.com/100-ai-agents-mystery-shopped-100-dealers/',
  },
  {
    value: '30%',
    label: 'found hidden fees',
    description: '30% of buyers agreed on a price and then found hidden fees when it was time to sign.',
    source: 'KPA / Harris Poll, 2024',
    sourceUrl: 'https://kpa.io/kpa-car-dealership-trust-survey-while-a-minority-of-americans-experience-deceptive-selling-at-dealerships-most-still-distrust-them/',
  },
  {
    value: '~3 hrs',
    label: 'at the dealership',
    description: 'Buyers spend almost 3 hours at the dealership where they buy.',
    source: 'Cox Automotive, 2025',
    sourceUrl: 'https://www.coxautoinc.com/wp-content/uploads/2026/03/2025-Cox-Automotive-Car-Buyer-Journey-Study-Summary.pdf',
  },
];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Ambient gradient blobs - Drevvy Halo style */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-[hsl(var(--blob-violet))] blur-[100px] opacity-60" />
        <div className="absolute top-[20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-[hsl(var(--blob-blue))] blur-[100px] opacity-50" />
        <div className="absolute bottom-[10%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-[hsl(var(--blob-lilac))] blur-[100px] opacity-40" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(var(--background))]/80 border-b border-[hsl(var(--border))]/50">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
              <SparkleIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[hsl(var(--foreground))]">Drevvy</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="#how-it-works" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              FAQ
            </Link>
          </nav>
          <Link
            href="/get"
            className="px-5 py-2.5 gradient-brand text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))]/25"
          >
            Get the app
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Hero text */}
            <div className="max-w-2xl animate-fade-in-up">
              {/* Gradient orb - matches app design */}
              <div className="w-20 h-20 mb-8 relative">
                <div className="absolute inset-0 rounded-full gradient-brand opacity-80 blur-sm" />
                <div className="relative w-full h-full rounded-full gradient-brand flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30">
                  <SparkleIcon className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-[hsl(var(--foreground))]">
                Stop guessing.{' '}
                <span className="gradient-brand-text">Know the real price.</span>
              </h1>
              <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] mb-8 leading-relaxed">
                Drevvy contacts dealers for you and gets a clear, itemized out-the-door price. 
                Every fee visible. Nothing hidden. Complete transparency.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <StoreBadges />
              </div>
              <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
                Dealers never see your contact info.
              </p>
            </div>

            {/* Hero phone */}
            <div className="relative animate-fade-in delay-200">
              <div className="absolute inset-0 gradient-brand rounded-full blur-[120px] opacity-20" />
              <IPhoneFrame
                src="/screenshots/51-shop-home-personalized.png"
                alt="Drevvy app showing personalized car shopping experience"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Band */}
      <section className="py-16 md:py-20 bg-[hsl(var(--foreground))] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 md:px-6 relative">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-4">
            Why transparency matters
          </h2>
          <p className="text-white/70 text-center mb-12 max-w-2xl mx-auto">
            The numbers show why knowing your out-the-door price before you visit matters.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/15 transition-colors"
              >
                <div className="text-3xl md:text-4xl font-extrabold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-white/90 mb-3">
                  {stat.label}
                </div>
                <p className="text-sm text-white/70 mb-4 leading-relaxed">
                  {stat.description}
                </p>
                <a
                  href={stat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/50 hover:text-white/70 transition-colors underline underline-offset-2"
                >
                  {stat.source}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[hsl(var(--foreground))]">
              How Drevvy works
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-lg max-w-2xl mx-auto">
              Three steps to complete price transparency. You decide, we handle the rest.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12 items-start">
            {/* Step 1 */}
            <div className="text-center">
              <div className="relative mx-auto mb-8 max-w-[240px]">
                <IPhoneFrame
                  src="/screenshots/10-shop-results.png"
                  alt="Drevvy app showing car search results"
                  className="transform scale-90"
                />
              </div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full gradient-brand text-white font-bold text-lg mb-4">
                1
              </div>
              <h3 className="text-xl font-bold mb-3 text-[hsl(var(--foreground))]">Add a car</h3>
              <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                Browse listings in the app. When you find one you like, tap "Add to Agent" and Drevvy takes over.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="relative mx-auto mb-8 max-w-[240px]">
                <IPhoneFrame
                  src="/screenshots/08-shop-ask-answer.png"
                  alt="Drevvy getting the itemized price from a dealer"
                  className="transform scale-90"
                />
              </div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full gradient-brand text-white font-bold text-lg mb-4">
                2
              </div>
              <h3 className="text-xl font-bold mb-3 text-[hsl(var(--foreground))]">Drevvy gets the itemized price</h3>
              <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                We contact the dealer by email, text, and call to request a complete, itemized out-the-door quote.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="relative mx-auto mb-8 max-w-[240px]">
                <IPhoneFrame
                  src="/screenshots/17-shop-results-pro.png"
                  alt="Drevvy showing complete price breakdown"
                  className="transform scale-90"
                />
              </div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full gradient-brand text-white font-bold text-lg mb-4">
                3
              </div>
              <h3 className="text-xl font-bold mb-3 text-[hsl(var(--foreground))]">You decide</h3>
              <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                See every line item: vehicle price, doc fee, taxes, add-ons—everything. Accept, ask for better, or move on.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* See Every Line Item Section */}
      <section className="py-20 md:py-28 bg-[hsl(var(--card))]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full lilac-tint text-sm font-semibold mb-6">
                <SparkleIcon className="w-4 h-4" />
                <span>Complete Transparency</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[hsl(var(--foreground))]">
                See every line item before you visit
              </h2>
              <p className="text-lg text-[hsl(var(--muted-foreground))] mb-8 leading-relaxed">
                No more surprises in the finance office. Drevvy shows you the complete breakdown: 
                vehicle price, documentation fees, title and registration, taxes, and any dealer add-ons.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl mint-highlight flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[hsl(var(--foreground))] mb-1">Vehicle price vs. listed price</div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">See exactly how the offer compares to what was advertised</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl mint-highlight flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[hsl(var(--foreground))] mb-1">Fees and taxes itemized</div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Doc fee, title, registration, and sales tax—nothing hidden</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl mint-highlight flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[hsl(var(--foreground))] mb-1">Add-ons called out</div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Paint protection, nitrogen, VIN etching—see what&apos;s included and what it costs</p>
                  </div>
                </div>
              </div>

              <Link
                href="/get"
                className="inline-flex items-center gap-2 px-6 py-3 gradient-brand text-white rounded-full font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))]/25"
              >
                <SparkleIcon className="w-5 h-5" />
                Get transparency now
              </Link>
            </div>

            <div className="order-1 lg:order-2 relative">
              <div className="absolute inset-0 gradient-brand rounded-full blur-[100px] opacity-15" />
              <IPhoneFrame
                src="/screenshots/07-shop-empty.png"
                alt="Drevvy offer showing itemized price breakdown"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[hsl(var(--foreground))]">
              Simple, transparent pricing
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-lg">
              One plan. Complete transparency on every car.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="glass-card p-8 relative overflow-hidden">
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 gradient-brand rounded-full blur-3xl opacity-20" aria-hidden="true" />
              
              <div className="relative">
                <div className="text-center mb-8">
                  <div className="text-5xl font-extrabold text-[hsl(var(--foreground))] mb-2">
                    {LEGAL.SUBSCRIPTION_PRICE}
                    <span className="text-xl font-normal text-[hsl(var(--muted-foreground))]">/{LEGAL.SUBSCRIPTION_PERIOD}</span>
                  </div>
                  <p className="text-[hsl(var(--muted-foreground))]">Billed monthly through the App Store or Google Play</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {[
                    `Up to ${LEGAL.VEHICLE_LIMIT} vehicles at once`,
                    'Full out-the-door price breakdown',
                    'Email, text, and call outreach',
                    'Your info stays private until you decide',
                    'Cancel anytime from your phone',
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full gradient-brand flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[hsl(var(--foreground))]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/get"
                  className="block w-full py-4 gradient-brand text-white rounded-2xl font-semibold text-center hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))]/25"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Dealers */}
      <section className="py-16 md:py-20 bg-[hsl(var(--card))]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-[hsl(var(--foreground))]">
              For dealerships
            </h2>
            <p className="text-lg text-[hsl(var(--muted-foreground))] mb-6 leading-relaxed">
              Drevvy helps shoppers get clarity—not haggle. When we reach out, we&apos;re asking for
              an itemized quote, not a discount. Buyers who know the price are ready to move.
            </p>
            <Link
              href="/dealers"
              className="inline-flex items-center gap-2 text-[hsl(var(--primary))] font-semibold hover:underline"
            >
              Learn more about how we work with dealers
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[hsl(var(--foreground))]">
              Frequently asked questions
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group glass-card overflow-hidden"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <h3 className="font-semibold pr-4 text-[hsl(var(--foreground))]">{faq.question}</h3>
                  <ChevronIcon className="w-5 h-5 text-[hsl(var(--muted-foreground))] flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-6 text-[hsl(var(--muted-foreground))]">
                  <p className="leading-relaxed">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section className="py-20 md:py-28 gradient-brand relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <SparkleIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Ready for transparency?
            </h2>
            <p className="text-lg text-white/80 mb-10">
              Download Drevvy and find out what you&apos;ll actually pay.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <QRCode size={140} className="text-[hsl(var(--foreground))]" />
              </div>
              <div className="text-left">
                <p className="text-sm text-white/70 mb-3">Scan to download</p>
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
