# Quick Start: Testing in ChatGPT

## Step 1: Start MCP Server

**Terminal 1:**
```bash
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev
```

**Wait for this output:**
```
🚗 AutoAgent MCP Server running on http://localhost:8787
📊 Health check: http://localhost:8787/health
🔧 MCP endpoint: http://localhost:8787/mcp
```

**Verify it's running:**
```bash
curl http://localhost:8787/health
```

---

## Step 2: Start ngrok Tunnel

**Terminal 2 (new terminal):**
```bash
ngrok http 8787
```

**You'll see output like:**
```
Forwarding    https://abc123.ngrok-free.dev -> http://localhost:8787
```

**⚠️ IMPORTANT:** Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

---

## Step 3: Update WIDGET_HOST (if needed)

**Edit `apps/mcp-server/.env`:**
```bash
WIDGET_HOST=https://abc123.ngrok-free.dev
```

**Restart MCP server** (Ctrl+C in Terminal 1, then restart)

---

## Step 4: Get Your MCP Server URL for ChatGPT

**Your ChatGPT MCP Server URL is:**
```
https://abc123.ngrok-free.dev/mcp
```

**Note:** Make sure to include `/mcp` at the end!

---

## Step 5: Configure ChatGPT Connector

1. Open **ChatGPT** → **Settings** → **Connectors** (or **Apps** → **Connectors**)
2. Click **Add Connector** or **Edit** existing
3. **MCP Server URL**: `https://abc123.ngrok-free.dev/mcp`
4. **Authentication**: None
5. Click **Save**

**ChatGPT will automatically:**
- Test the connection
- Call `initialize` and `tools/list`
- Show tools if successful

---

## Step 6: Test in ChatGPT

**Try these queries:**

1. **Search Test:**
   ```
   Show me new GMC trucks near Rock Hill, SC
   ```

2. **Expected Result:**
   - ChatGPT calls `search-vehicles` tool
   - Widget appears with 10 Rock Hill GMC vehicles
   - Map shows vehicle locations

3. **Lead Submission Test:**
   - Click a vehicle in the widget
   - Click "Request Info"
   - Fill out the form and submit
   - Check `/app/leads` in dashboard to verify

---

## Troubleshooting

### "Connection Failed" in ChatGPT

1. **Check MCP server is running:**
   ```bash
   curl http://localhost:8787/health
   ```

2. **Check ngrok is running:**
   - Look at Terminal 2 for the ngrok URL
   - Or visit `http://127.0.0.1:4040` (ngrok web interface)

3. **Test the tunnel URL:**
   ```bash
   curl https://abc123.ngrok-free.dev/health
   ```

4. **Run handshake test:**
   ```bash
   bash scripts/testChatGPTHandshake.sh https://abc123.ngrok-free.dev
   ```

### ngrok Free Tier Warning Page

- First visit to ngrok URL shows a warning page
- Click "Visit Site" to proceed
- This is normal for ngrok free tier

### Tools Not Appearing

- Check MCP server logs (Terminal 1) for errors
- Verify handshake test passes
- Try disconnecting and reconnecting the connector

---

## Quick Reference

| Service | URL | Status Check |
|---------|-----|--------------|
| MCP Server (local) | `http://localhost:8787` | `curl http://localhost:8787/health` |
| MCP Endpoint (local) | `http://localhost:8787/mcp` | `curl -X POST http://localhost:8787/mcp -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{}}'` |
| ngrok Tunnel | `https://abc123.ngrok-free.dev` | `curl https://abc123.ngrok-free.dev/health` |
| **ChatGPT MCP URL** | `https://abc123.ngrok-free.dev/mcp` | Use in ChatGPT connector settings |

---

**Remember:** The MCP Server URL for ChatGPT must be:
- HTTPS (not HTTP) - that's why we need ngrok
- Include `/mcp` at the end
- Example: `https://abc123.ngrok-free.dev/mcp`

