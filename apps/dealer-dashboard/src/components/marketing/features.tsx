import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Users, BarChart, Shield } from 'lucide-react';

const features = [
  {
    icon: TrendingUp,
    title: 'Real-Time ChatGPT Integration',
    description: 'Your entire inventory automatically populates when buyers ask ChatGPT for vehicles. They search, they see your cars, they contact you.'
  },
  {
    icon: DollarSign,
    title: 'Capture High-Intent Buyers',
    description: 'When someone asks ChatGPT "show me used Ford F-150s under $30k near me", your inventory appears instantly—while competitors are invisible.'
  },
  {
    icon: Clock,
    title: 'Automated Inventory Sync',
    description: 'Every vehicle you add is instantly available across ChatGPT and AI search platforms. No manual uploads, no delays.'
  },
  {
    icon: Users,
    title: 'Multi-Store Inventory',
    description: 'Manage and syndicate inventory across all your dealership locations from one dashboard.'
  },
  {
    icon: BarChart,
    title: 'AI Search Analytics',
    description: 'See exactly which vehicles buyers are searching for on ChatGPT and adjust your inventory strategy in real-time.'
  },
  {
    icon: Shield,
    title: 'Be Visible or Be Forgotten',
    description: 'Traditional car shopping sites are dying. ChatGPT is the new showroom floor. Drevvy puts you there before your competitors even know it exists.'
  }
];

export function Features() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Be Everywhere High-Intent Buyers Are Looking
          </h2>
          <p className="text-lg leading-7 text-muted-foreground max-w-2xl mx-auto">
            ChatGPT is the new Autotrader. Buyers with money in hand are searching for specific vehicles right now—and they only see dealers who are integrated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="p-6 bg-card border border-border shadow-sm hover:-translate-y-1 hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out">
                <CardHeader className="p-0">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-semibold text-foreground">
                      {feature.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <CardDescription className="text-base leading-6 text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
