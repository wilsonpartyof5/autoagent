'use client';

import React, { useState } from 'react';
import { Shield, Database, Users, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const steps = [
  {
    id: 1,
    title: 'Connect Your Inventory',
    icon: Database,
    description: 'Choose how you\'d like to manage your vehicle listings'
  },
  {
    id: 2,
    title: 'Add Team Members',
    icon: Users,
    description: 'Invite your sales team to manage leads together'
  },
  {
    id: 3,
    title: 'Set Up Billing',
    icon: CreditCard,
    description: 'Add your payment method to activate your account'
  },
  {
    id: 4,
    title: 'Activation Confirmation',
    icon: CheckCircle2,
    description: 'You\'re all set!'
  }
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  
  const progressPercentage = (currentStep / 4) * 100;
  
  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Handle final activation
      console.log('Account activated!');
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        {/* Header Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white text-center mb-2">
            AutoAgent
          </h1>
          <p className="text-xl text-muted-foreground text-center">
            Smarter leads. Lower costs.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 animate-fade-in delay-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of 4
            </span>
            <span className="text-sm font-medium text-primary">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mb-8 animate-fade-in delay-200">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;
            
            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className={`
                  h-12 w-12 rounded-full border-2 flex items-center justify-center mb-2 transition-all duration-200
                  ${isActive 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : 'border-muted bg-background text-muted-foreground'
                  }
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`
                  text-xs font-medium text-center px-2
                  ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}
                `}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Content Card */}
        <Card className="card-elevated animate-slide-up">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {steps[currentStep - 1].title}
            </CardTitle>
            <p className="text-base text-muted-foreground">
              {steps[currentStep - 1].description}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step Content Placeholder */}
            <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">
                  Step {currentStep} Content
                </p>
                <p className="text-sm text-muted-foreground">
                  Detailed form content will be implemented here
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8 pt-6 border-t">
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}
              <Button 
                className="w-full sm:w-auto flex-1 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                onClick={handleNext}
              >
                {currentStep === 4 ? 'Activate Account' : 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
