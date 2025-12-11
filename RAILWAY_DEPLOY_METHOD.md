# Railway Deployment Method - Historical Analysis

## Summary

We previously triggered Railway deployments **without using the web UI** by leveraging Railway's **automatic GitHub webhook integration**. The method is a simple push-to-GitHub approach that triggers Railway's auto-deploy.

---

## Primary Method: GitHub Push → Railway Auto-Deploy

### How It Works

1. **Railway GitHub Integration**: Railway is connected to the GitHub repository via webhook
2. **Automatic Detection**: Railway automatically detects any push to the `main` branch
3. **Auto-Build & Deploy**: Railway builds using the `Dockerfile` and deploys automatically

### Documentation References

**File**: `docs/deployment/autoagent-deployment-plan.md` (lines 360-400)

```markdown
### Railway Deployment (Automatic)

#### **How Railway Works**
Railway **automatically deploys** when code is pushed to GitHub via Railway's GitHub integration:

1. **Connect Repository**: Railway is connected to GitHub repository
2. **Auto-Detect Configuration**: Railway detects `railway.json` and `Dockerfile`
3. **Automatic Build**: Railway builds using Dockerfile on every push
4. **Automatic Deploy**: Railway deploys the container automatically

#### **Railway Automatic Deployment**
- **No GitHub Actions needed**: Railway handles deployment automatically
- **No Railway CLI needed**: Railway uses GitHub webhooks
- **Auto-build on push**: Railway builds on every push to main/staging
- **Auto-deploy**: Railway deploys the container automatically
```

**File**: `docs/deployment/RAILWAY_DEPLOYMENT_STATUS.md` (line 258)

```markdown
- **Automatic Deployment**: Railway will auto-deploy on push to main branch after initial setup
```

**File**: `docs/02-DEPLOYMENT-INFRASTRUCTURE.md` (line 830)

```markdown
- **Railway uses GitHub webhooks** to trigger deployments
```

---

## Trigger Script Method (What We Used)

### Script: `scripts/trigger-railway-rebuild.sh`

**Location**: `/Users/mac/AutoAgent/scripts/trigger-railway-rebuild.sh`

**Contents**:
```bash
#!/bin/bash
# Script to trigger Railway rebuild by updating cache-busting file
# Usage: ./scripts/trigger-railway-rebuild.sh

set -e

echo "🔄 Triggering Railway rebuild..."

# Update the rebuild trigger file with current timestamp
echo "# Railway rebuild trigger - $(date)" > .railway-rebuild
echo "Build triggered at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> .railway-rebuild

# Commit and push
git add .railway-rebuild
git commit -m "Trigger Railway rebuild - $(date +%Y-%m-%d)" || echo "No changes to commit"
git push origin main

echo "✅ Rebuild trigger pushed to GitHub"
echo "📦 Railway should detect the change and start a new build"
```

### How It Works

1. Updates `.railway-rebuild` file with timestamp (cache-busting mechanism)
2. Commits the change
3. Pushes to `origin/main`
4. Railway webhook detects the push
5. Railway automatically builds and deploys

### Usage

```bash
bash scripts/trigger-railway-rebuild.sh
```

Or:

```bash
./scripts/trigger-railway-rebuild.sh
```

### Recent Usage in Commit History

From `git log`:
- `f301ec6` - "Trigger Railway rebuild - 2025-12-11" (used the script)
- `d1953e2` - "deploy: trigger Railway deployment - 20251211-105323"
- `a1c0a86` - "deploy: trigger new Railway deployment - 2025-12-08-1349"
- `72a1a79` - "Trigger Railway rebuild - 2025-12-08" (used the script)
- `4d0245c` - "chore: trigger Railway deployment"

---

## Alternative Methods (Documented but Not Primary)

### Option 1: Railway CLI

**Documentation**: `docs/deployment/RAILWAY_MANUAL_REBUILD.md` (lines 26-42)

```bash
# Login to Railway
railway login

# Link to your project (if not already linked)
railway link

# Trigger redeploy
railway up --service mcp-server

# Monitor logs
railway logs --service mcp-server --follow
```

**Status**: Requires Railway CLI authentication. Not what we used previously.

### Option 2: Manual Push to GitHub

Any push to `main` branch triggers deployment:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

**Status**: This is what the trigger script does, just automated.

### Option 3: GitHub Actions (Not Used)

**File**: `.github/workflows/ci.yml`

The CI workflow only runs tests/builds locally - it does NOT deploy to Railway. Railway handles deployment separately via webhook integration.

---

## Railway Configuration

### Files Involved

1. **`railway.json`** (repo root):
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

2. **`Dockerfile`** (repo root): Used for building the container

3. **`.railway-rebuild`** (repo root): Cache-busting trigger file (updated by script)

### Branch Tracking

Railway auto-deploys on pushes to:
- **`main`** branch (production)
- Possibly `staging` branch (if configured)

---

## How to Repeat the Deployment

### Method 1: Use the Trigger Script (Recommended)

```bash
cd /Users/mac/AutoAgent
bash scripts/trigger-railway-rebuild.sh
```

This will:
1. Update `.railway-rebuild` with timestamp
2. Commit and push to GitHub
3. Railway automatically detects and deploys

### Method 2: Manual Commit & Push

```bash
cd /Users/mac/AutoAgent

# Option A: Update trigger file
date +"%Y-%m-%d %H:%M:%S UTC" > .railway-rebuild
git add .railway-rebuild
git commit -m "deploy: trigger Railway deployment - $(date +%Y%m%d-%H%M%S)"
git push origin main

# Option B: Any commit works
git add .
git commit -m "Your changes"
git push origin main
```

Railway will auto-detect any push to `main` and deploy.

### Method 3: Railway CLI (Requires Setup)

```bash
railway login
railway link
railway up --service mcp-server
```

---

## Verification After Deployment

### Check Deployment Status

1. **Via Railway Dashboard**:
   - Go to https://railway.app
   - Select project → `mcp-server` service
   - Check "Deployments" tab
   - Verify commit SHA matches your latest push

2. **Via Monitoring Script**:
   ```bash
   bash scripts/monitorRailwayDeployment.sh [commit-sha]
   ```

3. **Via Health Check**:
   ```bash
   curl https://autoagentmcp-server-production.up.railway.app/health
   ```

---

## Summary

**What We Used Before**: 
- **Script**: `scripts/trigger-railway-rebuild.sh`
- **Mechanism**: Updates `.railway-rebuild` file → commits → pushes to GitHub → Railway webhook triggers auto-deploy

**Why It Works**:
- Railway is connected to GitHub via webhook
- Any push to `main` branch triggers automatic build & deploy
- No CLI or web UI interaction needed

**To Repeat**:
```bash
bash scripts/trigger-railway-rebuild.sh
```

Or simply push any commit to `main`:
```bash
git push origin main
```

---

## Key Files

- **Script**: `scripts/trigger-railway-rebuild.sh`
- **Trigger File**: `.railway-rebuild`
- **Config**: `railway.json`
- **Documentation**: 
  - `docs/deployment/autoagent-deployment-plan.md` (lines 360-400)
  - `docs/deployment/RAILWAY_DEPLOYMENT_STATUS.md`
  - `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`

