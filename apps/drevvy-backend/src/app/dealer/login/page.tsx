import type { Metadata } from 'next';

import { LoginForm } from '@/components/dealer/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function DealerLoginPage() {
  return <LoginForm />;
}
