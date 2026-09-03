# Deployment & Infrastructure

**Last Updated**: 2025-11-12  
**Status**: ✅ Active Documentation

This document consolidates all deployment guides, infrastructure setup, and production configuration documentation.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Deployment Strategy](#deployment-strategy)
3. [Railway Deployment (MCP Server)](#railway-deployment-mcp-server)
4. [Vercel Deployment (Dashboard)](#vercel-deployment-dashboard)
5. [Environment Variables](#environment-variables)
6. [Domain Configuration](#domain-configuration)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)
9. [Deployment Checklist](#deployment-checklist)

---

## Project Overview

AutoAgent is a monorepo containing:
1. **Next.js 15 Dashboard** (`apps/dealer-dashboard`) - Dealer SaaS dashboard with Supabase auth
2. **Node.js MCP Server** (`apps/mcp-server`) - Express server for ChatGPT integration

### Technical Stack

- **Package Manager**: pnpm 8.15.0 (monorepo with Turborepo)
- **Runtime**: Node.js 20+
- **Frontend**: Next.js 15, React 18, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL) for dashboard, SQLite for MCP server
- **Build Tools**: Turborepo, TypeScript
- **Containerization**: Docker, Docker Compose (configured)

### What to Deploy

**Both applications:**
- Next.js dashboard (dealer portal)
- MCP server (ChatGPT integration API)

---

## Deployment Strategy

### Recommended Hosting Platform

**Option 1 (Recommended)**: Vercel (dashboard) + Railway (MCP server)
- Vercel: Best for Next.js, automatic HTTPS, edge functions
- Railway: Good for Node.js APIs, automatic HTTPS, persistent volumes

**Option 2**: Railway for both (monorepo deployment)
- Both apps as separate Railway services
- Automatic HTTPS and domain

**Option 3**: Docker Compose on VPS (DigitalOcean, AWS EC2, etc.)
- Full control but requires manual SSL setup

### Platform Selection Rationale

#### **Vercel** (Frontend)
- ✅ Zero-config Next.js deployment: Automatic optimizations and edge runtime
- ✅ Automatic SSL: Free SSL certificates via Let's Encrypt
- ✅ Edge Network: Global CDN for fast response times
- ✅ Preview Deployments: Automatic preview URLs for pull requests
- ✅ Serverless Functions: API routes run as serverless functions

#### **Railway** (Backend)
- ✅ Docker Support: Native Dockerfile support for containerized deployments
- ✅ Automatic SSL: Free SSL certificates
- ✅ Environment Variables: Secure variable management
- ✅ Health Checks: Built-in health check monitoring
- ✅ Auto-scaling: Automatic scaling based on traffic

### Configuration Files Present

- `railway.json` - Railway deployment config
- `Dockerfile` - Docker container config
- `docker-compose.yml` - Multi-container setup
- `nginx.conf` - Reverse proxy with SSL
- `turbo.json` - Turborepo config
- `apps/dealer-dashboard/railway.json` - Dashboard Railway config
- `apps/dealer-dashboard/vercel.json` - Vercel configuration

### Build Commands

```bash
# Dashboard
pnpm --filter @autoagent/dealer-dashboard build

# MCP Server
pnpm --filter @autoagent/mcp-server build

# Both
pnpm build
```

### Start Commands

```bash
# Dashboard
pnpm --filter @autoagent/dealer-dashboard start

# MCP Server
pnpm --filter @autoagent/mcp-server start
```

---

## Railway Deployment (MCP Server)

### Prerequisites

#### Required Accounts
- ✅ **Railway Account**: Sign up at [railway.app](https://railway.app)
- ✅ **GitHub Account**: Repository must be on GitHub
- ✅ **MarketCheck API Key**: Production API key for vehicle inventory
- ✅ **Supabase Project**: Production Supabase project with credentials

#### Required Information
- ✅ **MarketCheck API Key**: Production API key
- ✅ **Supabase URL**: Production Supabase project URL
- ✅ **Supabase Service Role Key**: Production service role key
- ✅ **Lead Encryption Key**: 32-byte base64 encryption key
- ✅ **Dashboard Ingest URL**: Dashboard endpoint for lead forwarding
- ✅ **Dashboard Ingest Token**: Secure token for lead forwarding

#### Repository Status
- ✅ **Code Pushed to GitHub**: Repository must be on GitHub
- ✅ **railway.json**: Configuration file exists in repo root
- ✅ **Dockerfile**: Dockerfile exists in repo root
- ✅ **pnpm-lock.yaml**: Lockfile is up to date

### Pre-Deployment Review

#### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile"
  },
  "deploy": {}
}
```

**What this means**:
- Railway will use the `Dockerfile` in the repo root
- Railway will automatically detect this configuration
- No additional build commands needed

#### Dockerfile
```dockerfile
FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @autoagent/shared build
RUN pnpm --filter @autoagent/mcp-server build
EXPOSE 8787
CMD ["pnpm", "--filter", "@autoagent/mcp-server", "start"]
```

**What this means**:
- Builds using Node.js 20 on Debian Bullseye
- Installs system dependencies (python3, build-essential)
- Installs pnpm dependencies with frozen lockfile
- Builds shared package and mcp-server
- Exposes port 8787
- Starts the MCP server

#### Port Configuration
- **Port**: `8787` (as specified in `apps/mcp-server/src/index.ts`)
- **Environment Variable**: `PORT=8787` (can be overridden in Railway)

### Railway Deployment Steps

#### Step 1: Connect Repository to Railway

**Option A: New Railway Project (First Time)**

1. **Go to Railway Dashboard**
   - Navigate to [railway.app](https://railway.app)
   - Sign in with your GitHub account

2. **Create New Project**
   - Click "New Project" button
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub repositories (if prompted)

3. **Select Repository**
   - Find and select your repository
   - Click "Deploy Now"

4. **Railway Auto-Detection**
   - Railway will automatically detect `railway.json`
   - Railway will detect `Dockerfile`
   - Railway will start building automatically

**Option B: Existing Railway Project**

If you already have a Railway project:

1. **Go to Railway Dashboard**
   - Navigate to [railway.app](https://railway.app)
   - Select your existing project

2. **Add Service**
   - Click "New" → "Service"
   - Select "GitHub Repo"
   - Select your repository
   - Railway will auto-detect the configuration

3. **Verify Service Configuration**
   - Railway should detect `railway.json` and `Dockerfile`
   - Service should be configured to use Dockerfile builder
   - Port should be set to `8787`

#### Step 2: Verify Build Configuration

1. **Check Service Settings**
   - Go to your service in Railway dashboard
   - Click "Settings" tab
   - Verify:
     - **Builder**: `DOCKERFILE`
     - **Dockerfile Path**: `./Dockerfile`
     - **Port**: `8787`

2. **Check Build Logs**
   - Go to "Deployments" tab
   - Click on the latest deployment
   - Verify build is successful
   - Check for any build errors

#### Step 3: Monitor Initial Build

1. **Watch Build Progress**
   - Railway will automatically start building on first connect
   - Build process:
     - Pulls Docker image (node:20-bullseye)
     - Installs system dependencies
     - Copies repository files
     - Runs `pnpm install --frozen-lockfile`
     - Builds shared package
     - Builds mcp-server
     - Starts the server

2. **Check Build Logs**
   - Look for successful build messages
   - Verify no errors in build logs
   - Check that port 8787 is exposed

3. **Verify Deployment**
   - Railway will automatically deploy after successful build
   - Service should be running
   - Railway will provide a public URL

#### Step 4: Get Railway Domain

1. **Find Railway Domain**
   - Go to service "Settings" tab
   - Scroll to "Domains" section
   - Railway provides a default domain: `https://your-service-name.railway.app`
   - Copy this domain (you'll need it for `WIDGET_HOST`)

2. **Custom Domain (Optional)**
   - If you have a custom domain, add it in Railway dashboard
   - Railway will automatically provision SSL certificate
   - Update DNS records as needed

### Environment Variables Configuration

#### Required Environment Variables

**⚠️ IMPORTANT**: The MCP server now enforces required environment variables at startup. Missing required variables will cause the server to fail immediately with a clear error message.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WIDGET_HOST` | ✅ **REQUIRED** | Publicly reachable MCP host URL (no trailing slash) | `https://autoagentmcp-server-production.up.railway.app` |
| `MARKETCHECK_API_KEY` | ✅ **REQUIRED** | MarketCheck API key | `your-api-key` |
| `LEAD_ENC_KEY` | ✅ **REQUIRED** | 32-byte base64 encryption key | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `DASHBOARD_INGEST_URL` | ✅ **REQUIRED** | Dashboard endpoint for leads | `https://dashboard.com/api/ingest/lead` |
| `DASHBOARD_INGEST_TOKEN` | ✅ **REQUIRED** | Secure token for lead forwarding | `your-token` |

#### Optional Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | ⚠️ Optional | Server port (defaults to `8787`) | `8787` |
| `MARKETCHECK_BASE_URL` | ⚠️ Optional | MarketCheck API base URL (defaults to `https://marketcheck-prod.apigee.net`) | `https://marketcheck-prod.apigee.net` |
| `AA_DIAG` | ⚠️ Optional | Enable diagnostics (set to `1` or `true`) | `1` |
| `OPENAI_APP_NAME` | ⚠️ Optional | OpenAI App name (defaults to `Drevvy`) | `Drevvy` |
| `SUPABASE_URL` | ⚠️ Optional | Supabase project URL (only needed for delivery logs) | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Optional | Supabase service role key (only needed for delivery logs) | `your-service-role-key` |
| `SUPABASE_ANON_KEY` | ⚠️ Optional | Supabase anon key (fallback, only needed for delivery logs) | `your-anon-key` |

#### Adding Environment Variables in Railway

1. **Go to Service Settings**
   - Navigate to your service in Railway dashboard
   - Click "Variables" tab
   - Click "New Variable" button

2. **Add Required Variables**

Add the following environment variables one by one:

**Server Configuration**
```bash
PORT=8787
```

**MarketCheck API Configuration**
```bash
MARKETCHECK_API_KEY=your_production_marketcheck_api_key
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
```

**Supabase Configuration**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Lead Security & Forwarding**
```bash
LEAD_ENC_KEY=your_32_byte_base64_encryption_key
DASHBOARD_INGEST_URL=https://your-dashboard-domain.com/api/ingest/lead
DASHBOARD_INGEST_TOKEN=your_secure_dashboard_token
```

**Widget Configuration**
```bash
WIDGET_HOST=https://your-railway-domain.railway.app
```

**Important**: Replace `your-railway-domain.railway.app` with your actual Railway domain from Step 4.

**Diagnostics (Optional)**
```bash
AA_DIAG=1
```

**OpenAI App Configuration (Optional)**
```bash
OPENAI_APP_NAME=Drevvy
```

#### Generate Lead Encryption Key

If you don't have a `LEAD_ENC_KEY`, generate one:

```bash
# Generate 32-byte base64 encryption key
openssl rand -base64 32
```

**Example output**:
```
aBcD1234eFgH5678iJkL9012mNoPqRsTuVwXyZ
```

Copy this value and set it as `LEAD_ENC_KEY` in Railway.

#### Update WIDGET_HOST (After Getting Railway Domain)

1. **Get Railway Domain**
   - Go to service "Settings" → "Domains"
   - Copy your Railway domain (e.g., `https://autoagent-mcp.railway.app`)

2. **Update WIDGET_HOST**
   - Go to "Variables" tab
   - Find `WIDGET_HOST` variable
   - Update value to your Railway domain: `https://your-railway-domain.railway.app`
   - Save changes

3. **Redeploy Service**
   - Railway will automatically restart the service
   - Or manually trigger redeploy from "Deployments" tab

---

## Vercel Deployment (Dashboard)

### Current Status

- ✅ **Project**: `autoagent-dealer-dashboard` (linked)
- ✅ **Marketing Landing**: Exists at `apps/dealer-dashboard/src/app/page.tsx`
- ⚠️ **Build**: May fail due to monorepo install configuration
- ⚠️ **Domains**: May show old placeholder

### Required Action: Configure via Vercel Dashboard

The build may fail because the install command needs to run from the repository root, but Vercel is running it from the app directory. This must be configured via the Dashboard.

### Step 1: Update Project Settings

**Go to**: Vercel Dashboard → Project Settings → General

**Update these exact settings**:

1. **Root Directory**: `apps/dealer-dashboard` ✅ (should already be set)
2. **Framework Preset**: Next.js ✅
3. **Build Command**: `pnpm build`
4. **Output Directory**: `.next`
5. **Install Command**: **LEAVE EMPTY** (this is key - Vercel will auto-detect pnpm from `packageManager` field)
6. **Node.js Version**: 22.x (or use project default)
7. **Package Manager**: pnpm (auto-detected)

**Why empty Install Command works**:
- Vercel reads `packageManager: "pnpm@8.15.0"` from root `package.json`
- Uses corepack to activate pnpm 8.15.0 automatically
- Runs `pnpm install` from repository root (respects monorepo)
- No manual version management needed

### Step 2: Verify Domain Configuration

**Go to**: Vercel Dashboard → Project Settings → Domains

**Verify**:
- ✅ `autoagentapp.com` is attached to this project (primary)
- ✅ `www.autoagentapp.com` is attached and redirects to `autoagentapp.com`

**If domains are missing**:
1. Click "Add Domain"
2. Add `autoagentapp.com` (set as primary)
3. Add `www.autoagentapp.com` (configure redirect to apex)

### Step 3: Configure Environment Variables

**Go to**: Vercel Dashboard → Project Settings → Environment Variables

**Add Required Variables**:

**Dashboard (Next.js)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
```

**Note:** The `NEXT_PUBLIC_` prefix is required for client-side access in Next.js.

### Step 4: Trigger Fresh Deployment

**Option A: Via Dashboard (Recommended)**
1. Go to: Vercel Dashboard → Deployments
2. Click "..." on latest deployment → "Redeploy"
3. **Uncheck** "Use existing Build Cache"
4. Click "Redeploy"

**Option B: Via CLI** (after Dashboard settings are updated)
```bash
cd /Users/mac/AutoAgent
vercel --prod --force
```

### Step 5: Verify Results

After deployment succeeds, verify:

```bash
# Vercel URL
curl -I https://autoagent-dealer-dashboard.vercel.app
# Should return 200

# Apex domain
curl -I https://autoagentapp.com
# Should return 200

# WWW domain
curl -I https://www.autoagentapp.com
# Should return 200 (or 307 redirect to apex)
```

**Browser test**: Visit `https://autoagentapp.com` and confirm you see:
- ✅ Marketing landing page (Header, Hero, Features, Benefits, CTA, Footer)
- ❌ NOT the old placeholder

### Step 6: Clear Edge Cache (if needed)

If domains still show old content:

1. Go to: Vercel Dashboard → Project Settings → Domains
2. For each domain, click "..." → "Clear Cache"
3. Wait 1-2 minutes
4. Test again

### Troubleshooting Vercel Deployment

#### Build Still Fails After Dashboard Update

1. **Double-check Root Directory**: Must be exactly `apps/dealer-dashboard`
2. **Verify Install Command is Empty**: Should be blank in Dashboard
3. **Check Node Version**: Should be 18+ (22.x recommended)
4. **Check packageManager field**: Root `package.json` must have `"packageManager": "pnpm@8.15.0"`

#### Domains Not Updating

1. **Verify Domain Assignment**: Ensure domains point to `autoagent-dealer-dashboard` project (not `dealer-dashboard`)
2. **Check DNS**: Verify DNS records are correct
3. **Clear Edge Cache**: Use domain settings → Clear Cache
4. **Wait for Propagation**: DNS changes can take up to 48 hours

---

## Environment Variables

### Dashboard (Next.js)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
```

**Note:** The `NEXT_PUBLIC_` prefix is required for client-side access in Next.js.

### MCP Server

```bash
PORT=8787
MARKETCHECK_API_KEY=<marketcheck_api_key>
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
LEAD_ENC_KEY=<32_byte_base64_key>
DASHBOARD_INGEST_URL=https://your-dashboard-domain.com/api/ingest/lead
DASHBOARD_INGEST_TOKEN=<secure_token>
WIDGET_HOST=https://your-mcp-server-domain.com
AA_DIAG=1
OPENAI_APP_NAME=Drevvy
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>
SUPABASE_ANON_KEY=<supabase_anon_key>
```

### Optional (for future Postgres migration)

```bash
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://your-redis-host:6379
LOG_LEVEL=info
```

---

## Domain Configuration

### Domain Setup Requirements

- Main domain for dashboard (e.g., `dashboard.autoagent.com` or `autoagentapp.com`)
- Subdomain for MCP server (e.g., `api.autoagent.com` or `mcp.autoagent.com`)
- Or single domain with path-based routing

### DNS Configuration

#### For Vercel (Dashboard)

1. **Add Domain in Vercel Dashboard**
   - Go to Project Settings → Domains
   - Add your domain (e.g., `autoagentapp.com`)
   - Vercel will provide DNS records to configure

2. **Configure DNS Records**
   - Add A record pointing to Vercel's IP addresses
   - Or add CNAME record pointing to Vercel's domain
   - Wait for DNS propagation (up to 48 hours)

#### For Railway (MCP Server)

1. **Add Custom Domain in Railway**
   - Go to Service Settings → Domains
   - Add your custom domain (e.g., `api.autoagentapp.com`)
   - Railway will provide DNS records to configure

2. **Configure DNS Records**
   - Add CNAME record pointing to Railway's domain
   - Wait for DNS propagation (up to 48 hours)

### SSL Certificates

- **Vercel**: Automatic SSL certificates via Let's Encrypt
- **Railway**: Automatic SSL certificates
- **Custom domain**: SSL certificates are automatically provisioned by both platforms

---

## Post-Deployment Verification

### Railway MCP Server Verification

#### Step 1: Health Check

```bash
curl https://your-railway-domain.railway.app/health
```

**Expected Response**:
```json
{"status":"ok"}
```

#### Step 2: MCP Endpoint Test

```bash
curl -X POST https://your-railway-domain.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**Expected Response**: Should include `search-vehicles` and `submit-lead` tools

#### Step 3: MCP Initialize Test

```bash
curl -X POST https://your-railway-domain.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "test",
        "version": "1.0.0"
      }
    }
  }'
```

**Expected Response**: Should include `initialized: true` and `notification` fields

#### Step 4: Widget Endpoint Test

```bash
curl -I https://your-railway-domain.railway.app/widget/vehicle-results
```

**Expected Response**: Should include CSP headers with `frame-ancestors https://chat.openai.com https://chatgpt.com`

#### Step 5: Run Handshake Test Script

```bash
bash scripts/testChatGPTHandshake.sh https://your-railway-domain.railway.app
```

**Expected Output**: All tests should pass

### Vercel Dashboard Verification

#### Step 1: Health Check

```bash
curl -I https://autoagentapp.com
```

**Expected Response**: HTTP 200

#### Step 2: Verify Landing Page

Visit `https://autoagentapp.com` in browser and confirm:
- ✅ Marketing landing page loads correctly
- ✅ All styles are applied
- ✅ Navigation works
- ✅ No console errors

#### Step 3: Verify Authentication

1. Navigate to `/auth`
2. Test sign-in flow
3. Verify redirect URLs are configured in Supabase

---

## Troubleshooting

### Railway Deployment Issues

#### Build Fails

1. **Check Build Logs**
   - Go to Railway Dashboard → Service → Deployments
   - Click on failed deployment
   - Review build logs for errors

2. **Common Issues**:
   - Missing environment variables
   - Dockerfile syntax errors
   - Dependency installation failures
   - Build command errors

3. **Solutions**:
   - Verify all required environment variables are set
   - Check Dockerfile syntax
   - Ensure `pnpm-lock.yaml` is up to date
   - Verify Node.js version compatibility

#### Service Won't Start

1. **Check Runtime Logs**
   - Go to Railway Dashboard → Service → Logs
   - Review runtime logs for errors

2. **Common Issues**:
   - Missing required environment variables
   - Port conflicts
   - Database connection errors
   - API key authentication failures

3. **Solutions**:
   - Verify all required environment variables are set
   - Check port configuration (should be 8787)
   - Verify database credentials
   - Check API key validity

### Vercel Deployment Issues

#### Build Fails

1. **Check Build Logs**
   - Go to Vercel Dashboard → Deployments
   - Click on failed deployment
   - Review build logs for errors

2. **Common Issues**:
   - Monorepo install configuration
   - Missing environment variables
   - Build command errors
   - TypeScript errors

3. **Solutions**:
   - Verify Install Command is empty (Vercel auto-detects pnpm)
   - Check Root Directory is `apps/dealer-dashboard`
   - Verify all required environment variables are set
   - Fix TypeScript errors locally before deploying

#### Domains Not Working

1. **Check DNS Configuration**
   - Verify DNS records are correct
   - Check DNS propagation status
   - Verify domain is added in Vercel dashboard

2. **Common Issues**:
   - DNS records not configured correctly
   - DNS propagation delay
   - Domain not added in Vercel dashboard
   - SSL certificate not provisioned

3. **Solutions**:
   - Re-check DNS records
   - Wait for DNS propagation (up to 48 hours)
   - Verify domain is added in Vercel dashboard
   - Clear edge cache if needed

---

## Deployment Checklist

### Pre-Deployment

- [ ] Confirm GitHub repository exists and is accessible
- [ ] Generate `LEAD_ENC_KEY` (32-byte base64): `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- [ ] Obtain production `MARKETCHECK_API_KEY`
- [ ] Confirm Supabase project credentials
- [ ] Set up production Supabase redirect URLs
- [ ] Run Supabase migrations (`apps/dealer-dashboard/supabase/migrations/`)
- [ ] Choose hosting platform (Vercel + Railway recommended)
- [ ] Confirm domain name and registrar

### Deployment Steps (Vercel + Railway)

- [ ] Deploy dashboard to Vercel
- [ ] Configure Vercel environment variables
- [ ] Deploy MCP server to Railway
- [ ] Configure Railway environment variables
- [ ] Set up custom domains
- [ ] Configure DNS records
- [ ] Update `DASHBOARD_INGEST_URL` with production dashboard URL
- [ ] Update `WIDGET_HOST` with production MCP server URL
- [ ] Test health endpoints
- [ ] Test MCP integration with ChatGPT
- [ ] Test dashboard authentication
- [ ] Test lead submission flow

### Post-Deployment

- [ ] Set up monitoring and alerts
- [ ] Configure CI/CD pipeline
- [ ] Set up database backups
- [ ] Document production URLs and credentials
- [ ] Test end-to-end workflow

---

## Additional Requirements

### HTTPS/SSL

- ✅ **HTTPS/SSL**: Required (automatic with Vercel/Railway)
- ✅ **Environment Variables**: All listed above
- ⚠️ **CI/CD**: Recommended (GitHub Actions)
- ⚠️ **Database Migration**: Consider SQLite → Postgres for MCP server
- ✅ **Monitoring**: Health checks configured (`/health` endpoint)

### Special Considerations

- **Supabase Redirect URLs**: Must configure production URLs in Supabase dashboard
- **CORS**: Configured for ChatGPT integration
- **Rate Limiting**: Nginx configured (10 req/s)
- **Health Checks**: `/health` endpoint available
- **Widget Embedding**: MCP server serves UI widgets for ChatGPT

---

## Railway Automatic Deployment

- **Railway automatically deploys** when code is pushed to GitHub
- **No manual deployment needed** after initial setup
- **Railway uses GitHub webhooks** to trigger deployments
- **Railway rebuilds and redeploys** on every push to main branch

### Railway Domain

- **Railway provides a default domain**: `https://your-service-name.railway.app`
- **Custom domain can be added**: In Railway dashboard → Service → Settings → Domains
- **SSL is automatic**: Railway automatically provisions SSL certificates
- **Domain is HTTPS**: Railway provides HTTPS by default

### Environment Variables

- **Environment variables are secure**: Railway stores them securely
- **Variables are injected at runtime**: Available as `process.env.VARIABLE_NAME`
- **Variables can be updated**: Update in Railway dashboard → Service → Variables
- **Service restarts automatically**: After updating environment variables

### Monitoring

- **Railway provides logs**: View logs in Railway dashboard → Service → Logs
- **Railway provides metrics**: View metrics in Railway dashboard → Service → Metrics
- **Railway provides health checks**: Railway monitors service health
- **Railway provides alerts**: Set up alerts in Railway dashboard (if available)

### Scaling

- **Railway auto-scales**: Railway automatically scales based on traffic
- **Railway provides resource limits**: Configure in Railway dashboard → Service → Settings
- **Railway provides pricing tiers**: Upgrade for more resources

---

## Success Criteria

Your deployment is successful when:

- ✅ Dashboard is running on Vercel
- ✅ MCP server is running on Railway
- ✅ Health checks return `{"status":"ok"}`
- ✅ MCP endpoint returns tools list
- ✅ Widget endpoint returns HTML with CSP headers
- ✅ Handshake test script passes all tests
- ✅ ChatGPT connector can connect to Railway URL
- ✅ All environment variables are configured
- ✅ Dashboard loads correctly on custom domain
- ✅ Authentication flow works end-to-end
- ✅ Lead submission flow works end-to-end

---

**Related Documentation**:
- Core Documentation: `docs/01-CORE-DOCUMENTATION.md`
- API Reference: `docs/03-API-INTEGRATION.md`
- Testing Guide: `docs/04-TESTING-QUALITY.md`

