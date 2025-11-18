import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoAgent - AI-Powered Car Discovery for Dealers',
  description: 'Put your inventory where AI shoppers are looking. Appear in ChatGPT searches instantly and capture high-intent buyers before they visit competitor sites.',
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
