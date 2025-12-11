# Capture Railway MCP Ingestion Error

## Step 1: Tail Railway Logs

### Option A: Railway CLI

```bash
railway logs --service mcp-server --lines 200 --search "ingest" --search "marketcheck" --search "error" --search "Unhandled"
```

### Option B: Railway Dashboard

1. Go to https://railway.app
2. Navigate to MCP Server service
3. Click "Logs" tab
4. Search/filter for: `ingest`, `marketcheck`, `error`, `Unhandled`

## Step 2: Run Diagnostic Script

```bash
cd /Users/mac/AutoAgent
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

## Step 3: Check Logs Again

After running the script, immediately check Railway logs again (same filters) and capture:
- Full error message
- Stack trace
- Any unhandled errors

## Step 4: Paste to Findings

Add the actual log lines to `MCP_500_ERROR_FINDINGS.md` - no guesses, only actual log content.

