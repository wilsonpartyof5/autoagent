import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { readFileSync } from 'fs';
import { CONFIG } from './config/env';
import { createIngestionRouter } from './api/ingest';
import widgetTrackingRouter from './app/widget-tracking';

// Extend global interface for rate limiting
declare global {
  // eslint-disable-next-line no-var
  var rateLimitStore: Map<string, { count: number; resetTime: number }> | undefined;
}

// Top-level crash handlers - MUST be set before any async operations
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;
  console.error('UNHANDLED_REJECTION', {
    error: errorMessage,
    stack: errorStack,
    promise: promise?.toString?.() || 'unknown',
  });
});

process.on('uncaughtException', (error: Error) => {
  console.error('UNCAUGHT_EXCEPTION', {
    error: error.message,
    stack: error.stack,
    name: error.name,
  });
  // Let the process die for uncaught exceptions (they indicate serious bugs)
  process.exit(1);
});

const app = express();
const PORT = CONFIG.port;

// CORS configuration for OpenAI MCP
const ALLOWED_ORIGINS = new Set(['https://chat.openai.com', 'https://chatgpt.com']);

/**
 * Apply CORS headers for MCP endpoint according to OpenAI requirements
 * Must be called before any response is sent
 */
function applyMcpCors(req: express.Request, res: express.Response) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, OpenAI-Beta');
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Normalize paths to prevent double slashes
app.use((req, res, next) => {
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
});

// Add iframe-safe headers (CSP) for ChatGPT embedding
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src * data: blob:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // IMPORTANT: allow ChatGPT to embed our widget
      "frame-ancestors https://chat.openai.com https://chatgpt.com"
    ].join('; ')
  );
  // Make sure we DO NOT send X-Frame-Options: DENY/SAMEORIGIN
  res.removeHeader('X-Frame-Options');
  next();
});

// Add structured logging for monitoring
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - t0;
    
    if (req.url === '/mcp' && req.method === 'POST') {
      console.log(JSON.stringify({
        evt: 'mcp.request',
        method: req.method,
        status: res.statusCode,
        ms: duration,
        userAgent: req.headers['user-agent']?.substring(0, 50)
      }));
    } else if (req.url.startsWith('/widget/')) {
      console.log(JSON.stringify({
        evt: 'widget.request',
        path: req.url,
        method: req.method,
        status: res.statusCode,
        ms: duration
      }));
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  // Get commit SHA from configuration
  const commitSha = CONFIG.commitSha;
  res.json({
    ok: true,
    ts: Date.now(),
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'autoagent-mcp-server',
    version: '1.0.0',
    commit: commitSha.substring(0, 7), // Short SHA
    commitFull: commitSha,
  });
});

// Root endpoint for basic connectivity
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint requested');
  res.json({
    service: 'AutoAgent MCP Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      ping: '/ping',
      mcp: '/mcp',
      widget: '/widget/vehicle-results',
    },
    tools: ['search-vehicles', 'submit-lead'],
    resources: ['ui://vehicle-results.html'],
  });
});

// Ping endpoint for OpenAI monitoring
app.get('/ping', (req, res) => {
  console.log('🏓 Ping requested');
  res.json({
    pong: 'pong',
    timestamp: new Date().toISOString(),
    server: 'autoagent-mcp-server',
    version: '1.0.0',
  });
});

