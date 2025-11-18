'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/40">
      <div className="container mx-auto flex items-center justify-between max-w-6xl px-6 py-3.5">
        {/* Logo */}
        <Link href="/" className="gradient-text text-2xl font-bold">
          AutoAgent
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/auth"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
