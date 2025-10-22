import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'AutoAgent Dealer Dashboard',
  description: 'Dealer dashboard for AutoAgent - AI-powered car discovery and lead generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