// Serve OpenAI manifest
app.get('/.well-known/ai-plugin.json', (req, res) => {
  console.log('📋 OpenAI manifest requested');
  const manifestPath = join(process.cwd(), 'src', '.well-known', 'ai-plugin.json');
  try {
    const manifest = readFileSync(manifestPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(manifest);
  } catch (error) {
    console.error('❌ Error serving manifest:', error);
    res.status(404).json({ error: 'Manifest not found' });
  }
});

// Serve OpenAPI specification
app.get('/.well-known/openapi.yaml', (req, res) => {
  console.log('📚 OpenAPI spec requested');
  const specPath = join(process.cwd(), 'src', '.well-known', 'openapi.yaml');
  try {
    const spec = readFileSync(specPath, 'utf8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(spec);
  } catch (error) {
    console.error('❌ Error serving OpenAPI spec:', error);
    res.status(404).json({ error: 'OpenAPI spec not found' });
  }
});

// UVS Ingestion API
app.use('/api/ingest', createIngestionRouter());

// Deep logging middleware for /mcp endpoint
app.use((req, res, next) => {
  // only for mcp & health
  if (req.path !== '/mcp') return next();
  const t0 = Date.now();
  const origJson = res.json.bind(res);

  // Log request first (guard against dumping large headers/socket objects)
  const reqInfo = {
    ts: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    // Only log essential headers, not full headers object (prevents socket dumps)
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    // body logged below after body-parser; if raw needed, add raw capture
  };
  (res as { __reqInfo?: typeof reqInfo }).__reqInfo = reqInfo;

  // Intercept json responses to log body + headers + timing
  res.json = (body: unknown) => {
    const ms = Date.now() - t0;
    const log = {
      evt: 'mcp.response',
      status: res.statusCode,
      ms,
      headers: res.getHeaders(),
      body
    };
    console.log(JSON.stringify({ evt: 'mcp.request', ...reqInfo }));
    console.log(JSON.stringify(log));
    return origJson(body);
  };

  // Also log HEAD/empty responses
  res.on('finish', () => {
    if (req.method === 'HEAD') {
      const ms = Date.now() - t0;
      console.log(JSON.stringify({
        evt: 'mcp.head',
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms,
        reqInfo: (res as { __reqInfo?: typeof reqInfo }).__reqInfo,
        resHeaders: res.getHeaders()
      }));
    }
  });

  next();
});

// MCP endpoint - handles MCP protocol requests and health checks
app.all('/mcp', async (req, res) => {
  // Apply CORS headers first, before any early returns
  applyMcpCors(req, res);
  
  // Log essential headers only (not full headers object to avoid socket dumps)
  console.log(JSON.stringify({ 
    evt: 'mcp.headers', 
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    origin: req.headers.origin,
  }));
  
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔍 MCP OPTIONS request received');
    res.status(204).end();
    return;
  }
  
  // Handle HEAD requests for health checks
  if (req.method === 'HEAD') {
    console.log('🔍 MCP HEAD request received');
    res.status(200).end();
    return;
  }
  
  // Handle POST requests for MCP protocol
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  // Log request body for debugging
  console.log(JSON.stringify({
    evt: 'mcp.body',
    body: req.body
  }));
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  try {
    // Guard against logging full request objects (prevents socket dumps)
    console.log(`🔍 [${requestId}] MCP Request received:`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      body: req.body, // Body is safe (parsed JSON)
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      timestamp: new Date().toISOString()
    });


    // Log user-agent for diagnostics but do not restrict access
    const userAgent = req.headers['user-agent'] || '';
    console.log(JSON.stringify({ evt: 'mcp.userAgent', userAgent }));

    // Rate limiting check
    const clientIP = req.ip || req.connection.remoteAddress;
    const rateLimitKey = `rate_limit_${clientIP}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // Max 100 requests per minute

    // Simple in-memory rate limiting (in production, use Redis)
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }

    const clientData = global.rateLimitStore.get(rateLimitKey) || { count: 0, resetTime: now + windowMs };
    
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }

    if (clientData.count >= maxRequests) {
      console.log(`🚫 [${requestId}] Rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32002,
          message: 'Rate limit exceeded',
          data: 'Too many requests',
        },
      });
    }

    clientData.count++;
    global.rateLimitStore.set(rateLimitKey, clientData);

    // Import and handle MCP server logic
    const { handleMcpRequest } = await import('./mcp-handler');
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
    };
    
    console.log(`🔧 [${requestId}] Processing MCP request:`, req.body?.method || 'unknown');
    const result = await handleMcpRequest(req.body, context);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [${requestId}] MCP Response (${duration}ms):`, result);
    
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] MCP request error (${duration}ms):`, error);
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('401')) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="autoagent-mcp"');
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate to access this resource',
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

