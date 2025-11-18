import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

const benefits = [
  'Appear in ChatGPT searches instantly',
  'Capture buyers before they visit competitor sites',
  'Sync your inventory to AI platforms automatically',
  'Get leads from the highest-intent buyers',
  'Stop losing sales to invisible competitors',
  'Dominate the new AI-powered car shopping journey'
];

export function Benefits() {
  return (
    <section className="bg-card/50 backdrop-blur-sm border-y border-border/40">
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            The New Customer Journey Starts In ChatGPT
          </h2>
          <p className="text-lg leading-7 text-muted-foreground max-w-3xl mx-auto mb-8">
            Right now, buyers are asking ChatGPT: “Find me a certified, low-mile SUV near downtown.” If your inventory isn’t feeding those AI searches, they literally can’t find you. Game over.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Benefits Checklist */}
          <div>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-lg leading-7 text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Journey Card */}
          <Card className="card-elevated p-8">
            <CardHeader className="p-0">
              <CardTitle className="gradient-text text-5xl font-bold">
                Today's Reality
              </CardTitle>
              <p className="text-base text-muted-foreground">
                The ChatGPT Car Shopping Journey
              </p>
            </CardHeader>
            <CardContent className="p-0 mt-6">
              <div className="space-y-0">
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Buyer searches ChatGPT</span>
                  <span className="font-semibold text-foreground">Now</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Your inventory appears</span>
                  <span className="font-semibold text-foreground">Instantly</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground">Competitors?</span>
                  <span className="font-semibold text-foreground">Invisible</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
