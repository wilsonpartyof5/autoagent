import type { Metadata, Viewport } from 'next';
import React from 'react';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Drevvy — Know the real price before you go',
    template: '%s | Drevvy',
  },
  description:
    'Drevvy asks the dealer for an itemized out-the-door price in writing, so every fee and add-on is on the table. You get transparency, and you stay anonymous until you accept.',
  metadataBase: new URL('https://www.drevvy.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.drevvy.com',
    siteName: 'Drevvy',
    title: 'Drevvy — Know the real price before you go',
    description:
      'Drevvy asks the dealer for an itemized out-the-door price in writing. You get transparency, and you stay anonymous until you accept.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drevvy — Know the real price before you go',
    description:
      'Itemized out-the-door prices in writing. Transparency before you go, and you stay anonymous until you accept.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#5B4FE9' },
    { media: '(prefers-color-scheme: dark)', color: '#8B82FF' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className={`${manrope.className} antialiased`}>{children}</body>
    </html>
  );
}
