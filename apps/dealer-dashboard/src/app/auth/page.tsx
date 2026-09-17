'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  
  // Check for integrity check error from middleware redirect
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    
    if (errorParam === 'integrity_check_failed' && messageParam) {
      setError(`${messageParam} Please contact support for assistance.`);
    } else if (errorParam === 'confirmation_failed') {
      setError('That confirmation link is invalid or has expired. Please request a new email.');
    }
  }, [searchParams]);

  const getEmailRedirectTo = () =>
    `${window.location.origin}/auth/callback?next=/onboarding`;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let supabase;
      try {
        supabase = createClient();
      } catch (clientError) {
        throw new Error(
          `Failed to initialize Supabase client: ${clientError instanceof Error ? clientError.message : 'Unknown error'}. Please check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.`
        );
      }

      if (isSignUp) {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getEmailRedirectTo(),
          },
        });

        if (signUpError) {
          throw new Error(signUpError.message || 'Sign up failed. Please try again.');
        }

        if (!data.session) {
          setConfirmationEmail(email);
          setConfirmationMessage(
            'Check your inbox and confirm your email before signing in.',
          );
          setLoading(false);
          return;
        }

        window.location.href = '/onboarding';
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw new Error(signInError.message || 'Invalid email or password. Please try again.');
        }

        // Middleware resolves whether onboarding is already complete.
        window.location.href = '/onboarding';
      }
    } catch (err: unknown) {
      // Extract error message from various error types
      let errorMessage = 'An error occurred';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Handle Supabase error objects
        if ('message' in err && typeof err.message === 'string') {
          errorMessage = err.message;
        } else if ('error_description' in err && typeof err.error_description === 'string') {
          errorMessage = err.error_description;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!confirmationEmail) {
      return;
    }

    setResending(true);
    setError(null);
    setConfirmationMessage(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: confirmationEmail,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setConfirmationMessage('A new confirmation email is on its way.');
    }
    setResending(false);
  };

  if (confirmationEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Confirm your email</CardTitle>
            <CardDescription>
              We sent a Drevvy confirmation link to {confirmationEmail}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {confirmationMessage && (
              <div className="rounded-md bg-primary/10 p-3 text-sm text-foreground">
                {confirmationMessage}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={resending}
              onClick={handleResendConfirmation}
            >
              {resending ? 'Sending...' : 'Resend confirmation email'}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-primary hover:underline"
              onClick={() => {
                setConfirmationEmail(null);
                setConfirmationMessage(null);
              }}
            >
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? 'Create your Drevvy account' : 'Welcome to Drevvy'}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? 'Start connecting your dealership to AI-powered shoppers.'
              : 'Sign in to manage your dealership leads and inventory.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
            </Button>
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-primary hover:underline"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
