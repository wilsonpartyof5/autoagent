# Railway Deployment Monitoring Guide

## Overview

This guide explains how to monitor Railway deployments to ensure code changes are properly deployed.

## Prerequisites

### Option 1: Railway CLI (Recommended)

Install Railway CLI:
```bash
npm install -g @railway/cli
# Or using Homebrew on macOS:
brew install railway
```

Login:
```bash
railway login
```

Link to project:
```bash
railway link
```

### Option 2: Railway Dashboard

Access the Railway dashboard at https://railway.app and navigate to your project.

## Monitoring Deployment Status

### Using Railway CLI

#### Check Recent Deployments

```bash
# List recent deployments
railway deployments --service mcp-server --environment production

# Get specific deployment details
railway deployment [deployment-id]
```

#### Monitor Live Logs

```bash
# Stream logs in real-time
railway logs --service mcp-server --environment production --follow

# Get last 100 lines
railway logs --service mcp-server --environment production --tail 100
```

#### Trigger Manual Deployment

```bash
# Redeploy latest commit
railway up --service mcp-server

# Deploy specific commit
railway up --service mcp-server --detach
```

### Using Railway Dashboard

1. **Navigate to Service**
   - Go to https://railway.app
   - Select your project
   - Click on "mcp-server" service

2. **Check Deployments Tab**
   - Click "Deployments" tab
   - View list of recent deployments
   - Check commit SHA, timestamp, and status
   - Click on a deployment to see build logs

3. **Monitor Build Logs**
   - Click on latest deployment
   - Watch build progress in real-time
   - Check for errors or warnings
   - Verify build completes successfully

4. **Trigger Manual Redeploy**
   - Click "Redeploy" button
   - Or go to "Settings" → "Redeploy"

### Using Monitoring Script

We have a script that checks service health and MCP endpoint:

```bash
bash scripts/monitorRailwayDeployment.sh [commit-sha]
```

This script:
- Checks service health endpoint
- Tests MCP endpoint
- Compares service timestamp with commit timestamp
- Provides deployment status summary

## Deployment Workflow

### After Each Code Push

1. **Verify Commit Pushed**
   ```bash
   git log --oneline -1
   git rev-parse HEAD
   ```

2. **Check Railway Detected Commit**
   - Use Railway CLI: `railway deployments --service mcp-server`
   - Or check Railway dashboard → Deployments tab
   - Look for your commit SHA in the list

3. **Monitor Build**
   - Watch build logs: `railway logs --service mcp-server --follow`
   - Or use Railway dashboard → Deployments → Latest → Build Logs
   - Wait for build to complete (typically 3-5 minutes)

4. **Verify Deployment**
   - Check service health: `curl https://autoagentmcp-server-production.up.railway.app/health`
   - Run handshake test: `bash scripts/testChatGPTHandshake.sh https://autoagentmcp-server-production.up.railway.app`
   - Verify MCP endpoint works

### If Deployment Doesn't Start

1. **Check Railway Webhook**
   - Go to Railway dashboard → Project → Settings → Integrations
   - Verify GitHub integration is connected
   - Check webhook status

2. **Trigger Manual Deployment**
   - Use Railway CLI: `railway up --service mcp-server`
   - Or use Railway dashboard → Service → Redeploy

3. **Check Build Configuration**
   - Verify `Dockerfile` exists
   - Check `railway.json` configuration
   - Ensure build commands are correct

## Troubleshooting

### Deployment Not Starting

**Symptoms:**
- No new deployment appears after push
- Latest deployment is old

**Solutions:**
1. Check Railway webhook integration
2. Verify GitHub repository is connected
3. Manually trigger redeploy
4. Check Railway service status

### Build Failing

**Symptoms:**
- Deployment shows "Failed" status
- Build logs show errors

**Solutions:**
1. Review build logs for specific errors
2. Fix TypeScript/build errors locally first
3. Verify all dependencies are in `package.json`
4. Check `pnpm-lock.yaml` is up to date
5. Ensure Dockerfile build steps are correct

### Service Not Updating

**Symptoms:**
- Deployment succeeds but service behavior unchanged
- Old code still running

**Solutions:**
1. Verify deployment actually completed
2. Check service is using latest deployment
3. Restart service if needed
4. Clear any caches

## Monitoring Checklist

After each code push:

- [ ] Commit pushed to GitHub
- [ ] Railway detected new commit (check deployments)
- [ ] Build started automatically
- [ ] Build completed successfully
- [ ] Service health check passes
- [ ] MCP endpoint responds correctly
- [ ] Handshake test passes

## Quick Commands

```bash
# Check latest commit
git log --oneline -1

# Monitor Railway deployment
railway deployments --service mcp-server

# Watch build logs
railway logs --service mcp-server --follow

# Test service
bash scripts/testChatGPTHandshake.sh https://autoagentmcp-server-production.up.railway.app

# Check deployment status
bash scripts/monitorRailwayDeployment.sh
```

## Notes

- Railway typically auto-deploys within 1-2 minutes of push
- Builds take 3-5 minutes on average
- Service restart takes 30-60 seconds after build
- Always verify deployment before assuming it worked

