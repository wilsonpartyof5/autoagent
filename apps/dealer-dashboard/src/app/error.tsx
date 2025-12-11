/**
 * Phase 4: Global Error Boundary
 * 
 * Tracks system errors via analytics when errors occur.
 * Includes session_id from cookie for proper session correlation.
 */

'use client';

import { useEffect } from 'react';
import { trackSystemError } from '@/lib/analytics/tracking-client';
import { getSessionId } from '@/lib/analytics/session-client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Get session ID from localStorage (if available)
    const sessionId = getSessionId();
    
    // Track system error with session_id
    trackSystemError(
      'global_error_boundary',
      error.message || 'Unknown error',
      'error-boundary',
      {
        // Session ID will be included via client-side tracking
        // Dealer ID not available in error boundary context
      }
    ).catch(() => {
      // Ignore tracking errors - don't break error display
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
