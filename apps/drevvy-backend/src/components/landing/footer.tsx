import Link from 'next/link';
import { LEGAL } from '@/lib/legal-constants';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-2xl font-bold text-primary">
              Drevvy
            </Link>
            <p className="mt-3 text-sm text-background/70">
              The car-buying app that gets you the real out-the-door price.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-background/70">
              <li>
                <Link href="/#how-it-works" className="hover:text-primary transition-colors">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-primary transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-background/70">
              <li>
                <Link href="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/sms" className="hover:text-primary transition-colors">
                  SMS Program
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-sm text-background/70">
              <li>
                <Link href="/dealers" className="hover:text-primary transition-colors">
                  For Dealers
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
                  className="hover:text-primary transition-colors"
                >
                  {LEGAL.SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/60">
            &copy; {currentYear} {LEGAL.ENTITY_NAME}. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-background/60">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="hover:text-primary transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
