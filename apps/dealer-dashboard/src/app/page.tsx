import { Header } from '@/components/marketing/header';
import { Hero } from '@/components/marketing/hero';
import { Features } from '@/components/marketing/features';
import { Benefits } from '@/components/marketing/benefits';
import { FinalCTA } from '@/components/marketing/final-cta';
import { Footer } from '@/components/marketing/footer';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Header />
      <main>
        <Hero />
        <Features />
        <Benefits />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
