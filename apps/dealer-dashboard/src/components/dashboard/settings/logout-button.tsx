'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // Redirect to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </Button>
  );
}
