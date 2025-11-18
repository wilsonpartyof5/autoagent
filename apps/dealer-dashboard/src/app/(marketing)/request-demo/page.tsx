'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

type FormState = {
  status: 'idle' | 'submitting' | 'success' | 'error';
  message?: string;
};

export default function RequestDemoPage() {
  const [formState, setFormState] = useState<FormState>({ status: 'idle' });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setFormState({ status: 'submitting' });

    const payload = {
      fullName: formData.get('fullName')?.toString().trim(),
      email: formData.get('email')?.toString().trim(),
      phone: formData.get('phone')?.toString().trim(),
      dealership: formData.get('dealership')?.toString().trim(),
      role: formData.get('role')?.toString().trim(),
      interest: formData.get('interest')?.toString().trim(),
      message: formData.get('message')?.toString().trim(),
      source: 'marketing-form',
    };

    try {
      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to send request');
      }

      setFormState({ status: 'success', message: 'Thanks! Our team will reach out shortly.' });
      event.currentTarget.reset();
    } catch (error) {
      setFormState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unexpected error',
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="container max-w-3xl mx-auto px-6 py-12">
        <div className="mb-12 text-center space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Talk To Sales</p>
          <h1 className="text-4xl font-bold text-foreground">Book A Demo</h1>
          <p className="text-muted-foreground text-lg">
            Share a few details and we&apos;ll show you how AutoAgent syncs inventory into ChatGPT, captures leads, and connects to your CRM.
          </p>
        </div>

        <Card className="p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Full name" name="fullName" required />
              <Field label="Email" name="email" type="email" required />
              <Field label="Phone" name="phone" />
              <Field label="Dealership" name="dealership" />
              <Field label="Role / Title" name="role" />
              <Field label="Inventory provider" name="interest" placeholder="MarketCheck, CDK, vAuto, etc." />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                What do you want to see?
              </label>
              <textarea
                name="message"
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Tell us about your goals, inventory source, or current tools."
              />
            </div>

            {formState.status === 'success' && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                {formState.message}
              </div>
            )}
            {formState.status === 'error' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formState.message}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={formState.status === 'submitting'}>
              {formState.status === 'submitting' ? 'Sending...' : 'Submit Request'}
            </Button>
          </form>

        </Card>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
};

function Field({ label, name, type = 'text', required, placeholder }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
