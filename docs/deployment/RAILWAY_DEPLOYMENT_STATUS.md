# Railway Deployment Status - AutoAgent MCP Server

**Date**: 2025-11-12  
**Status**: ⚠️ **Manual Deployment Required**  
**Repository**: `wilsonpartyof5/autoagent` on GitHub

---

## 📋 Pre-Deployment Checklist

### ✅ Completed

- [x] **Repository Configuration**
  - [x] `railway.json` exists and configured
  - [x] `Dockerfile` exists and configured
  - [x] `pnpm-lock.yaml` is up to date
  - [x] Code is pushed to GitHub: `https://github.com/wilsonpartyof5/autoagent.git`

- [x] **Local Environment Variables Available**
  - [x] `PORT=8787`
  - [x] `MARKETCHECK_API_KEY` (available in local .env)
  - [x] `MARKETCHECK_BASE_URL` (available in local .env)
  - [x] `LEAD_ENC_KEY` (available in local .env)
  - [x] `DASHBOARD_INGEST_URL` (available in local .env)
  - [x] `DASHBOARD_INGEST_TOKEN` (available in local .env)
  - [x] `WIDGET_HOST` (available in local .env)
  - [x] `AA_DIAG` (available in local .env)
  - [x] `OPENAI_APP_NAME` (available in local .env)

### ⚠️ Required but Not Verified

- [ ] **Railway Account**
  - [ ] Railway account exists and is accessible
  - [ ] Railway project created or identified
  - [ ] GitHub repository connected to Railway

- [ ] **Supabase Environment Variables**
  - [ ] `SUPABASE_URL` (not found in local .env - **NEEDED**)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (not found in local .env - **NEEDED**)
  - [ ] `SUPABASE_ANON_KEY` (optional, but recommended)

- [ ] **Railway Deployment**
  - [ ] Service created in Railway
  - [ ] Environment variables configured in Railway
  - [ ] Build completed successfully
  - [ ] Service is running
  - [ ] Railway domain obtained

---

## 🚧 Blocking Issues

### 1. Railway Access Required

**Issue**: Cannot access Railway dashboard or CLI to deploy  
**Action Required**: 
- Access Railway dashboard at https://railway.app
- Sign in with GitHub account
- Create new project or select existing project
- Connect repository: `wilsonpartyof5/autoagent`

### 2. Supabase Credentials Missing

**Issue**: Supabase environment variables not found in local `.env`  
**Action Required**:
- Obtain Supabase project URL from Supabase dashboard
- Obtain Supabase service role key from Supabase dashboard
- Add these to Railway environment variables:
  - `SUPABASE_URL=https://your-project.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
  - `SUPABASE_ANON_KEY=your-anon-key` (optional)

### 3. Railway CLI Not Installed

**Issue**: Railway CLI is not installed locally  
**Action Required** (if using CLI):
```bash
npm install -g @railway/cli
railway login
```

**Alternative**: Use Railway web dashboard (recommended)

---

## 📝 Deployment Instructions

### Step 1: Access Railway Dashboard

1. Go to https://railway.app
2. Sign in with your GitHub account
3. Authorize Railway to access your repositories

### Step 2: Create/Select Project

**Option A: New Project**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Select `wilsonpartyof5/autoagent`
4. Railway will auto-detect `railway.json` and `Dockerfile`

**Option B: Existing Project**
1. Select existing project
2. Click "New" → "Service"
3. Select "GitHub Repo"
4. Select `wilsonpartyof5/autoagent`

### Step 3: Configure Environment Variables

In Railway dashboard → Service → Variables, add:

#### Required Variables

```bash
PORT=8787
MARKETCHECK_API_KEY=<from-local-env>
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
LEAD_ENC_KEY=<from-local-env>
DASHBOARD_INGEST_URL=<from-local-env>
DASHBOARD_INGEST_TOKEN=<from-local-env>
SUPABASE_URL=<NEEDED-FROM-SUPABASE>
SUPABASE_SERVICE_ROLE_KEY=<NEEDED-FROM-SUPABASE>
SUPABASE_ANON_KEY=<OPTIONAL-FROM-SUPABASE>
WIDGET_HOST=<WILL-BE-UPDATED-AFTER-DEPLOYMENT>
AA_DIAG=1
OPENAI_APP_NAME=AutoAgent
```

**Note**: 
- Replace `<from-local-env>` with values from `apps/mcp-server/.env`
- Replace `<NEEDED-FROM-SUPABASE>` with actual Supabase credentials
- `WIDGET_HOST` will be updated after getting Railway domain

### Step 4: Monitor Build

1. Railway will automatically start building
2. Watch build logs in Railway dashboard
3. Wait for build to complete (5-10 minutes)
4. Verify deployment is successful

### Step 5: Get Railway Domain

1. Go to Service → Settings → Domains
2. Copy the Railway domain (e.g., `https://autoagent-xxxxx.up.railway.app`)
3. Update `WIDGET_HOST` in Railway variables with this domain
4. Railway will automatically restart the service

