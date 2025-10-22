import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { readFileSync } from 'fs';

// Extend global interface for rate limiting
declare global {
  var rateLimitStore: Map<string, { count: number; resetTime: number }> | undefined;
}

const app = express();
const PORT = process.env.PORT || 8787;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
  res.json({
    ok: true,
    ts: Date.now(),
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'autoagent-mcp-server',
    version: '1.0.0',
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

// Deep logging middleware for /mcp endpoint
app.use((req, res, next) => {
  // only for mcp & health
  if (req.path !== '/mcp') return next();
  const t0 = Date.now();
  const chunks: any[] = [];
  const origJson = res.json.bind(res);

  // Log request first
  const reqInfo = {
    ts: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    headers: req.headers,
    // body logged below after body-parser; if raw needed, add raw capture
  };
  (res as any).__reqInfo = reqInfo;

  // Intercept json responses to log body + headers + timing
  res.json = (body: any) => {
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
        reqHeaders: (res as any).__reqInfo?.headers,
        resHeaders: res.getHeaders()
      }));
    }
  });

  next();
});

// MCP endpoint - handles MCP protocol requests and health checks
app.all('/mcp', async (req, res) => {
  // Log headers for debugging
  console.log(JSON.stringify({ evt: 'mcp.headers', headers: req.headers }));
  
  // Handle HEAD requests for health checks
  if (req.method === 'HEAD') {
    console.log('🔍 MCP HEAD request received');
    res.status(200).end();
    return;
  }
  
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔍 MCP OPTIONS request received');
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
    console.log(`🔍 [${requestId}] MCP Request received:`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      body: req.body,
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    });

    // Set CORS headers for ChatGPT integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');


    // Safety and authentication checks
    const userAgent = req.headers['user-agent'] || '';
    const isOpenAI = userAgent.includes('openai-mcp') || userAgent.includes('ChatGPT');
    
    if (!isOpenAI && !userAgent.includes('curl') && !userAgent.includes('test')) {
      console.log(`⚠️ [${requestId}] Unauthorized request from: ${userAgent}`);
      return res.status(401).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: 'Unauthorized',
          data: 'Only OpenAI MCP clients are allowed',
        },
      });
    }

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
    const { handleMcpRequest } = await import('./mcp-handler.js');
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
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
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
