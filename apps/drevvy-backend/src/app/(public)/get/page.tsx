import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/landing/logo';
import { StoreBadge } from '@/components/landing/store-badges';
import { LEGAL } from '@/lib/legal-constants';
import { resolveGetDestination, storeUrlsFromEnv } from '@/lib/store-links';

export const metadata: Metadata = {
  title: 'Get Drevvy',
  description: 'Download Drevvy for iOS or Android.',
  robots: { index: false, follow: false },
};

export default async function GetPage() {
  const headerList = await headers();
  const destination = resolveGetDestination(headerList.get('user-agent') ?? '', storeUrlsFromEnv());

  if (destination.kind === 'redirect') {
    redirect(destination.url);
  }

  if (destination.kind === 'landing') {
    redirect('/');
  }

  const platform = destination.platform;
  const headline =
    platform === 'ios'
      ? 'Coming soon on the App Store.'
      : platform === 'android'
        ? 'Coming soon on Google Play.'
        : 'Coming soon on the App Store and Google Play.';

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(900px_600px_at_50%_-10%,#DCD8FF,transparent_70%),#EEF1F7] text-[#171A2C]">
      <header className="px-5 py-5 md:px-10">
        <Logo gradientId="logo-get" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-[#4B3FD9]">Download</p>
        <h1 className="mt-3 max-w-md text-4xl font-extrabold tracking-[-0.035em]">{headline}</h1>
        <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#4E5568]">
          This link will open the store when Drevvy is available. Asking and shopping in the app are free.
        </p>
        <div className="mt-8 flex w-full max-w-[440px] flex-wrap justify-center gap-3">
          {platform !== 'android' ? <StoreBadge store="ios" fullWidth /> : null}
          {platform !== 'ios' ? <StoreBadge store="android" fullWidth /> : null}
        </div>
        <Link href="/" className="mt-8 text-sm font-extrabold text-[#4B3FD9] hover:underline">
          Back to drevvy.com
        </Link>
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="mt-3 text-sm font-semibold text-[#6A7086]">
          {LEGAL.SUPPORT_EMAIL}
        </a>
      </div>
    </main>
  );
}