### Step 6: Verify Deployment

Run these commands (replace `<railway-domain>` with your actual domain):

```bash
# Health check
curl https://<railway-domain>/health

# MCP endpoint test
curl -X POST https://<railway-domain>/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Widget endpoint test
curl -I https://<railway-domain>/widget/vehicle-results

# Handshake test
bash scripts/testChatGPTHandshake.sh https://<railway-domain>
```

---

## 🔍 Environment Variables Reference

### Available in Local .env

These variables are available in `apps/mcp-server/.env` and should be copied to Railway:

- `PORT=8787`
- `MARKETCHECK_API_KEY` (value available)
- `MARKETCHECK_BASE_URL` (value available)
- `LEAD_ENC_KEY` (value available)
- `DASHBOARD_INGEST_URL` (value available)
- `DASHBOARD_INGEST_TOKEN` (value available)
- `WIDGET_HOST` (value available, but will need update)
- `AA_DIAG` (value available)
- `OPENAI_APP_NAME` (value available)

### Missing - Need to Obtain

These variables are **NOT** in local `.env` and must be obtained:

- `SUPABASE_URL` - Get from Supabase dashboard → Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` - Get from Supabase dashboard → Project Settings → API → Service Role Key
- `SUPABASE_ANON_KEY` - Get from Supabase dashboard → Project Settings → API → Anon Key (optional)

---

## 📊 Deployment Status

### Current Status: ⚠️ **PENDING MANUAL DEPLOYMENT**

**What's Ready**:
- ✅ Repository is configured for Railway
- ✅ Dockerfile is production-ready
- ✅ Most environment variables are available locally
- ✅ Deployment guide is complete

**What's Needed**:
- ⚠️ Railway account access (manual step)
- ⚠️ Railway project creation (manual step)
- ⚠️ Supabase credentials (need to obtain)
- ⚠️ Railway deployment trigger (automatic after connection)

---

## 🎯 Next Steps

1. **Access Railway Dashboard**
   - Go to https://railway.app
   - Sign in with GitHub
   - Create/select project

2. **Connect Repository**
   - Select `wilsonpartyof5/autoagent`
   - Railway will auto-detect configuration

3. **Get Supabase Credentials**
   - Access Supabase dashboard
   - Get project URL and service role key
   - Add to Railway environment variables

4. **Configure Environment Variables**
   - Copy values from local `.env` to Railway
   - Add Supabase credentials
   - Set `WIDGET_HOST` placeholder (update after deployment)

5. **Monitor Deployment**
   - Watch build logs
   - Wait for successful deployment
   - Get Railway domain

6. **Update WIDGET_HOST**
   - Update `WIDGET_HOST` with Railway domain
   - Service will restart automatically

7. **Verify Deployment**
   - Run health check
   - Run MCP endpoint tests
   - Run handshake test script

8. **Update ChatGPT Connector**
   - Use Railway MCP endpoint URL
   - Test connection in ChatGPT

---

## 📝 Notes

- **Railway CLI**: Not installed, but not required (web dashboard works)
- **Automatic Deployment**: Railway will auto-deploy on push to main branch after initial setup
- **Environment Variables**: Most are available locally, but Supabase credentials need to be obtained
- **WIDGET_HOST**: Will be updated after Railway domain is known

---

**Last Updated**: 2025-11-12  
**Status**: Ready for manual deployment via Railway dashboard  
**Blocking**: Railway account access and Supabase credentials

