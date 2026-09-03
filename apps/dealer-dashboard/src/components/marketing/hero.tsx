import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto px-6 max-w-4xl">
        {/* Badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-primary/10 border border-primary/20 text-primary">
            Car Buyers Are Searching ChatGPT Right Now
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Is Your Inventory{' '}
            <span className="gradient-showing">Showing</span>{' '}
            <span className="gradient-up">Up?</span>
          </h1>
          <p className="text-lg md:text-xl leading-[1.75] text-muted-foreground max-w-3xl mx-auto tracking-[-0.01em]">
            The customer journey has changed forever. Buyers now ask ChatGPT for the exact vehicle they want—“show me affordable AWD SUVs near me”—and your competitors’ inventory shows up while yours doesn’t. Drevvy fixes that.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 mt-16 md:mt-16">
          <Button 
            asChild 
            className="h-11 px-8 py-2.5 text-lg font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ease-out group"
          >
            <Link href="/auth">
              Sign Up
              <ArrowRight className="ml-2 h-4 w-4 hover-icon-shift" />
            </Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className="h-11 px-8 py-2.5 text-lg font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out"
          >
            <Link href="/request-demo">
              Schedule Demo
            </Link>
          </Button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 md:mt-16">
          <div className="hero-stat-card p-6 rounded-lg text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="stat-gradient-text text-2xl md:text-3xl font-bold leading-tight mb-2">73%</div>
            <div className="text-xs md:text-sm leading-[1.5] text-muted-foreground">Buyers Use ChatGPT</div>
          </div>
          <div className="hero-stat-card p-6 rounded-lg text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <div className="stat-gradient-text text-2xl md:text-3xl font-bold leading-tight mb-2">Real-Time</div>
            <div className="text-xs md:text-sm leading-[1.5] text-muted-foreground">Inventory Sync</div>
          </div>
          <div className="hero-stat-card p-6 rounded-lg text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="stat-gradient-text text-2xl md:text-3xl font-bold leading-tight mb-2">100%</div>
            <div className="text-xs md:text-sm leading-[1.5] text-muted-foreground">AI Search Coverage</div>
          </div>
          <div className="hero-stat-card p-6 rounded-lg text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <div className="stat-gradient-text text-2xl md:text-3xl font-bold leading-tight mb-2">First</div>
            <div className="text-xs md:text-sm leading-[1.5] text-muted-foreground">To Market</div>
          </div>
        </div>
      </div>
    </section>
  );
}
