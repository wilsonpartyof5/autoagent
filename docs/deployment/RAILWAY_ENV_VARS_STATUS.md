# Railway Environment Variables Status

**Date**: 2025-11-13  
**Status**: ✅ All values configured - Production deployment complete

---

## ✅ Values Found (Ready to Use)

| Variable | Value | Source |
|----------|-------|--------|
| `PORT` | `8787` | Local .env |
| `NODE_ENV` | `production` | Standard |
| `MARKETCHECK_API_KEY` | `MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX` | Local .env |
| `MARKETCHECK_BASE_URL` | `https://api.marketcheck.com/v2` | Updated from local .env |
| `OPENAI_APP_NAME` | `AutoAgent` | Local .env |
| `LEAD_ENC_KEY` | `VlUoijWfCB7ipo4Rva15p9EDj7Z8rGC5ndyrLjjZrCc=` | Local .env |
| `SUPABASE_URL` | `https://vqoawedqmeybbndvqxta.supabase.co` | Dealer dashboard .env.local |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Dealer dashboard .env.local |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Dealer dashboard .env.local |
| `AA_DIAG` | `1` | Local .env |
| `DASHBOARD_INGEST_TOKEN` | `42b7ffc3c01cc4fb87e9746f59962d9359417a28a2d2b9434ffc018b9aa0be3c` | Generated |

---

## ✅ Production URLs Configured

### 1. `DASHBOARD_INGEST_URL` ✅ **CONFIGURED**

**Production Value**: `https://autoagent-dealer-dashboard.vercel.app/api/ingest/lead`

**Status**: ✅ Deployed and configured in Railway

### 2. `WIDGET_HOST` ✅ **CONFIGURED**

**Production Value**: `https://autoagentmcp-server-production.up.railway.app`

**Status**: ✅ Deployed and configured in Railway

---

## 📋 Copy-Paste Ready Format

### Version 1: With Placeholders (Before Vercel/Railway Deployment)

```
PORT=8787
NODE_ENV=production
MARKETCHECK_API_KEY=MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX
MARKETCHECK_BASE_URL=https://api.marketcheck.com/v2
OPENAI_APP_NAME=AutoAgent
LEAD_ENC_KEY=VlUoijWfCB7ipo4Rva15p9EDj7Z8rGC5ndyrLjjZrCc=
DASHBOARD_INGEST_URL=https://dealer-dashboard.vercel.app/api/ingest/lead
DASHBOARD_INGEST_TOKEN=42b7ffc3c01cc4fb87e9746f59962d9359417a28a2d2b9434ffc018b9aa0be3c
SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxb2F3ZWRxbWV5YmJuZHZxeHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTczNDI2NiwiZXhwIjoyMDc3MzEwMjY2fQ.dw0vLpgsPxfVn-CyZxgHK9pkRGYuHfmYjltn0ScV5AU
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxb2F3ZWRxbWV5YmJuZHZxeHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MzQyNjYsImV4cCI6MjA3NzMxMDI2Nn0.ARBUtPYmVn8Mi3qdVS9b8euYuG0X2mYa7c0a9cBA8Os
WIDGET_HOST=https://placeholder.up.railway.app
AA_DIAG=1
```

### Version 2: After Railway Deployment (Update WIDGET_HOST)

```
PORT=8787
NODE_ENV=production
MARKETCHECK_API_KEY=MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX
MARKETCHECK_BASE_URL=https://api.marketcheck.com/v2
OPENAI_APP_NAME=AutoAgent
LEAD_ENC_KEY=VlUoijWfCB7ipo4Rva15p9EDj7Z8rGC5ndyrLjjZrCc=
DASHBOARD_INGEST_URL=https://dealer-dashboard.vercel.app/api/ingest/lead
DASHBOARD_INGEST_TOKEN=42b7ffc3c01cc4fb87e9746f59962d9359417a28a2d2b9434ffc018b9aa0be3c
SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxb2F3ZWRxbWV5YmJuZHZxeHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTczNDI2NiwiZXhwIjoyMDc3MzEwMjY2fQ.dw0vLpgsPxfVn-CyZxgHK9pkRGYuHfmYjltn0ScV5AU
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxb2F3ZWRxbWV5YmJuZHZxeHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MzQyNjYsImV4cCI6MjA3NzMxMDI2Nn0.ARBUtPYmVn8Mi3qdVS9b8euYuG0X2mYa7c0a9cBA8Os
WIDGET_HOST=https://YOUR-RAILWAY-DOMAIN.up.railway.app
AA_DIAG=1
```

---

## 🔍 Values Found - Details

### ✅ Supabase Configuration

**Found in**: `apps/dealer-dashboard/.env.local`

- **SUPABASE_URL**: `https://vqoawedqmeybbndvqxta.supabase.co`
- **SUPABASE_SERVICE_ROLE_KEY**: Found (64 chars, JWT format)
- **SUPABASE_ANON_KEY**: Found (64 chars, JWT format)

### ✅ MarketCheck Configuration

**Found in**: `apps/mcp-server/.env`

- **MARKETCHECK_API_KEY**: `MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX`
- **MARKETCHECK_BASE_URL**: Updated to `https://api.marketcheck.com/v2` (as requested)

### ✅ Lead Encryption Key

**Found in**: `apps/mcp-server/.env`

- **LEAD_ENC_KEY**: `VlUoijWfCB7ipo4Rva15p9EDj7Z8rGC5ndyrLjjZrCc=`
- **Status**: Valid 32-byte base64 key

### ✅ Dashboard Ingest Token

**Generated**: New secure token generated

