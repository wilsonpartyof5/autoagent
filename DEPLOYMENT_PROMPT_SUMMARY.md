# Deployment Prompt Summary for ChatGPT

## Project Overview
Drevvy is a monorepo containing:
1. **Next.js 15 Dashboard** (`apps/dealer-dashboard`) - Dealer SaaS dashboard with Supabase auth
2. **Node.js MCP Server** (`apps/mcp-server`) - Express server for ChatGPT integration

## Technical Stack
- **Package Manager**: pnpm 8.15.0 (monorepo with Turborepo)
- **Runtime**: Node.js 20+
- **Frontend**: Next.js 15, React 18, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL) for dashboard, SQLite for MCP server
- **Build Tools**: Turborepo, TypeScript
- **Containerization**: Docker, Docker Compose (configured)

## What to Deploy
**Both applications:**
- Next.js dashboard (dealer portal)
- MCP server (ChatGPT integration API)

## Recommended Hosting Platform
**Option 1 (Recommended)**: Vercel (dashboard) + Railway (MCP server)
- Vercel: Best for Next.js, automatic HTTPS, edge functions
- Railway: Good for Node.js APIs, automatic HTTPS, persistent volumes

**Option 2**: Railway for both (monorepo deployment)
- Both apps as separate Railway services
- Automatic HTTPS and domain

**Option 3**: Docker Compose on VPS (DigitalOcean, AWS EC2, etc.)
- Full control but requires manual SSL setup

## Environment Variables Required

### Dashboard (Next.js)
```
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
```

### MCP Server
```
PORT=8787
MARKETCHECK_API_KEY=<marketcheck_api_key>
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
LEAD_ENC_KEY=<32_byte_base64_key>
DASHBOARD_INGEST_URL=https://your-dashboard-domain.com/api/ingest/lead
DASHBOARD_INGEST_TOKEN=<secure_token>
WIDGET_HOST=https://your-mcp-server-domain.com
AA_DIAG=1
OPENAI_APP_NAME=Drevvy
```

## Database Setup
- **Supabase**: Already cloud-hosted, needs migrations run
- **SQLite**: Requires persistent volume, or migrate to Postgres for production

## Additional Requirements
- ✅ **HTTPS/SSL**: Required (automatic with Vercel/Railway)
- ✅ **Environment Variables**: All listed above
- ⚠️ **CI/CD**: Recommended (GitHub Actions)
- ⚠️ **Database Migration**: Consider SQLite → Postgres for MCP server
- ✅ **Monitoring**: Health checks configured (`/health` endpoint)

## Configuration Files Present
- `railway.json` - Railway deployment config
- `Dockerfile` - Docker container config
- `docker-compose.yml` - Multi-container setup
- `nginx.conf` - Reverse proxy with SSL
- `turbo.json` - Turborepo config
- `apps/dealer-dashboard/railway.json` - Dashboard Railway config

## Build Commands
```bash
# Dashboard
pnpm --filter @autoagent/dealer-dashboard build

# MCP Server
pnpm --filter @autoagent/mcp-server build

# Both
pnpm build
```

## Start Commands
```bash
# Dashboard
pnpm --filter @autoagent/dealer-dashboard start

# MCP Server
pnpm --filter @autoagent/mcp-server start
```

## Still Need Confirmation
- ❓ **GitHub Repository**: Does it exist? What's the URL?
- ❓ **Domain**: What's the domain name? Where is it registered?
- ❓ **Hosting Platform**: Confirm choice (Vercel + Railway recommended)
- ❓ **Production Credentials**: API keys, tokens, encryption keys

## Deployment Priority
1. Deploy dashboard to Vercel (easiest for Next.js)
2. Deploy MCP server to Railway (good for Node.js APIs)
3. Configure custom domains
4. Set up environment variables
5. Run Supabase migrations
6. Test end-to-end workflow
7. Set up CI/CD (optional)
8. Configure monitoring (optional)

## Special Considerations
- **Supabase Redirect URLs**: Must configure production URLs in Supabase dashboard
- **CORS**: Configured for ChatGPT integration
- **Rate Limiting**: Nginx configured (10 req/s)
- **Health Checks**: `/health` endpoint available
- **Widget Embedding**: MCP server serves UI widgets for ChatGPT

## Files to Reference
- `docs/deployment/production.md` - Production deployment guide
- `docs/deployment/railway.md` - Railway-specific guide
- `apps/dealer-dashboard/docs/SUPABASE_SETUP.md` - Supabase configuration
- `env.production.example` - Environment variable template

---

## Prompt for ChatGPT
"Help me deploy my Drevvy monorepo to production. I have a Next.js 15 dashboard and a Node.js MCP server. I want to deploy the dashboard to Vercel and the MCP server to Railway. My domain is [DOMAIN_NAME] registered at [REGISTRAR]. I have a GitHub repository at [REPO_URL]. Please provide step-by-step deployment instructions including:
1. Vercel deployment for Next.js dashboard
2. Railway deployment for MCP server
3. Custom domain configuration
4. Environment variable setup
5. DNS configuration
6. SSL certificate setup
7. Supabase migration steps
8. Testing and verification steps"

