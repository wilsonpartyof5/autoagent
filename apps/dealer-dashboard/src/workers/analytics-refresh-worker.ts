/**
 * Phase 4: Analytics Refresh Worker
 * 
 * Background worker that processes refresh notifications and refreshes materialized views.
 * 
 * This worker:
 * - Polls every 15 minutes to check if refresh is needed
 * - Optionally listens for PostgreSQL NOTIFY events (if pg library is available)
 * - Logs refresh results for monitoring
 * - Handles graceful shutdown
 * 
 * Run this as a service:
 * - npm run worker:analytics-refresh
 * - Or: pnpm worker:analytics-refresh
 * 
 * Or via external cron:
 * - curl -X POST http://localhost:3000/api/analytics/refresh -H "Authorization: Bearer $TOKEN"
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[analytics-refresh-worker] Missing Supabase configuration');
  console.error('[analytics-refresh-worker] Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Refresh interval: 15 minutes (recommended)
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

// Track if worker is shutting down
let isShuttingDown = false;
let refreshInterval: NodeJS.Timeout | null = null;

/**
 * Process refresh notification
 * Returns refresh result for logging
 */
async function processRefresh(): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`[analytics-refresh-worker] [${new Date().toISOString()}] Checking if refresh needed...`);
    
    // Call refresh function (it checks if refresh is needed internally and returns detailed results)
    const { data, error } = await supabase.rpc('check_and_refresh_analytics_views');
    
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error(`[analytics-refresh-worker] [${new Date().toISOString()}] Refresh error:`, error);
      console.error(`[analytics-refresh-worker] Duration: ${duration}ms`);
      return;
    }
    
    // Log detailed refresh results
    if (data) {
      const result = data as {
        refreshed: boolean;
        reason?: string;
        event_count?: number;
        threshold?: number;
        last_refresh?: string;
        refreshed_at?: string;
        minutes_since_refresh?: number;
        views?: Array<{
          view: string;
          status: 'success' | 'error';
          error?: string;
          refreshed_at: string;
        }>;
      };
      
      if (result.refreshed) {
        console.log(`[analytics-refresh-worker] [${new Date().toISOString()}] ✅ Refresh completed successfully`);
        console.log(`[analytics-refresh-worker] Event count: ${result.event_count}/${result.threshold}`);
        console.log(`[analytics-refresh-worker] Last refresh before: ${result.last_refresh}`);
        console.log(`[analytics-refresh-worker] Refreshed at: ${result.refreshed_at}`);
        
        if (result.views && Array.isArray(result.views)) {
          const successCount = result.views.filter(v => v.status === 'success').length;
          const errorCount = result.views.filter(v => v.status === 'error').length;
          console.log(`[analytics-refresh-worker] Views refreshed: ${successCount} success, ${errorCount} errors`);
          
          // Log any view errors
          result.views.forEach(view => {
            if (view.status === 'error') {
              console.error(`[analytics-refresh-worker] ❌ View ${view.view} failed: ${view.error}`);
            } else {
              console.log(`[analytics-refresh-worker] ✅ View ${view.view} refreshed successfully`);
            }
          });
        }
      } else {
        console.log(`[analytics-refresh-worker] [${new Date().toISOString()}] ⏭️  Refresh skipped: ${result.reason}`);
        console.log(`[analytics-refresh-worker] Event count: ${result.event_count}/${result.threshold}`);
        if (result.minutes_since_refresh !== undefined) {
          console.log(`[analytics-refresh-worker] Minutes since last refresh: ${result.minutes_since_refresh.toFixed(1)}`);
        }
      }
    } else {
      console.log(`[analytics-refresh-worker] [${new Date().toISOString()}] Refresh check completed (no data returned)`);
    }
    
    console.log(`[analytics-refresh-worker] Duration: ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[analytics-refresh-worker] [${new Date().toISOString()}] Unexpected error:`, error);
    console.error(`[analytics-refresh-worker] Duration: ${duration}ms`);
  }
}

/**
 * Setup LISTEN/NOTIFY handler (optional, requires pg library)
 * Falls back to polling if pg is not available
 */
async function setupListenNotify(): Promise<void> {
  try {
    // Try to use pg library if available
    let pg: any = null;
    try {
      // @ts-expect-error - pg is optional dependency, types may not be available
      pg = await import('pg');
    } catch {
      // pg library not available
    }
    
    if (!pg) {
      console.log('[analytics-refresh-worker] pg library not available, using polling only');
      console.log('[analytics-refresh-worker] To enable LISTEN/NOTIFY, install: npm install pg @types/pg');
      return;
    }
    
    // Extract connection string from Supabase URL
    // Supabase connection string format: postgresql://postgres:[password]@[host]:[port]/postgres
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (!dbUrl) {
      console.log('[analytics-refresh-worker] DATABASE_URL not set, using polling only');
      console.log('[analytics-refresh-worker] To enable LISTEN/NOTIFY, set DATABASE_URL environment variable');
      return;
    }
    
    const client = new pg.Client({ connectionString: dbUrl });
    
    client.on('error', (err: any) => {
      console.error('[analytics-refresh-worker] PostgreSQL client error:', err);
    });
    
    await client.connect();
    console.log('[analytics-refresh-worker] Connected to PostgreSQL for LISTEN/NOTIFY');
    
    // Listen for refresh notifications
    await client.query('LISTEN analytics_refresh_needed');
    
    client.on('notification', async (msg: any) => {
      if (msg.channel === 'analytics_refresh_needed') {
        console.log(`[analytics-refresh-worker] Received NOTIFY: ${msg.payload}`);
        await processRefresh();
      }
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[analytics-refresh-worker] SIGTERM received, closing PostgreSQL connection...');
      await client.end();
    });
    
    process.on('SIGINT', async () => {
      console.log('[analytics-refresh-worker] SIGINT received, closing PostgreSQL connection...');
      await client.end();
    });
    
    console.log('[analytics-refresh-worker] LISTEN/NOTIFY enabled for analytics_refresh_needed');
  } catch (error) {
    console.log('[analytics-refresh-worker] Failed to setup LISTEN/NOTIFY, using polling only:', error);
  }
}

/**
 * Main worker loop
 */
async function main() {
  console.log('[analytics-refresh-worker] ========================================');
  console.log('[analytics-refresh-worker] Starting analytics refresh worker...');
  console.log('[analytics-refresh-worker] Refresh interval: 15 minutes');
  console.log('[analytics-refresh-worker] ========================================');
  
  // Try to setup LISTEN/NOTIFY (optional)
  await setupListenNotify();
  
  // Process refresh immediately on startup
  await processRefresh();
  
  // Then process every 15 minutes
  refreshInterval = setInterval(async () => {
    if (!isShuttingDown) {
      await processRefresh();
    }
  }, REFRESH_INTERVAL_MS);
  
  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`[analytics-refresh-worker] ${signal} received, shutting down gracefully...`);
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    
    // Process one final refresh before shutdown
    console.log('[analytics-refresh-worker] Processing final refresh before shutdown...');
    await processRefresh();
    
    console.log('[analytics-refresh-worker] Worker stopped');
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  console.log('[analytics-refresh-worker] Worker running. Press Ctrl+C to stop.');
}

// Run worker
if (require.main === module) {
  main().catch((error) => {
    console.error('[analytics-refresh-worker] Fatal error:', error);
    process.exit(1);
  });
}

export { processRefresh };
