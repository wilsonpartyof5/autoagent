import Link from 'next/link';
import { LEGAL } from '@/lib/legal-constants';
import { Logo } from '@/components/landing/logo';

const linkClass =
  'flex min-h-11 items-center text-base font-semibold text-[#171A2C]/80 transition-colors hover:text-[#171A2C] lg:min-h-0 lg:text-sm';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E4E8F1] bg-white text-[#171A2C]">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)] lg:gap-10 lg:px-20 lg:pb-8 lg:pt-14">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo gradientId="logo-footer" />
          <p className="mt-3 max-w-[260px] text-base leading-relaxed text-[#171A2C]/70 lg:text-sm">
            The car-buying app that gets you the real out-the-door price.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-base font-extrabold uppercase tracking-[0.06em] text-[#171A2C]/60 lg:text-[13px]">Product</h2>
          <Link href="/#how-it-works" className={linkClass}>
            How it works
          </Link>
          <Link href="/#pricing" className={linkClass}>
            Pricing
          </Link>
          <Link href="/#faq" className={linkClass}>
            FAQ
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-base font-extrabold uppercase tracking-[0.06em] text-[#171A2C]/60 lg:text-[13px]">Legal</h2>
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
          <Link href="/sms" className={linkClass}>
            SMS Program
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-base font-extrabold uppercase tracking-[0.06em] text-[#171A2C]/60 lg:text-[13px]">Contact</h2>
          <Link href="/dealers" className={linkClass}>
            For Dealers
          </Link>
          <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className={linkClass}>
            {LEGAL.SUPPORT_EMAIL}
          </a>
        </div>

        <p className="col-span-full border-t border-[#E4E8F1] pt-5 text-base text-[#171A2C]/55 lg:text-[13px]">
          &copy; {currentYear} {LEGAL.ENTITY_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
