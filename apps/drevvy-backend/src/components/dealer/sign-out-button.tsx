'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { signOutDealer } from '@/app/dealer/demo-actions';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton({
  className,
  children,
}: {
  className?: string;
  children: string;
}) {
  const router = useRouter();

  async function signOut() {
    try {
      await signOutDealer();
    } catch {
      /* still leave the desk */
    }
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* still leave the desk */
    }
    router.push('/dealer/login');
    router.refresh();
  }

  return (
    <Link
      className={className}
      href="/dealer/login"
      title="Sign out"
      onClick={(event) => {
        event.preventDefault();
        void signOut();
      }}
    >
      {children}
    </Link>
  );
}
