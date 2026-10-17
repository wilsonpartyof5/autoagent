import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/landing/footer';
import { Logo } from '@/components/landing/logo';
import { PhoneFrame } from '@/components/landing/iphone-frame';
import { StoreCta } from '@/components/landing/store-cta';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: {
    absolute: 'Drevvy — Know the real price before you go',
  },
  description:
    'Drevvy asks the dealer for an itemized out-the-door price in writing, so every fee and add-on is on the table. You get transparency, and you stay anonymous until you accept.',
  openGraph: {
    title: 'Drevvy — Know the real price before you go',
    description:
      'Drevvy asks the dealer for an itemized out-the-door price in writing. You get transparency, and you stay anonymous until you accept.',
    type: 'website',
    url: 'https://www.drevvy.com',
    siteName: 'Drevvy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drevvy — Know the real price before you go',
    description:
      'Itemized out-the-door prices in writing. Transparency before you go, and you stay anonymous until you accept.',
  },
  alternates: {
    canonical: 'https://www.drevvy.com',
  },
};

const steps = [
  {
    title: 'Shop',
    body: 'Ask Drevvy or browse real listings near you. Asking and shopping are free.',
  },
  {
    title: 'Unlock my price',
    body: 'Found the one? Tap Unlock my price. Drevvy reaches out to the dealer for you.',
  },
  {
    title: 'Get an itemized out-the-door price',
    body: 'Every line in writing: vehicle, doc fee, tax, title, and any add-ons called out.',
  },
  {
    title: 'Stay anonymous until you accept',
    body: 'Dealers see “Dealer A”, not you. Your name goes over only when you accept an offer.',
  },
];

const STARTING_OTD = 37541;
const BAR_FLOOR = 34000;

const rounds = [
  {
    label: 'Starting OTD',
    price: 37541,
    title: 'Out the door',
    detail: 'Before Drevvy asked',
    featured: false,
  },
  {
    label: 'Round 1',
    price: 36632,
    title: 'Paint protection removed',
    detail: '−$909',
    featured: false,
  },
  {
    label: 'Round 2',
    price: 36179,
    title: 'VIN etching removed',
    detail: '−$453',
    featured: false,
  },
  {
    label: 'Final',
    price: 35980,
    title: 'Nitrogen removed',
    detail: '−$199',
    featured: true,
  },
];

function barPercent(price: number) {
  return ((price - BAR_FLOOR) / (STARTING_OTD - BAR_FLOOR)) * 100;
}

function formatDollars(amount: number) {
  return `$${amount.toLocaleString('en-US')}`;
}

const packSavings: Record<number, string> = {
  3: ' · save 42.0%',
  5: ' · save 50.4%',
  10: ' · save 64.1%',
};

const packs = LEGAL.CAR_PACKS.map((pack) => ({
  name: pack.name,
  price: pack.price,
  cars: pack.cars === 1 ? '1 car' : `${pack.cars} cars`,
  detail: `${pack.perCar} per car${packSavings[pack.cars] ?? ''}`,
  best: pack.cars === 10,
}));

const faqs = [
  {
    question: 'What is an out-the-door price?',
    answer:
      'The total you would pay to drive the car home: vehicle price, dealer fees, taxes, title and registration, and any add-ons.',
    open: true,
  },
  {
    question: 'How does Drevvy get prices?',
    answer:
      'Drevvy contacts the listing dealer by email or text during business hours and asks for an itemized out-the-door quote in writing.',
    open: true,
  },
  {
    question: 'Do dealers know who I am?',
    answer:
      'No. Dealers see an anonymous shopper (“Dealer A” on your side). Your name is shared only when you accept an offer.',
    open: false,
  },
  {
    question: 'How do car packs work?',
    answer: `Each car you unlock uses one. Packs are one-time purchases (${LEGAL.CAR_PACKS.map((pack) => `${pack.cars} for ${pack.price}`).join(', ')}) and never expire. If a dealer never replies, you get the car back.`,
    open: false,
  },
  {
    question: 'Is Drevvy guaranteed to save me money?',
    answer:
      'No. Drevvy gets you a clear, written number. Dealer response and savings aren’t guaranteed, and you decide on every offer.',
    open: false,
  },
];

