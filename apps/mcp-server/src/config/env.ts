/**
 * Centralized environment variable configuration with validation
 * 
 * This module enforces required environment variables and provides
 * defaults for optional ones. All environment variable access should
 * go through this module to ensure consistency across dev/staging/production.
 */

/**
 * Require an environment variable, throwing an error if missing
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Required environment variable ${name} is missing.\n` +
      `   Set it in your .env file or environment.\n` +
      `   See env.example for required variables.`
    );
  }
  return value.trim();
}

/**
 * Get an optional environment variable with a default value
 */
function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name]?.trim() || defaultValue;
}

/**
 * Get an optional boolean environment variable
 */
function optionalBoolEnv(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value === '1' || value.toLowerCase() === 'true';
}

/**
 * Get an optional integer environment variable with default value.
 */
function optionalIntEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Get commit SHA from various environment sources (Railway, CI/CD, etc.)
 */
function getCommitSha(): string {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    'unknown'
  );
}

/**
 * Validate that WIDGET_HOST is a valid URL
 * Automatically prefixes "https://" if scheme is missing for convenience
 */
function validateWidgetHost(host: string): string {
  let normalized = host.trim();
  
  // If no scheme is present, assume https://
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
    console.log(`📝 WIDGET_HOST missing scheme, normalized to: ${normalized}`);
  }
  
  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('WIDGET_HOST must use http:// or https://');
    }
    // Remove trailing slash and return normalized value
    const final = normalized.replace(/\/$/, '');
    if (final !== host.trim()) {
      console.log(`✅ WIDGET_HOST normalized from "${host}" to "${final}"`);
    }
    return final;
  } catch (error) {
    throw new Error(
      `❌ WIDGET_HOST must be a valid URL (e.g., https://autoagentmcp-server-production.up.railway.app)\n` +
      `   Received: ${host}\n` +
      `   Normalized: ${normalized}\n` +
      `   Error: ${error instanceof Error ? error.message : 'Invalid URL'}`
    );
  }
}

/**
 * Validate that LEAD_ENC_KEY is valid base64 and 32 bytes
 */
