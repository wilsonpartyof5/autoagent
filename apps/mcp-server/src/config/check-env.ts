#!/usr/bin/env node
/**
 * Environment variable validation script
 * 
 * Run this script to verify all required environment variables are set:
 *   node dist/config/check-env.js
 * 
 * Or via pnpm:
 *   pnpm --filter @autoagent/mcp-server test:env
 */

// Load environment variables
import 'dotenv/config';

// Import config (this will throw if required vars are missing)
try {
  // Dynamic import to catch errors
  await import('./env');
  console.log('✅ All required environment variables are set');
  process.exit(0);
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

