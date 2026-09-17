import { Building2, CreditCard, Database } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getDealerProfile,
  type OnboardingStep,
} from '@/lib/supabase/profile';
import { createClient } from '@/lib/supabase/server';

const steps = [
  {
    id: 1 as const,
    title: 'Dealership details',
    description: 'Tell Drevvy about your dealership.',
    icon: Building2,
  },
  {
    id: 2 as const,
    title: 'Connect inventory',
    description: 'Choose the inventory source Drevvy should use.',
    icon: Database,
  },
  {
    id: 3 as const,
    title: 'Billing and launch',
    description: 'Review billing and prepare your account to go live.',
    icon: CreditCard,
  },
];

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const profile = await getDealerProfile();

  if (
    profile?.platformRole === 'platform_admin' ||
    profile?.onboardingCompleted
  ) {
    redirect('/app/leads');
  }

  const currentStep: OnboardingStep = profile?.onboardingStep ?? 1;
  const activeStep = steps[currentStep - 1];

  return (
    <main className="min-h-screen bg-gradient-dark px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Drevvy dealer onboarding
          </p>
          <h1 className="text-4xl font-bold text-white">
            {profile?.fullName ? `Welcome, ${profile.fullName}` : 'Welcome to Drevvy'}
          </h1>
          <p className="text-muted-foreground">
            Complete these three steps to prepare your dealership account.
          </p>
        </header>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Step {currentStep} of {steps.length}
            </span>
            <span className="font-medium text-primary">
              {Math.round((currentStep / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCurrent = step.id === currentStep;
            const isReached = step.id <= currentStep;

            return (
              <li
                key={step.id}
                className={`rounded-lg border p-4 ${
                  isCurrent
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <Icon
                  className={`mb-3 h-5 w-5 ${
                    isReached ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <p className="text-sm font-medium">{step.title}</p>
              </li>
            );
          })}
        </ol>

        <Card>
          <CardHeader>
            <CardTitle>{activeStep.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {activeStep.description}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-48 items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
              <div className="space-y-2">
                <p className="font-medium">Step {currentStep} is ready for its form.</p>
                <p className="text-sm text-muted-foreground">
                  The detailed fields and actions will be added in the next phase.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