function validateLeadEncKey(key: string): string {
  try {
    const decoded = Buffer.from(key, 'base64');
    if (decoded.length !== 32) {
      throw new Error('LEAD_ENC_KEY must be exactly 32 bytes when base64 decoded');
    }
    return key;
  } catch (error) {
    throw new Error(
      `❌ LEAD_ENC_KEY must be valid base64 encoding of a 32-byte key\n` +
      `   Error: ${error instanceof Error ? error.message : 'Invalid base64'}\n` +
      `   Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
}

/**
 * Validate that DASHBOARD_INGEST_URL is a valid URL
 */
function validateDashboardIngestUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('DASHBOARD_INGEST_URL must use http:// or https://');
    }
    return url;
  } catch (error) {
    throw new Error(
      `❌ DASHBOARD_INGEST_URL must be a valid URL\n` +
      `   Received: ${url}\n` +
      `   Error: ${error instanceof Error ? error.message : 'Invalid URL'}`
    );
  }
}

/**
 * Centralized configuration object
 * 
 * All required variables are validated at module load time.
 * Missing required variables will cause the server to fail fast with a clear error.
 */
export const CONFIG = {
  // Server configuration
  port: parseInt(optionalEnv('PORT', '8787'), 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Required: Widget host (for generating widget URLs)
  widgetHost: validateWidgetHost(requireEnv('WIDGET_HOST')),
  
  // Required: MarketCheck API
  marketcheckApiKey: requireEnv('MARKETCHECK_API_KEY'),
  marketcheckBaseUrl: optionalEnv(
    'MARKETCHECK_BASE_URL',
    'https://marketcheck-prod.apigee.net'
  ),
  marketcheckMcpBridgeEnabled: optionalBoolEnv('MARKETCHECK_MCP_BRIDGE_ENABLED', false),
  inventorySearchProvider: optionalEnv(
    'INVENTORY_SEARCH_PROVIDER',
    'marketcheck_mcp'
  ) as 'marketcheck_mcp' | 'uvs',
  marketcheckMcpUrl: optionalEnv('MARKETCHECK_MCP_URL', 'https://api.marketcheck.com/mcp'),
  marketcheckMcpAuthType: optionalEnv('MARKETCHECK_MCP_AUTH_TYPE', 'bearer') as 'none' | 'bearer' | 'x-api-key',
  marketcheckMcpAuthToken: optionalEnv('MARKETCHECK_MCP_AUTH_TOKEN', ''),
  marketcheckMcpTimeoutMs: optionalIntEnv('MARKETCHECK_MCP_TIMEOUT_MS', 10000),
  
  // Required: Lead encryption key (32 bytes, base64 encoded)
  leadEncKey: validateLeadEncKey(requireEnv('LEAD_ENC_KEY')),
  
  // Required: Dashboard ingest configuration
  dashboardIngestUrl: validateDashboardIngestUrl(requireEnv('DASHBOARD_INGEST_URL')),
  dashboardIngestToken: requireEnv('DASHBOARD_INGEST_TOKEN'),
  
  // Optional: OpenAI App configuration
  openaiAppName: optionalEnv('OPENAI_APP_NAME', 'AutoAgent'),
  
  // Optional: Diagnostics flag
  diagnosticsEnabled: optionalBoolEnv('AA_DIAG', false),
  
  // Optional: Supabase configuration (for delivery logs)
  supabaseUrl: optionalEnv('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
  supabaseServiceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
  supabaseAnonKey: optionalEnv(
    'SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ),
  
  // Optional: Commit SHA (for health checks)
  commitSha: getCommitSha(),
} as const;

/**
 * Validate all required configuration at startup
 * This function is called immediately when the module loads
 */
function validateConfig(): void {
  // All required vars are validated via requireEnv() calls above
  // Additional cross-field validation can go here if needed
  
  if (!['none', 'bearer', 'x-api-key'].includes(CONFIG.marketcheckMcpAuthType)) {
    throw new Error(
      `❌ MARKETCHECK_MCP_AUTH_TYPE must be one of: none, bearer, x-api-key\n` +
        `   Received: ${CONFIG.marketcheckMcpAuthType}`
    );
  }

  if (!['marketcheck_mcp', 'uvs'].includes(CONFIG.inventorySearchProvider)) {
    throw new Error(
      `❌ INVENTORY_SEARCH_PROVIDER must be one of: marketcheck_mcp, uvs\n` +
        `   Received: ${CONFIG.inventorySearchProvider}`
    );
  }

  if (CONFIG.marketcheckMcpBridgeEnabled || CONFIG.inventorySearchProvider === 'marketcheck_mcp') {
    if (!CONFIG.marketcheckMcpUrl) {
      throw new Error(
        '❌ MARKETCHECK_MCP_URL is required when MARKETCHECK_MCP_BRIDGE_ENABLED=true'
      );
    }

    try {
      const bridgeUrl = new URL(CONFIG.marketcheckMcpUrl);
      if (!['http:', 'https:'].includes(bridgeUrl.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch (_error) {
      throw new Error(
        `❌ MARKETCHECK_MCP_URL must be a valid HTTP/HTTPS URL\n` +
          `   Received: ${CONFIG.marketcheckMcpUrl}`
      );
    }

    const usesOfficialApiKey =
      ['api.marketcheck.com', 'developers.marketcheck.com'].includes(
        new URL(CONFIG.marketcheckMcpUrl).hostname,
      ) &&
      Boolean(CONFIG.marketcheckApiKey);
    if (
      CONFIG.marketcheckMcpAuthType !== 'none' &&
      !CONFIG.marketcheckMcpAuthToken &&
      !usesOfficialApiKey
    ) {
      throw new Error(
        '❌ MARKETCHECK_MCP_AUTH_TOKEN is required when bridge mode is enabled and auth type is not none'
      );
    }
  }

  // Log configuration status (without sensitive values)
  if (!CONFIG.isProduction) {
    console.log('📋 Configuration loaded:');
    console.log(`   Port: ${CONFIG.port}`);
    console.log(`   Widget Host: ${CONFIG.widgetHost}`);
    console.log(`   MarketCheck Base URL: ${CONFIG.marketcheckBaseUrl}`);
    console.log(`   MarketCheck API Key: ${CONFIG.marketcheckApiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(
      `   MarketCheck MCP Bridge: ${
        CONFIG.inventorySearchProvider === 'marketcheck_mcp'
          ? `Primary (${new URL(CONFIG.marketcheckMcpUrl).origin})`
          : 'UVS primary'
      }`
    );
    console.log(`   Dashboard Ingest URL: ${CONFIG.dashboardIngestUrl}`);
    console.log(`   Dashboard Ingest Token: ${CONFIG.dashboardIngestToken ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Lead Encryption Key: ${CONFIG.leadEncKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Diagnostics: ${CONFIG.diagnosticsEnabled ? 'Enabled' : 'Disabled'}`);
  }
}

// Validate configuration on module load
validateConfig();