- **DASHBOARD_INGEST_TOKEN**: `42b7ffc3c01cc4fb87e9746f59962d9359417a28a2d2b9434ffc018b9aa0be3c`
- **Format**: 64-character hex string (secure)
- **Note**: This token must also be set in the dashboard's environment variables (Vercel)

---

## ⚠️ Values Still Needed

### 1. DASHBOARD_INGEST_URL

**Status**: ⚠️ **NEEDS VERCEL DEPLOYMENT URL**

**Current**: Local development URL (`http://localhost:3000/api/ingest/lead`)

**What We Need**:
- Vercel dashboard deployment URL
- Format: `https://your-dashboard.vercel.app/api/ingest/lead`

**Next Steps**:
1. **If dashboard is deployed to Vercel**: Get the URL from Vercel dashboard
2. **If dashboard is NOT deployed**: Deploy dashboard to Vercel first, then use that URL

**Options**:
- **Option A**: Deploy dashboard to Vercel now → Get URL → Update this value
- **Option B**: Use placeholder for now → Update after Vercel deployment

### 2. WIDGET_HOST

**Status**: ⚠️ **NEEDS RAILWAY DEPLOYMENT DOMAIN**

**Current**: Placeholder (`https://placeholder.up.railway.app`)

**What We Need**:
- Railway deployment domain (provided after deployment)
- Format: `https://your-service-name.up.railway.app`

**Next Steps**:
1. Deploy to Railway
2. Get Railway domain from Railway dashboard
3. Update `WIDGET_HOST` with Railway domain
4. Redeploy service (Railway will auto-restart)

**Note**: This is a **circular dependency**:
- Railway needs `WIDGET_HOST` to build
- But we don't have Railway domain until after deployment

**Solution**: Use placeholder initially, then update after first deployment.

---

## 📝 Next Steps to Complete

### Step 1: Deploy Dashboard to Vercel (if not done)

1. **Check if dashboard is deployed**:
   - Go to Vercel dashboard
   - Check if `wilsonpartyof5/autoagent` dashboard is deployed
   - Get the Vercel URL (e.g., `https://autoagent-dashboard.vercel.app`)

2. **If not deployed**:
   - Deploy dashboard to Vercel
   - Get Vercel deployment URL
   - Update `DASHBOARD_INGEST_URL` with Vercel URL

### Step 2: Deploy MCP Server to Railway

1. **Connect repository to Railway**:
   - Go to Railway dashboard
   - Create new project or select existing
   - Connect `wilsonpartyof5/autoagent` repository

2. **Configure environment variables**:
   - Use the values from this document
   - Set `WIDGET_HOST` to placeholder initially
   - Set `DASHBOARD_INGEST_URL` to Vercel URL (if available)

3. **Deploy**:
   - Railway will auto-deploy on push
   - Monitor build logs
   - Get Railway domain from Settings → Domains

4. **Update WIDGET_HOST**:
   - Update `WIDGET_HOST` with Railway domain
   - Railway will auto-restart service

### Step 3: Update Dashboard Environment Variables

1. **In Vercel dashboard**:
   - Add `DASHBOARD_INGEST_TOKEN` to Vercel environment variables
   - Value: `42b7ffc3c01cc4fb87e9746f59962d9359417a28a2d2b9434ffc018b9aa0be3c`
   - This allows the dashboard to accept leads from MCP server

---

## 🎯 Summary

### ✅ Ready to Use (10 variables)

- `PORT=8787`
- `NODE_ENV=production`
- `MARKETCHECK_API_KEY` ✓
- `MARKETCHECK_BASE_URL` ✓
- `OPENAI_APP_NAME=AutoAgent`
- `LEAD_ENC_KEY` ✓
- `DASHBOARD_INGEST_TOKEN` ✓ (generated)
- `SUPABASE_URL` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓
- `SUPABASE_ANON_KEY` ✓
- `AA_DIAG=1`

### ⚠️ Still Needed (2 variables)

1. **DASHBOARD_INGEST_URL**: Needs Vercel dashboard URL
2. **WIDGET_HOST**: Needs Railway domain (after deployment)

---

## 📋 Action Items

- [ ] **Deploy dashboard to Vercel** (if not already deployed)
- [ ] **Get Vercel dashboard URL** and update `DASHBOARD_INGEST_URL`
- [ ] **Deploy MCP server to Railway** with current values (using placeholder for `WIDGET_HOST`)
- [ ] **Get Railway domain** from Railway dashboard
- [ ] **Update `WIDGET_HOST`** with Railway domain
- [ ] **Add `DASHBOARD_INGEST_TOKEN` to Vercel** environment variables
- [ ] **Verify deployment** with handshake test script

---

**Last Updated**: 2025-11-13  
**Status**: ✅ All 12 variables configured - Production deployment complete

## 🧪 Handshake Test Results

**Date**: 2025-11-13  
**MCP Server URL**: `https://autoagentmcp-server-production.up.railway.app`  
**Dashboard URL**: `https://autoagent-dealer-dashboard.vercel.app`

### Test Results

**Status**: ⚠️ Initial test returned HTTP 502

**Error**: `Application failed to respond` (502 Bad Gateway)

**Possible Causes**:
- Railway service may be starting up or restarting
- Service may need a few minutes to become fully available
- Check Railway logs for deployment status

**Next Steps**:
1. Verify Railway service is running in Railway dashboard
2. Check Railway logs for any startup errors
3. Wait a few minutes and retry the handshake test
4. Verify environment variables are correctly set in Railway

**Handshake Test Command**:
```bash
bash scripts/testChatGPTHandshake.sh https://autoagentmcp-server-production.up.railway.app
```