// Serve the ping widget
app.get('/widget/ping', (req, res) => {
  try {
    const htmlPath = join(process.cwd(), 'src', 'ui', 'ping.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving ping widget:', error);
    res.status(500).send('Error loading ping widget');
  }
});

// Serve micro widget for minimal testing
app.get('/widget/micro', (req, res) => {
  const t0 = Date.now();
  const rid = req.query.rid || 'none';
  const diag = req.query.diag === '1';
  
  res.setHeader('x-aa-run-id', String(rid));
  res.setHeader('x-aa-diag', diag ? '1' : '0');
  
  res.on('finish', () => {
    const ms = Date.now() - t0;
    console.log(JSON.stringify({
      evt: 'diag.widget',
      path: '/widget/micro',
      rid,
      diag,
      ms,
      status: res.statusCode,
      contentLength: res.get('content-length') || 'unknown'
    }));
  });
  
  try {
    const htmlPath = join(process.cwd(), 'src', 'ui', 'micro.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving micro widget:', error);
    res.status(500).send('Error loading micro widget');
  }
});

// Widget tracking endpoint
app.use('/', widgetTrackingRouter);

// Serve the vehicle results widget
app.get('/widget/vehicle-results', (req, res) => {
  const t0 = Date.now();
  const rid = req.query.rid || 'none';
  const diag = req.query.diag === '1';
  
  res.setHeader('x-aa-run-id', String(rid));
  res.setHeader('x-aa-diag', diag ? '1' : '0');
  
  res.on('finish', () => {
    const ms = Date.now() - t0;
    console.log(JSON.stringify({
      evt: 'diag.widget',
      path: '/widget/vehicle-results',
      rid,
      diag,
      ms,
      status: res.statusCode,
      contentLength: res.get('content-length') || 'unknown'
    }));
  });
  
  try {
    const htmlPath = join(process.cwd(), 'src', 'ui', 'vehicle-results.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving widget:', error);
    res.status(500).send('Error loading widget');
  }
});

// Widget beacon endpoint for readiness tracking
app.get('/widget/beacon', (req, res) => {
  res.json({ 
    ok: true, 
    message: "Widget beacon endpoint ready. Use POST for ui:ready events.",
    usage: "POST /widget/beacon with {rid, tag, payload} for widget readiness tracking"
  });
});

app.post('/widget/beacon', express.json(), (req, res) => {
  const b = req.body || {};
  console.log(JSON.stringify({evt:'diag.beacon', runId:b.rid, tag:b.tag, payload:b, ts:Date.now()}));
  res.json({ ok: true });
});

// Widget console logging endpoint
app.post('/widget/console', express.json(), (req, res) => {
  const rid = req.query.rid || null;
  console.log(JSON.stringify({evt:'diag.console', runId:rid, lines:req.body, ts:Date.now()}));
  res.json({ ok: true });
});

// Root endpoint with basic info
app.get('/', (req, res) => {
  res.json({
    service: 'AutoAgent MCP Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mcp: '/mcp',
      widget: '/widget/vehicle-results',
    },
    tools: ['search-vehicles', 'submit-lead'],
    resources: ['ui://vehicle-results.html'],
  });
});


// Error handling middleware
app.use(async (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Ensure we have a proper Error object
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Log full stack trace (critical for debugging)
  console.error('INGEST_ERROR', {
    error: err.message,
    stack: err.stack,
    name: err.name,
    path: req.path,
    method: req.method,
    url: req.url,
  });
  
  // Track system error (non-blocking)
  try {
    const { trackSystemError } = await import('./lib/analytics/tracking');
    trackSystemError(
      'unhandled_error',
      err.message,
      'mcp-server',
      {
        requestId: (req as { id?: string }).id,
      }
    ).catch(() => {
      // Ignore tracking errors
    });
  } catch (trackError) {
    // Ignore tracking import/execution errors
  }
  
  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    // Include stack in development (not production for security)
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🚗 AutoAgent MCP Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🎨 Widget: http://localhost:${PORT}/widget/vehicle-results`);
});

// Set longer timeout for MCP requests (5 minutes)
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000; // 5 minutes
server.headersTimeout = 300000; // 5 minutes

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