const navLinkClass = 'text-[15px] font-bold text-[#4E5568] transition-colors hover:text-[#171A2C]';

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-base font-extrabold uppercase tracking-[0.1em] text-[#4B3FD9] lg:text-[13px]">{children}</p>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(900px_600px_at_50%_-10%,#DCD8FF,transparent_70%),#EEF1F7] text-[#171A2C]">
      <header className="sticky top-0 z-40 bg-[#EEF1F7]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-10 lg:px-20 lg:py-6">
          <Logo gradientId="logo-nav" />
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            <a href="#how-it-works" className={navLinkClass}>
              How it works
            </a>
            <a href="#pricing" className={navLinkClass}>
              Pricing
            </a>
            <a href="#faq" className={navLinkClass}>
              FAQ
            </a>
            <Link href="/dealers" className={navLinkClass}>
              For dealers
            </Link>
          </nav>
          <a
            href="#get-the-app"
            className="inline-flex min-h-11 shrink-0 items-center rounded-[22px] bg-gradient-to-br from-[#5B4FE9] to-[#3A6FF0] px-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(70,80,220,0.28)] transition-opacity hover:opacity-90 sm:px-5 lg:text-sm"
          >
            Get the app
          </a>
        </div>
      </header>

      <section className="px-5 pb-12 pt-8 text-center md:px-10 md:pt-14 lg:px-20 lg:pb-16 lg:pt-16">
        <div className="mx-auto max-w-[1000px]">
          <p className="inline-block rounded-full border border-white bg-white/75 px-3.5 py-2 text-base font-extrabold text-[#4B3FD9] lg:text-[13px]">
            Asking and shopping are free
          </p>
          <h1 className="mx-auto mt-5 max-w-[1000px] text-balance text-[clamp(2.15rem,10.2vw,2.875rem)] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl xl:text-[88px]">
            Know the <em className="gradient-brand-text not-italic">real price</em>
            <br />
            before you go.
          </h1>
          <p className="mx-auto mt-5 max-w-[640px] text-[17px] font-medium leading-relaxed text-[#4E5568] lg:text-[21px]">
            Drevvy asks the dealer for an itemized out-the-door price in writing, so every fee and add-on is on the
            table. You stay anonymous until you accept.
          </p>
          <StoreCta id="get-the-app" />
        </div>

        <div className="relative -mx-5 mt-10 overflow-x-clip px-1 pb-6 sm:mx-0 sm:px-0 md:mx-auto md:mt-14 md:max-w-[1100px] md:pb-12">
          <div className="flex items-end justify-center md:gap-5 lg:gap-8">
            <PhoneFrame
              src="/screenshots/10-shop-results.png"
              alt="Drevvy shop results for hybrid SUVs near you"
              className="-mr-9 w-[108px] -translate-y-2 rounded-[28px] p-1.5 opacity-90 sm:w-[128px] md:mr-0 md:w-[168px] md:translate-y-6 md:rounded-[40px] md:p-2 md:opacity-95 lg:w-[210px] lg:translate-y-10 lg:rounded-[48px] lg:p-2.5 xl:w-[250px] xl:translate-y-14"
            />
            <PhoneFrame
              src="/screenshots/51-shop-home-personalized.png"
              alt="Drevvy home screen welcoming Dana back"
              priority
              className="relative z-10 w-[180px] rounded-[28px] p-1.5 sm:w-[200px] md:w-[240px] md:rounded-[40px] md:p-2 lg:w-[300px] lg:rounded-[48px] lg:p-2.5 xl:w-[330px]"
            />
            <PhoneFrame
              src="/screenshots/08-shop-ask-answer.png"
              alt="Drevvy answer comparing typical out-the-door prices"
              className="-ml-9 w-[108px] -translate-y-2 rounded-[28px] p-1.5 opacity-90 sm:w-[128px] md:ml-0 md:w-[168px] md:translate-y-6 md:rounded-[40px] md:p-2 md:opacity-95 lg:w-[210px] lg:translate-y-10 lg:rounded-[48px] lg:p-2.5 xl:w-[250px] xl:translate-y-14"
            />
          </div>

          <div className="pointer-events-none absolute left-[2%] top-[14%] hidden max-w-[210px] rounded-3xl border border-white bg-white/80 px-4 py-3.5 text-left shadow-[0_16px_40px_rgba(40,50,110,0.14)] backdrop-blur-md xl:block">
            <p className="text-[15px] font-extrabold leading-tight">Itemized in writing</p>
            <p className="mt-1 text-[12.5px] font-semibold text-[#6A7086]">Doc fee, tax, title, add-ons</p>
          </div>
          <div className="pointer-events-none absolute right-[2%] top-[30%] hidden max-w-[210px] rounded-3xl border border-white bg-white/80 px-4 py-3.5 text-left shadow-[0_16px_40px_rgba(40,50,110,0.14)] backdrop-blur-md xl:block">
            <p className="text-[15px] font-extrabold leading-tight">Dealer A</p>
            <p className="mt-1 text-[12.5px] font-semibold text-[#6A7086]">Your name stays private</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 px-5 py-16 text-center md:px-10 md:py-20 lg:px-20 lg:py-24">
        <div className="mx-auto max-w-[1440px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mx-auto mt-2.5 max-w-[16ch] text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:max-w-none sm:text-5xl lg:text-[54px]">
            Four steps to a clear number.
          </h2>
          <ol className="mt-10 grid list-none grid-cols-1 gap-4 text-left sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-3xl border border-white bg-white/75 p-6 shadow-[0_10px_30px_rgba(40,50,110,0.08)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#5B4FE9] to-[#3A6FF0] text-base font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-[19px] font-extrabold leading-snug">{step.title}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-[#565D73] lg:text-[15px]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 pb-16 text-center md:px-10 md:pb-20 lg:px-20 lg:pb-24" aria-labelledby="price-rounds-heading">
        <div className="mx-auto max-w-[1440px]">
          <Eyebrow>Price-drop rounds</Eyebrow>
          <h2
            id="price-rounds-heading"
            className="mx-auto mt-2.5 max-w-[14ch] text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:max-w-none sm:text-5xl lg:text-[54px]"
          >
            Watch the number come down.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {rounds.map((round) => (
              <article
                key={round.label}
                className={
                  round.featured
                    ? 'flex h-full flex-col rounded-3xl bg-gradient-to-br from-[#5B4FE9] to-[#3A6FF0] p-5 text-left text-white shadow-[0_10px_30px_rgba(70,80,220,0.28)] sm:p-6'
                    : 'flex h-full flex-col rounded-3xl bg-white p-5 text-left shadow-[0_10px_30px_rgba(40,50,110,0.08)] sm:p-6'
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={
                      round.featured
                        ? 'text-base font-extrabold uppercase tracking-[0.06em] text-[#E2E0FF] xl:text-xs'
                        : 'text-base font-extrabold uppercase tracking-[0.06em] text-[#6A7086] xl:text-xs'
                    }
                  >
                    {round.label}
                  </p>
                  <span
                    className={
                      round.featured
                        ? 'shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-base font-extrabold text-white xl:text-xs'
                        : 'shrink-0 rounded-full bg-[#EEF1F7] px-2.5 py-1 text-base font-extrabold text-[#6A7086] xl:text-xs'
                    }
                  >
                    Example
                  </span>
                </div>
                <p className="mt-3 text-[32px] font-extrabold tabular-nums leading-none tracking-[-0.03em] sm:text-[34px]">
                  {formatDollars(round.price)}
                </p>
                <p className="mt-2 font-extrabold">{round.title}</p>
                <p className={round.featured ? 'mt-1 text-base text-[#E2E0FF] lg:text-[13.5px]' : 'mt-1 text-base text-[#6A7086] lg:text-[13.5px]'}>
                  {round.detail}
                </p>
                <div
                  className={round.featured ? 'mt-4 h-2 w-full overflow-hidden rounded-full bg-white/25' : 'mt-4 h-2 w-full overflow-hidden rounded-full bg-[#E7E9F2]'}
                  aria-hidden="true"
                >
                  <div
                    className={
                      round.featured
                        ? 'h-full rounded-full bg-white'
                        : 'h-full rounded-full bg-gradient-to-r from-[#5B4FE9] to-[#3A6FF0]'
                    }
                    style={{ width: `${barPercent(round.price)}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-xl text-base font-semibold text-[#171A2C]/70 lg:text-[12.5px]">
            Example only. Total saved $1,561. Your results depend on the dealer.
          </p>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-10 md:pb-20 lg:px-20 lg:pb-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 rounded-[32px] bg-white px-6 py-8 text-center shadow-[0_20px_60px_rgba(40,50,110,0.1)] md:flex-row md:items-center md:gap-10 md:px-12 md:py-12 md:text-left lg:px-16 lg:py-14">
          <p className="gradient-brand-text shrink-0 text-[72px] font-extrabold leading-none tracking-[-0.05em] md:text-8xl lg:text-[120px]">
            3–5%
          </p>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Typical savings for buyers who compare.</h2>
            <p className="mt-2 text-[17px] leading-relaxed text-[#4E5568]">
              Buyers who compare out-the-door quotes from several dealers typically save 3–5% off the first price
              they&apos;re quoted.
            </p>
            <p className="mt-3 text-base font-semibold text-[#6A7086] lg:text-[13px]">
              Source: CarEdge, State of Dealer Fees 2026. Industry figure, not a Drevvy result.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 px-5 pb-16 text-center md:px-10 md:pb-20 lg:px-20 lg:pb-24">
        <div className="mx-auto max-w-[1000px]">
          <Eyebrow>Car packs</Eyebrow>
          <h2 className="mt-2.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[54px]">
            Pay per car. Never expires.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-5 pt-3 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 xl:gap-4">
            {packs.map((pack) => (
              <article
                key={pack.name}
                className={
                  pack.best
                    ? 'relative flex h-full flex-col rounded-3xl border-2 border-[#5B4FE9] bg-white/80 px-5 py-7 shadow-[0_0_0_6px_#ECEAFF,0_20px_50px_rgba(70,80,220,0.2)] sm:px-6 sm:py-8'
                    : 'relative flex h-full flex-col rounded-3xl border border-white bg-white/80 px-5 py-7 shadow-[0_10px_30px_rgba(40,50,110,0.08)] sm:px-6 sm:py-8'
                }
              >
                {pack.best ? (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-gradient-to-r from-[#5B4FE9] to-[#3A6FF0] px-3 py-1 text-base font-extrabold tracking-[0.08em] text-white md:text-xs">
                    BEST VALUE
                  </span>
                ) : null}
                <p className="font-extrabold text-[#6A7086]">{pack.name}</p>
                <p className="mt-1.5 text-5xl font-extrabold tabular-nums leading-none tracking-[-0.04em] xl:text-[44px]">{pack.price}</p>
                <p className="mt-2 text-lg font-extrabold">{pack.cars}</p>
                <p className={pack.best ? 'mt-1.5 text-balance text-base font-extrabold text-[#4B3FD9] md:text-sm' : 'mt-1.5 text-balance text-base font-semibold text-[#6A7086] md:text-sm'}>
                  {pack.detail}
                </p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-xl font-bold text-[#4E5568]">
            One-time purchase. No subscription. Your cars never expire. Asking and shopping are always free.
          </p>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 px-5 pb-16 text-center md:px-10 md:pb-20 lg:px-20 lg:pb-28">
        <div className="mx-auto max-w-[820px]">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-2.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[54px]">
            Questions, answered.
          </h2>
          <div className="mt-9 text-left">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                open={faq.open}
                className="group mb-2.5 rounded-[20px] border border-white bg-white/80 px-5 py-4 shadow-[0_10px_30px_rgba(40,50,110,0.05)] sm:px-6"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-extrabold [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <span className="text-[22px] font-medium leading-none text-[#171A2C]/60 group-open:hidden" aria-hidden="true">
                    +
                  </span>
                  <span className="hidden text-[22px] font-medium leading-none text-[#171A2C]/60 group-open:inline" aria-hidden="true">
                    –
                  </span>
                </summary>
                <p className="mt-2 text-base leading-relaxed text-[#171A2C]/80">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 px-5 pb-16 md:px-10 lg:px-20 lg:pb-28" aria-labelledby="download-heading">
        <div className="mx-auto max-w-[1280px] rounded-[32px] bg-[radial-gradient(600px_300px_at_50%_0%,#DCD8FF,transparent_75%),#fff] px-5 py-11 text-center shadow-[0_20px_60px_rgba(40,50,110,0.1)] sm:px-8 md:px-14 md:py-16">
          <Eyebrow>Get the app</Eyebrow>
          <h2
            id="download-heading"
            className="mx-auto mt-2.5 max-w-[16ch] text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:max-w-none sm:text-5xl lg:text-[54px]"
          >
            Know the real price before you go.
          </h2>
          <p className="mx-auto mt-3.5 max-w-[640px] text-[17px] font-medium leading-relaxed text-[#4E5568] lg:text-[21px]">
            Asking and shopping are free. Unlock a price only on the car you want.
          </p>
          <StoreCta />
        </div>
      </section>

      <Footer />
    </main>
  );
}
