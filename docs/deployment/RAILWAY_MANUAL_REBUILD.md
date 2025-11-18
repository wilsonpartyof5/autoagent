# Railway Manual Rebuild Instructions

## If Railway Doesn't Auto-Detect New Commits

Sometimes Railway's GitHub webhook integration may have delays or miss commits. Here's how to manually trigger a rebuild:

## Option 1: Railway Dashboard (Easiest)

1. **Go to Railway Dashboard**
   - Navigate to https://railway.app
   - Sign in to your account
   - Select your project (AutoAgent MCP Server)

2. **Navigate to Service**
   - Click on the "mcp-server" service (or your service name)

3. **Trigger Redeploy**
   - Click the **"Deployments"** tab
   - Click the **"Redeploy"** button (usually in the top right)
   - Or click on the latest deployment and click **"Redeploy"**

4. **Monitor Build**
   - Watch the build logs in real-time
   - Wait for build to complete (typically 3-5 minutes)

## Option 2: Railway CLI

If you have Railway CLI installed:

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

## Option 3: Check GitHub Webhook

If Railway consistently doesn't detect commits:

1. **Go to Railway Dashboard**
   - Navigate to your project
   - Click **"Settings"** → **"Integrations"**
   - Verify GitHub integration is connected
   - Check webhook status

2. **Reconnect if Needed**
   - Disconnect and reconnect GitHub integration
   - This will refresh the webhook

## Verify Deployment

After triggering rebuild:

1. **Check Build Status**
   ```bash
   # Check service health
   curl https://autoagentmcp-server-production.up.railway.app/health
   ```

2. **Run Handshake Test**
   ```bash
   bash scripts/testChatGPTHandshake.sh https://autoagentmcp-server-production.up.railway.app
   ```

3. **Check Latest Commit**
   - Railway dashboard → Deployments → Latest
   - Verify commit SHA matches your latest commit: `c7a46ad`

## Current Latest Commit

- **SHA**: `c7a46adb9f3462da257047e9c20d313b87ffa30f`
- **Short**: `c7a46ad`
- **Message**: `chore: force Railway rebuild trigger`
- **Previous**: `416dd20` - `fix: add 5s timeouts and logging to all MarketCheck enrichment endpoints`

