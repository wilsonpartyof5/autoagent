# Custom Domain Setup for Railway MCP Server

**Purpose:** If OpenAI can't connect to `*.up.railway.app` domains, use a custom domain.

---

## Step-by-Step Guide

### 1. Purchase Domain (if needed)

**Recommended domains:**
- `mcp.autoagent.ai`
- `api.autoagent.app`
- `mcp.autoagent.com`

**Domain registrars:**
- Namecheap
- Google Domains
- Cloudflare
- Route 53 (AWS)

---

### 2. Configure Domain in Railway

1. **Go to Railway Dashboard:**
   - Navigate to https://railway.app
   - Select your project
   - Click on **@autoagent/mcp-server** service

2. **Add Custom Domain:**
   - Click **Settings** tab
   - Scroll to **Domains** section
   - Click **"Add Domain"** or **"Generate Domain"**
   - Enter your custom domain (e.g., `mcp.autoagent.ai`)
   - Railway will show DNS configuration needed

3. **Note DNS Records:**
   - Railway will provide:
     - CNAME record target
     - Or A record IP addresses
   - Copy these for next step

---

### 3. Configure DNS Records

**Go to your domain registrar's DNS settings:**

1. **For CNAME (Recommended):**
   ```
   Type: CNAME
   Name: mcp (or @ for root domain)
   Value: [Railway-provided CNAME target]
   TTL: 3600 (or default)
   ```

2. **For A Record (if CNAME not available):**
   ```
   Type: A
   Name: mcp (or @ for root domain)
   Value: [Railway-provided IP address]
   TTL: 3600 (or default)
   ```

3. **Save DNS Records:**
   - Wait for DNS propagation (5-60 minutes)
   - Verify with: `nslookup mcp.autoagent.ai`

---

### 4. Update Environment Variables

**In Railway Dashboard:**

1. Go to Service → **Variables** tab
2. Find `WIDGET_HOST` variable
3. Update value:
   ```
   WIDGET_HOST=https://mcp.autoagent.ai
   ```
   (Replace with your actual custom domain)

4. **Save Changes:**
   - Railway will automatically redeploy
   - Or trigger manual redeploy

---

### 5. Verify SSL Certificate

**Railway automatically provisions SSL:**
- Wait 5-10 minutes after DNS propagates
- Railway will issue Let's Encrypt certificate
- Test: `curl https://mcp.autoagent.ai/health`

**Verify certificate:**
```bash
openssl s_client -connect mcp.autoagent.ai:443 -servername mcp.autoagent.ai
```

---

### 6. Test New Domain

**Run handshake test:**
```bash
bash scripts/testChatGPTHandshake.sh https://mcp.autoagent.ai
```

**Expected:**
- ✅ Health check passes
- ✅ MCP initialize works
- ✅ Tools list works
- ✅ Widget endpoint accessible

---

### 7. Update ChatGPT Connector

**Use new URL:**
```
https://mcp.autoagent.ai/mcp
```

**Important:**
- Use `https://` (not `http://`)
- Include `/mcp` path
- No trailing slash

---

## Verification Checklist

- [ ] Domain purchased/configured
- [ ] DNS records added at registrar
- [ ] DNS propagation complete (check with `nslookup`)
- [ ] Domain added in Railway dashboard
- [ ] SSL certificate issued (check with `openssl`)
- [ ] `WIDGET_HOST` updated in Railway
- [ ] Service redeployed
- [ ] Handshake test passes
- [ ] ChatGPT connector uses new URL

---

## Troubleshooting

### DNS Not Resolving

**Check:**
```bash
nslookup mcp.autoagent.ai
dig mcp.autoagent.ai
```

**If not resolving:**
- Wait longer (DNS can take up to 48 hours, usually 5-60 minutes)
- Check DNS records are correct
- Verify domain registrar settings

### SSL Certificate Not Issued

**Check:**
```bash
curl -I https://mcp.autoagent.ai/health
```

**If certificate error:**
- Wait 10-15 minutes after DNS propagation
- Railway needs time to provision certificate
- Check Railway dashboard for certificate status

### Service Not Responding

**Check:**
```bash
curl https://mcp.autoagent.ai/health
```

**If 502/503:**
- Verify service is running in Railway
- Check Railway logs for errors
- Ensure `WIDGET_HOST` is set correctly

---

## Example Configuration

**Domain:** `mcp.autoagent.ai`

**Railway DNS:**
```
Type: CNAME
Name: mcp
Value: cname.railway.app
```

**Environment Variable:**
```
WIDGET_HOST=https://mcp.autoagent.ai
```

**ChatGPT Connector URL:**
```
https://mcp.autoagent.ai/mcp
```

---

## Benefits of Custom Domain

1. **Reliability:** More reliable DNS resolution
2. **Professional:** Better for production use
3. **Compatibility:** Works with services that block Railway subdomains
4. **Branding:** Uses your own domain name
5. **Flexibility:** Easier to migrate if needed

---

**Last Updated:** 2025-11-13

