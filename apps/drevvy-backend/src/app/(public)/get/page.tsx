import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { QRCode } from '@/components/landing/qr-code';
import { StoreBadges } from '@/components/landing/store-badges';
import { Footer } from '@/components/landing/footer';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'Download Drevvy',
  description: 'Download Drevvy for iOS or Android and get the real out-the-door price on your next car.',
  robots: 'noindex',
};

function detectPlatform(userAgent: string): 'ios' | 'android' | 'desktop' {
  const ua = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }

  if (/android/.test(ua)) {
    return 'android';
  }

  return 'desktop';
}

export default async function GetPage() {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const platform = detectPlatform(userAgent);

  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL;
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

  if (platform === 'ios' && appStoreUrl) {
    redirect(appStoreUrl);
  }

  if (platform === 'android' && playStoreUrl) {
    redirect(playStoreUrl);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center">
          <Link href="/" className="text-xl font-bold text-primary">
            Drevvy
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Get {LEGAL.APP_NAME}
            </h1>
            <p className="text-muted-foreground mb-8">
              Download the app to start getting real out-the-door prices.
            </p>

            {/* QR Code for desktop */}
            <div className="bg-card rounded-2xl p-8 card-elevated mb-8">
              <div className="mb-6">
                <QRCode size={200} className="mx-auto text-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Scan with your phone to download
              </p>
              <StoreBadges className="justify-center" />
            </div>

            <p className="text-sm text-muted-foreground">
              Have questions?{' '}
              <a
                href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
                className="text-primary hover:underline"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
