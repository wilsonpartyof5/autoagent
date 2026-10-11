import type { Metadata, Viewport } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Drevvy - Get the Real Out-the-Door Price',
    template: '%s | Drevvy',
  },
  description:
    "Stop guessing what you'll actually pay for a car. Drevvy's AI contacts dealers for you and gets a clear, written out-the-door price.",
  metadataBase: new URL('https://www.drevvy.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.drevvy.com',
    siteName: 'Drevvy',
    title: 'Drevvy - Get the Real Out-the-Door Price',
    description:
      "Stop guessing what you'll actually pay for a car. Drevvy's AI contacts dealers for you and gets a clear, written out-the-door price.",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drevvy - Get the Real Out-the-Door Price',
    description:
      "Stop guessing what you'll actually pay for a car. Drevvy's AI contacts dealers for you.",
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
    { media: '(prefers-color-scheme: light)', color: '#16a34a' },
    { media: '(prefers-color-scheme: dark)', color: '#16a34a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
