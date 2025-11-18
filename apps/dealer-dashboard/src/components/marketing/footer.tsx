import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-card/30 backdrop-blur-sm border-t border-border/40">
      <div className="container px-6 py-8">
        <div className="flex flex-col gap-4 items-center text-center md:flex-row md:items-center md:justify-between">
          <Link href="/" className="gradient-text text-2xl font-bold">
            AutoAgent
          </Link>
          <p className="text-sm text-muted-foreground">
            © 2025 AutoAgent. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
