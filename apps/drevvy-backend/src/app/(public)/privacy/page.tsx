import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/landing/footer';
import { LEGAL } from '@/lib/legal-constants';

export const metadata: Metadata = {
  title: 'Privacy Policy - Drevvy',
  description: 'Privacy Policy for the Drevvy car-buying app. Learn how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Drevvy
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <article className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Effective Date: {LEGAL.EFFECTIVE_DATE}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
              <p className="text-muted-foreground mb-4">
                {LEGAL.ENTITY_NAME} (&quot;Drevvy,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the {LEGAL.APP_NAME} mobile
                application (the &quot;App&quot;). This Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you use our App.
              </p>
              <p className="text-muted-foreground">
                Please read this Privacy Policy carefully. By using the App, you agree to the collection and use
                of information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">Account Information</h3>
              <p className="text-muted-foreground mb-4">
                When you create an account, we collect information you provide, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Your first name</li>
                <li>Email address (stored securely in our authentication system)</li>
                <li>State of vehicle registration (for tax estimation)</li>
                <li>ZIP code or general location (for tax estimation and local inventory)</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">Location Information</h3>
              <p className="text-muted-foreground mb-4">
                With your permission, we collect approximate location data to show you vehicles near you and
                estimate accurate taxes and fees. You can disable location access in your device settings,
                though this may limit certain features.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Usage Information</h3>
              <p className="text-muted-foreground mb-4">
                We automatically collect information about how you use the App, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Vehicles you view and search for</li>
                <li>Vehicles you ask us to get pricing on</li>
                <li>Your preferences (budget, vehicle type, features)</li>
                <li>App interactions and feature usage</li>
                <li>Device information (model, operating system)</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">In-App Purchases</h3>
              <p className="text-muted-foreground mb-4">
                Subscription purchases are processed through Apple App Store or Google Play Store. We receive
                confirmation of your subscription status through RevenueCat, our subscription management
                provider. We do not receive or store your payment card information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide our services, including contacting dealers on your behalf</li>
                <li>Show you relevant vehicle inventory based on your location and preferences</li>
                <li>Calculate accurate tax and fee estimates</li>
                <li>Process and manage your subscription</li>
                <li>Communicate with you about your requests and our services</li>
                <li>Improve the App and develop new features</li>
                <li>Ensure the security and integrity of our services</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">AI Processing and Third-Party AI Services</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy uses artificial intelligence to contact dealers and gather pricing information on your
                behalf. Our AI systems:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Send emails, text messages, and make phone calls to dealerships</li>
                <li>Analyze dealer responses to extract pricing details</li>
                <li>Summarize information for your review</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                These communications are conducted using your first name only. Your phone number, email address,
                and home address are never shared with dealers unless you explicitly choose to contact them
                directly.
              </p>
              <p className="text-muted-foreground mt-4">
                We use OpenAI&apos;s API to power certain AI features, including natural language processing for
                dealer communications and summarization of pricing information. When using these features, your
                first name, vehicle preferences, and inquiry details may be processed by OpenAI. OpenAI&apos;s
                processing is governed by their{' '}
                <a
                  href="https://openai.com/policies/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
                . We do not share your email address, phone number, or home address with OpenAI.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">Call Recording Notice</h2>
              <p className="text-muted-foreground mb-4">
                When our AI agent makes phone calls to dealerships on your behalf, those calls may be recorded
                for quality assurance, training, dispute resolution, and compliance purposes.
              </p>
              <p className="text-muted-foreground">
                Recordings are stored securely and retained only as long as necessary for these purposes. Call
                recordings are not shared with third parties except as required by law or as necessary to
                resolve disputes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Information Shared with Dealers</h2>
              <p className="text-muted-foreground mb-4">
                When we contact dealers on your behalf, we share only:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Your first name</li>
                <li>Your state of registration (for tax calculation)</li>
                <li>Your ZIP code (for tax and fee estimation)</li>
              </ul>
              <p className="text-muted-foreground mt-4 font-medium">
                We never share your phone number, email address, or street address with dealers.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">SMS and Text Messaging Privacy</h2>
              <p className="text-muted-foreground mb-4">
                Drevvy sends text messages to dealership personnel as part of our service to get pricing
                information for you. Regarding any SMS communications:
              </p>
              <p className="text-muted-foreground mb-4 font-medium">
                No mobile information will be shared with third parties/affiliates for marketing/promotional
                purposes. All other categories exclude text messaging originator opt-in data and consent; this
                information will not be shared with any third parties.
              </p>
              <p className="text-muted-foreground">
                For more details about our SMS practices, please see our{' '}
                <Link href="/sms" className="text-primary hover:underline">
                  SMS Program Information
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
              <p className="text-muted-foreground mb-4">We use the following third-party services:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Apple/Google:</strong> For authentication (Sign in with Apple) and subscription
                  processing
                </li>
                <li>
                  <strong>RevenueCat:</strong> For subscription management and analytics
                </li>
                <li>
                  <strong>Supabase:</strong> For secure data storage and authentication
                </li>
                <li>
                  <strong>OpenAI:</strong> For AI-powered natural language processing (see AI Processing section
                  above)
                </li>
                <li>
                  <strong>Analytics providers:</strong> To understand App usage and improve our services
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                These services have their own privacy policies governing their use of data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain your information for as long as your account is active or as needed to provide you
                services. We also retain information as necessary to comply with legal obligations, resolve
                disputes, and enforce our agreements.
              </p>
              <p className="text-muted-foreground">
                If you delete your account, we will delete your personal information within 30 days, except
                where we are required to retain it by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Data Deletion</h2>
              <p className="text-muted-foreground mb-4">
                You may request deletion of your personal data at any time by:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Using the &quot;Delete Account&quot; option in the App settings</li>
                <li>
                  Emailing us at{' '}
                  <a href={`mailto:${LEGAL.PRIVACY_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.PRIVACY_EMAIL}
                  </a>
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We will process your request within 30 days and confirm deletion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">California Residents (CCPA/CPRA)</h3>
              <p className="text-muted-foreground mb-4">If you are a California resident, you have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Know what personal information we collect about you</li>
                <li>Request deletion of your personal information</li>
                <li>Opt out of the &quot;sale&quot; or &quot;sharing&quot; of your personal information (we do not sell your data)</li>
                <li>Not be discriminated against for exercising your rights</li>
                <li>Correct inaccurate personal information</li>
                <li>Limit the use of sensitive personal information</li>
              </ul>
              <p className="text-muted-foreground">
                To exercise these rights, contact us at{' '}
                <a href={`mailto:${LEGAL.PRIVACY_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.PRIVACY_EMAIL}
                </a>
                .
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">Other State Privacy Laws</h3>
              <p className="text-muted-foreground mb-4">
                Residents of Virginia, Colorado, Connecticut, Utah, and other states with comprehensive privacy
                laws may have similar rights. Contact us to exercise any applicable rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Children&apos;s Privacy</h2>
              <p className="text-muted-foreground">
                Our App is not intended for children under 13 years of age. We do not knowingly collect personal
                information from children under 13. If you are a parent or guardian and believe your child has
                provided us with personal information, please contact us at{' '}
                <a href={`mailto:${LEGAL.PRIVACY_EMAIL}`} className="text-primary hover:underline">
                  {LEGAL.PRIVACY_EMAIL}
                </a>
                , and we will delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organizational measures to protect your personal
                information against unauthorized access, alteration, disclosure, or destruction. However, no
                method of transmission over the Internet or electronic storage is 100% secure.
              </p>
              <p className="text-muted-foreground">
                <strong>FTC Safeguards Rule:</strong> To the extent Drevvy handles nonpublic personal information
                related to consumer vehicle financing, we maintain an information security program designed to
                comply with the FTC Safeguards Rule (16 CFR Part 314), including administrative, technical, and
                physical safeguards appropriate to our size and complexity.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by
                posting the new Privacy Policy on this page and updating the &quot;Effective Date.&quot; We encourage you
                to review this Privacy Policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <p className="text-muted-foreground mb-4">
                {LEGAL.ENTITY_NAME}
                <br />
                {LEGAL.BUSINESS_ADDRESS}
              </p>
              <ul className="list-none text-muted-foreground space-y-2">
                <li>
                  <strong>General support:</strong>{' '}
                  <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.SUPPORT_EMAIL}
                  </a>
                </li>
                <li>
                  <strong>Privacy inquiries:</strong>{' '}
                  <a href={`mailto:${LEGAL.PRIVACY_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.PRIVACY_EMAIL}
                  </a>
                </li>
                <li>
                  <strong>Opt-out requests:</strong>{' '}
                  <a href={`mailto:${LEGAL.OPTOUT_EMAIL}`} className="text-primary hover:underline">
                    {LEGAL.OPTOUT_EMAIL}
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </article>

      <Footer />
    </main>
  );
}
