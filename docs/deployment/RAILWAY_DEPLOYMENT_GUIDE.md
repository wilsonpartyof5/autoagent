# 🚀 Railway Deployment Guide - AutoAgent MCP Server

**Purpose**: Step-by-step guide to deploy the AutoAgent MCP server to Railway for a production-ready HTTPS endpoint.

**Last Updated**: 2025-11-12  
**Status**: Production-ready deployment guide

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Pre-Deployment Review](#2-pre-deployment-review)
3. [Railway Deployment Steps](#3-railway-deployment-steps)
4. [Environment Variables Configuration](#4-environment-variables-configuration)
5. [Post-Deployment Verification](#5-post-deployment-verification)
6. [Hand-off Checklist](#6-hand-off-checklist)

---

## 1. Prerequisites

### Required Accounts
- ✅ **Railway Account**: Sign up at [railway.app](https://railway.app)
- ✅ **GitHub Account**: Repository must be on GitHub
- ✅ **MarketCheck API Key**: Production API key for vehicle inventory
- ✅ **Supabase Project**: Production Supabase project with credentials

### Required Information
- ✅ **MarketCheck API Key**: Production API key
- ✅ **Supabase URL**: Production Supabase project URL
- ✅ **Supabase Service Role Key**: Production service role key
- ✅ **Lead Encryption Key**: 32-byte base64 encryption key
- ✅ **Dashboard Ingest URL**: Dashboard endpoint for lead forwarding
- ✅ **Dashboard Ingest Token**: Secure token for lead forwarding

### Repository Status
- ✅ **Code Pushed to GitHub**: Repository must be on GitHub
- ✅ **railway.json**: Configuration file exists in repo root
- ✅ **Dockerfile**: Dockerfile exists in repo root
- ✅ **pnpm-lock.yaml**: Lockfile is up to date

---

## 2. Pre-Deployment Review

### Review Configuration Files

#### **railway.json**
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

#### **Dockerfile**
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

#### **Port Configuration**
- **Port**: `8787` (as specified in `apps/mcp-server/src/index.ts`)
- **Environment Variable**: `PORT=8787` (can be overridden in Railway)

### Required Environment Variables

**⚠️ IMPORTANT**: The MCP server now enforces required environment variables at startup. Missing required variables will cause the server to fail immediately with a clear error message.

Based on `apps/mcp-server/src/config/env.ts`, the following environment variables are **REQUIRED**:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WIDGET_HOST` | ✅ **REQUIRED** | Publicly reachable MCP host URL (no trailing slash) | `https://autoagentmcp-server-production.up.railway.app` |
| `MARKETCHECK_API_KEY` | ✅ **REQUIRED** | MarketCheck API key | `your-api-key` |
| `LEAD_ENC_KEY` | ✅ **REQUIRED** | 32-byte base64 encryption key | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `DASHBOARD_INGEST_URL` | ✅ **REQUIRED** | Dashboard endpoint for leads | `https://dashboard.com/api/ingest/lead` |
| `DASHBOARD_INGEST_TOKEN` | ✅ **REQUIRED** | Secure token for lead forwarding | `your-token` |

**Optional** environment variables (have defaults or are only needed for specific features):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | ⚠️ Optional | Server port (defaults to `8787`) | `8787` |
| `MARKETCHECK_BASE_URL` | ⚠️ Optional | MarketCheck API base URL (defaults to `https://marketcheck-prod.apigee.net`) | `https://marketcheck-prod.apigee.net` |
| `AA_DIAG` | ⚠️ Optional | Enable diagnostics (set to `1` or `true`) | `1` |
| `OPENAI_APP_NAME` | ⚠️ Optional | OpenAI App name (defaults to `AutoAgent`) | `AutoAgent` |
| `SUPABASE_URL` | ⚠️ Optional | Supabase project URL (only needed for delivery logs) | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Optional | Supabase service role key (only needed for delivery logs) | `your-service-role-key` |
| `SUPABASE_ANON_KEY` | ⚠️ Optional | Supabase anon key (fallback, only needed for delivery logs) | `your-anon-key` |

**Validation**: The server validates all required variables at startup. You can test your configuration with:
```bash
pnpm --filter @autoagent/mcp-server test:env
```
| `OPENAI_APP_NAME` | ⚠️ Optional | OpenAI app name | `AutoAgent` |

**Note**: `WIDGET_HOST` should be set to the Railway domain **after** deployment. Initially, you can use a placeholder, then update it once you have the Railway URL.

---

## 3. Railway Deployment Steps

### Step 1: Connect Repository to Railway

#### **Option A: New Railway Project (First Time)**

1. **Go to Railway Dashboard**
   - Navigate to [railway.app](https://railway.app)
   - Sign in with your GitHub account

2. **Create New Project**
   - Click "New Project" button
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub repositories (if prompted)

3. **Select Repository**
   - Find and select `wilsonpartyof5/autoagent` (or your repository)
   - Click "Deploy Now"

4. **Railway Auto-Detection**
   - Railway will automatically detect `railway.json`
   - Railway will detect `Dockerfile`
   - Railway will start building automatically

#### **Option B: Existing Railway Project**

If you already have a Railway project:

1. **Go to Railway Dashboard**
   - Navigate to [railway.app](https://railway.app)
   - Select your existing project

2. **Add Service**
   - Click "New" → "Service"
   - Select "GitHub Repo"
   - Select `wilsonpartyof5/autoagent` (or your repository)
   - Railway will auto-detect the configuration

3. **Verify Service Configuration**
   - Railway should detect `railway.json` and `Dockerfile`
   - Service should be configured to use Dockerfile builder
   - Port should be set to `8787`

### Step 2: Verify Build Configuration

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

### Step 3: Monitor Initial Build

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

### Step 4: Get Railway Domain

1. **Find Railway Domain**
   - Go to service "Settings" tab
   - Scroll to "Domains" section
   - Railway provides a default domain: `https://your-service-name.railway.app`
   - Copy this domain (you'll need it for `WIDGET_HOST`)

2. **Custom Domain (Optional)**
   - If you have a custom domain, add it in Railway dashboard
   - Railway will automatically provision SSL certificate
   - Update DNS records as needed

---

## 4. Environment Variables Configuration

### Step 1: Add Environment Variables in Railway

1. **Go to Service Settings**
   - Navigate to your service in Railway dashboard
   - Click "Variables" tab
   - Click "New Variable" button

2. **Add Required Variables**

Add the following environment variables one by one:

#### **Server Configuration**
```bash
PORT=8787
```

#### **MarketCheck API Configuration**
```bash
MARKETCHECK_API_KEY=your_production_marketcheck_api_key
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
```

#### **Supabase Configuration**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### **Lead Security & Forwarding**
```bash
LEAD_ENC_KEY=your_32_byte_base64_encryption_key
DASHBOARD_INGEST_URL=https://your-dashboard-domain.com/api/ingest/lead
DASHBOARD_INGEST_TOKEN=your_secure_dashboard_token
```

#### **Widget Configuration**
```bash
WIDGET_HOST=https://your-railway-domain.railway.app
```

**Important**: Replace `your-railway-domain.railway.app` with your actual Railway domain from Step 4.

#### **Diagnostics (Optional)**
```bash
AA_DIAG=1
```

#### **OpenAI App Configuration (Optional)**
```bash
OPENAI_APP_NAME=AutoAgent
```

### Step 2: Generate Lead Encryption Key

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

### Step 3: Verify Environment Variables

1. **Check All Variables Are Set**
   - Go to "Variables" tab in Railway dashboard
   - Verify all required variables are present
   - Check that values are correct (no typos)

2. **Restart Service (if needed)**
   - After adding environment variables, Railway will automatically restart the service
   - If not, manually trigger a redeploy:
     - Go to "Deployments" tab
     - Click "Redeploy" button
     - Railway will rebuild and redeploy with new environment variables

### Step 4: Update WIDGET_HOST (After Getting Railway Domain)

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

## 5. Post-Deployment Verification

### Step 1: Health Check

Test the health endpoint:

```bash
# Replace with your Railway domain
curl https://your-railway-domain.railway.app/health
```

**Expected Response**:
```json
{"status":"ok"}
```

**If successful**: ✅ Health check passed  
**If failed**: ❌ Check Railway logs for errors

### Step 2: MCP Endpoint Test

Test the MCP endpoint with a tools/list request:

```bash
# Replace with your Railway domain
curl -X POST https://your-railway-domain.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search-vehicles",
        "description": "Search for vehicles",
        ...
      },
      {
        "name": "submit-lead",
        "description": "Submit a lead for a vehicle",
        ...
      }
    ]
  }
}
```

**If successful**: ✅ MCP endpoint is working  
**If failed**: ❌ Check Railway logs for errors

### Step 3: MCP Initialize Test

Test the MCP initialize endpoint:

```bash
# Replace with your Railway domain
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

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "serverInfo": {
      "name": "autoagent-mcp-server",
      "version": "1.0.0"
    },
    "initialized": true
  }
}
```

**If successful**: ✅ MCP initialize is working  
**If failed**: ❌ Check Railway logs for errors

### Step 4: Widget Endpoint Test

Test the widget endpoint:

```bash
# Replace with your Railway domain
curl -I https://your-railway-domain.railway.app/widget/vehicle-results
```

**Expected Response**:
```
HTTP/2 200
content-type: text/html; charset=utf-8
content-security-policy: frame-ancestors https://chat.openai.com https://chatgpt.com
...
```

**If successful**: ✅ Widget endpoint is working  
**If failed**: ❌ Check Railway logs for errors

### Step 5: Run Handshake Test Script

Run the comprehensive handshake test:

```bash
# Replace with your Railway domain
bash scripts/testChatGPTHandshake.sh https://your-railway-domain.railway.app
```

**Expected Output**:
```
🧪 AutoAgent ChatGPT MCP Handshake Test
========================================
MCP Server URL: https://your-railway-domain.railway.app
MCP Endpoint: https://your-railway-domain.railway.app/mcp
Health Endpoint: https://your-railway-domain.railway.app/health

✅ Health Check: HTTP 200
✅ MCP Initialize: HTTP 200
✅ MCP Tools List: HTTP 200
✅ Widget endpoint: HTTP 200
✅ CSP header includes ChatGPT domains
✅ All handshake tests completed
```

**If successful**: ✅ All tests passed  
**If failed**: ❌ Check Railway logs for errors

### Step 6: Check Railway Logs

1. **View Logs in Railway Dashboard**
   - Go to your service in Railway dashboard
   - Click "Logs" tab
   - Check for any errors or warnings
   - Verify server is running correctly

2. **Check for Common Issues**
   - **Port conflicts**: Verify port 8787 is correct
   - **Environment variables**: Verify all required variables are set
   - **Build errors**: Check build logs for errors
   - **Runtime errors**: Check runtime logs for errors

---

## 6. Hand-off Checklist

### Immediate Next Steps

- [ ] **Verify Railway Deployment**
  - [ ] Service is running in Railway dashboard
  - [ ] Build completed successfully
  - [ ] Service has a public URL

- [ ] **Configure Environment Variables**
  - [ ] `PORT=8787` is set
  - [ ] `MARKETCHECK_API_KEY` is set (production key)
  - [ ] `LEAD_ENC_KEY` is set (32-byte base64 key)
  - [ ] `DASHBOARD_INGEST_URL` is set
  - [ ] `DASHBOARD_INGEST_TOKEN` is set
  - [ ] `SUPABASE_URL` is set
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
  - [ ] `WIDGET_HOST` is set to Railway domain
  - [ ] `AA_DIAG=1` is set (optional)

- [ ] **Run Verification Tests**
  - [ ] Health check: `curl https://your-railway-domain.railway.app/health`
  - [ ] MCP endpoint: `curl -X POST https://your-railway-domain.railway.app/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
  - [ ] Widget endpoint: `curl -I https://your-railway-domain.railway.app/widget/vehicle-results`
  - [ ] Handshake test: `bash scripts/testChatGPTHandshake.sh https://your-railway-domain.railway.app`

### Post-Deployment Tasks

- [ ] **Update ChatGPT Connector**
  - [ ] Get Railway MCP endpoint URL: `https://your-railway-domain.railway.app/mcp`
  - [ ] Update ChatGPT connector with Railway URL
  - [ ] Verify connector shows "Connected" status
  - [ ] Test search-vehicles tool in ChatGPT
  - [ ] Test submit-lead tool in ChatGPT

- [ ] **Update Local Configuration**
  - [ ] Update `apps/mcp-server/.env` with Railway URL (if needed for local testing)
  - [ ] Update any local scripts that reference the MCP server URL

- [ ] **Monitor Deployment**
  - [ ] Check Railway logs for errors
  - [ ] Monitor service health in Railway dashboard
  - [ ] Set up alerts (if available in Railway)

### Documentation Updates

- [ ] **Update Deployment Documentation**
  - [ ] Update `docs/deployment/railway.md` with actual Railway URL
  - [ ] Update `docs/deployment/autoagent-deployment-plan.md` with deployment status
  - [ ] Document any custom domain configuration

- [ ] **Update Environment Variables Documentation**
  - [ ] Update `env.production.example` with actual values (if needed)
  - [ ] Document any additional environment variables

### Troubleshooting

If deployment fails or tests fail:

- [ ] **Check Railway Logs**
  - [ ] Go to Railway dashboard → Service → Logs
  - [ ] Look for error messages
  - [ ] Check build logs for errors
  - [ ] Check runtime logs for errors

- [ ] **Verify Environment Variables**
  - [ ] Check all required variables are set
  - [ ] Verify variable values are correct
  - [ ] Check for typos in variable names

- [ ] **Verify Build Configuration**
  - [ ] Check `railway.json` is correct
  - [ ] Check `Dockerfile` is correct
  - [ ] Verify `pnpm-lock.yaml` is up to date

- [ ] **Test Locally**
  - [ ] Run `pnpm --filter mcp-server build` locally
  - [ ] Run `pnpm --filter mcp-server start` locally
  - [ ] Test endpoints locally: `curl http://localhost:8787/health`

---

## 📝 Additional Notes

### Railway Automatic Deployment

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

## 🎉 Success Criteria

Your Railway deployment is successful when:

- ✅ Service is running in Railway dashboard
- ✅ Health check returns `{"status":"ok"}`
- ✅ MCP endpoint returns tools list
- ✅ Widget endpoint returns HTML with CSP headers
- ✅ Handshake test script passes all tests
- ✅ ChatGPT connector can connect to Railway URL
- ✅ All environment variables are configured
- ✅ Railway logs show no errors

---

## 📚 Related Documentation

- **Deployment Plan**: `docs/deployment/autoagent-deployment-plan.md`
- **Railway Summary**: `docs/deployment/railway.md`
- **Production Guide**: `docs/deployment/production.md`
- **Handshake Test Script**: `scripts/testChatGPTHandshake.sh`
- **Environment Example**: `apps/mcp-server/env.example`
- **Production Example**: `env.production.example`

---

**Last Updated**: 2025-11-12  
**Status**: Production-ready deployment guide  
**Next Review**: After first successful deployment

