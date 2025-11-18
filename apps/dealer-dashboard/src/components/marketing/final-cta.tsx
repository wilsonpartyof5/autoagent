import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6">
        <Card className="card-elevated bg-card border border-border max-w-3xl mx-auto">
        <div className="p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Put Your Inventory Where AI Shoppers Are Looking
          </h2>
          <p className="text-lg leading-7 text-muted-foreground max-w-3xl mx-auto mb-8">
            Every minute your vehicles aren't in ChatGPT, the highest-intent buyers go straight to a competitor. Claim the visibility now while it's still an unfair advantage.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button asChild className="h-11 px-8 py-2.5 text-lg font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ease-out group">
              <Link href="/auth">
                Sign Up
                <ArrowRight className="ml-2 h-4 w-4 hover-icon-shift" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-8 py-2.5 text-lg font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out">
              <Link href="/request-demo">
                Talk to Sales
              </Link>
            </Button>
          </div>
          
          <p className="text-sm leading-5 text-muted-foreground mt-6">
            Join dealerships capturing buyers directly from ChatGPT searches.
          </p>
        </div>
        </Card>
      </div>
    </section>
  );
}
