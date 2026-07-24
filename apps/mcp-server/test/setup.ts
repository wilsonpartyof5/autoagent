/**
 * Test setup file for Vitest
 */

// Mock required environment variables for CI and local test runs
process.env.WIDGET_HOST = 'https://example.com';
process.env.MARKETCHECK_API_KEY = 'test-api-key';
process.env.MARKETCHECK_BASE_URL = 'https://test-api.example.com';
process.env.LEAD_ENC_KEY = Buffer.alloc(32).toString('base64');
process.env.DASHBOARD_INGEST_URL = 'https://dashboard.example.com/api/ingest/lead';
process.env.DASHBOARD_INGEST_TOKEN = 'test-token';
process.env.PORT = '8787';
