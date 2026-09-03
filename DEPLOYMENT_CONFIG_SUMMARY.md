# AutoAgent Deployment Configuration Summary

## 📋 Project Analysis from Codebase

### 1. **Project Type** ✅ DETERMINED
**Answer: Both applications need to be deployed**
- **Next.js 15 Dashboard** (`apps/dealer-dashboard`): Dealer SaaS dashboard with Supabase auth, onboarding flow, inventory management
- **Node.js/TypeScript MCP Server** (`apps/mcp-server`): Express server implementing MCP protocol, vehicle search tools, and lead submission

**Deployment Strategy:**
- **Option A (Recommended)**: Deploy dashboard to Vercel, MCP server to Railway
- **Option B**: Deploy both using Docker Compose on a VPS (DigitalOcean, AWS EC2, etc.)
- **Option C**: Deploy both to Railway as separate services

---

### 2. **Tools & Frameworks** ✅ DETERMINED

#### Package Manager
- **pnpm 8.15.0** (monorepo with Turborepo)
- **Node.js 20+** required

#### Build Tools
- **Next.js 15** build system for dashboard
- **TypeScript** compilation for both apps
- **Turborepo** for monorepo orchestration
- Build commands:
  - Dashboard: `pnpm --filter @autoagent/dealer-dashboard build`
  - MCP Server: `pnpm --filter @autoagent/mcp-server build`

#### Databases
- **Supabase** (cloud-hosted PostgreSQL) for dashboard:
  - Authentication
  - User profiles (`profiles` table)
  - Inventory vehicles (`inventory_vehicles` table)
  - Project ID: `vqoawedqmeybbndvqxta` (from docs)
- **SQLite** (better-sqlite3) for MCP server:
  - Local file-based database
  - Requires persistent volume in production
  - Consider migrating to Postgres for production

#### Environment Variables Required

**Dealer Dashboard (Next.js):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
# Note: NEXT_PUBLIC_ prefix required for client-side access
```

**MCP Server:**
```bash
PORT=8787
MARKETCHECK_API_KEY=<your_marketcheck_api_key>
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
LEAD_ENC_KEY=<32_byte_base64_encryption_key>
DASHBOARD_INGEST_URL=https://your-dashboard-domain.com/api/ingest/lead
DASHBOARD_INGEST_TOKEN=<secure_token>
WIDGET_HOST=https://your-mcp-server-domain.com
AA_DIAG=1
OPENAI_APP_NAME=Drevvy
```

**Optional (for future Postgres migration):**
```bash
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://your-redis-host:6379
LOG_LEVEL=info
```

#### External Services
- **MarketCheck API**: Vehicle inventory data
- **Supabase**: Authentication and database
- **OpenAI ChatGPT**: MCP integration (consumes the MCP server)

---

### 3. **GitHub Repository** ❓ NEEDS CONFIRMATION
**Status: Unknown**
- No `.github` workflows found in codebase
- Repository may not be pushed to GitHub yet
- **Action Required**: Confirm if repository exists and provide URL

---

### 4. **Hosting Platform Preference** ⚠️ PARTIALLY DETERMINED

#### Current Configuration Detected:
- **Railway**: `railway.json` files exist for both apps
  - MCP Server: `railway.json` (root level)
  - Dashboard: `apps/dealer-dashboard/railway.json`
- **Docker**: `Dockerfile` and `docker-compose.yml` configured
- **Nginx**: Reverse proxy configuration exists (`nginx.conf`)

#### Recommended Deployment Strategy:

**Option 1: Vercel + Railway (Recommended)**
- **Dashboard → Vercel**: Best for Next.js apps, automatic HTTPS, edge functions, zero config
- **MCP Server → Railway**: Good for Node.js APIs, automatic HTTPS, persistent volumes for SQLite

**Option 2: Railway for Both**
- Both apps deploy to Railway as separate services
- Railway provides automatic HTTPS and domain
- Good for monorepo deployment

**Option 3: Docker Compose on VPS**
- Deploy both apps using Docker Compose
- Requires manual SSL certificate setup (Let's Encrypt)
- More control but more maintenance

**Option 4: AWS/GCP/Azure**
- More complex setup
- Better for enterprise-scale deployments
- Requires more infrastructure management

**Recommendation**: Start with **Option 1 (Vercel + Railway)** for easiest deployment and best performance.

---

### 5. **Domain Registration** ❓ NEEDS CONFIRMATION
**Status: Unknown**
- **Action Required**: Provide domain name and registrar (GoDaddy, Namecheap, Cloudflare, etc.)
- Domain configuration will depend on hosting platform choice

**Domain Setup Requirements:**
- Main domain for dashboard (e.g., `dashboard.autoagent.com`)
- Subdomain for MCP server (e.g., `api.autoagent.com` or `mcp.autoagent.com`)
- Or single domain with path-based routing

---

### 6. **Additional Requirements** ✅ PARTIALLY DETERMINED

#### HTTPS/SSL: ✅ REQUIRED
- **Nginx configuration** shows SSL is required (redirects HTTP → HTTPS)
- **Railway**: Automatic SSL certificates
- **Vercel**: Automatic SSL certificates
- **Custom domain**: Will need SSL certificate (automatic with Vercel/Railway, manual with VPS)

#### Environment Variables: ✅ REQUIRED
- All environment variables listed above must be configured
- **Supabase**: Already configured (project exists)
- **MarketCheck API**: Need production API key
- **Lead Encryption**: Need to generate `LEAD_ENC_KEY` (32-byte base64)

#### CI/CD Setup: ⚠️ RECOMMENDED
- **Current Status**: No GitHub Actions workflows found
- **Recommendation**: Set up GitHub Actions for:
  - Automated testing
  - Automated deployment on push to main
  - Environment variable management

#### Database Hosting: ⚠️ NEEDS DECISION
- **Supabase**: Already cloud-hosted ✅
- **SQLite (MCP Server)**: 
  - **Option A**: Use persistent volume (Railway, Docker volume)
  - **Option B**: Migrate to Postgres (Railway Postgres, Supabase, or external)
  - **Recommendation**: Start with persistent volume, migrate to Postgres later for scalability

#### Monitoring & Logging: ⚠️ OPTIONAL
- **Prometheus**: Configuration exists (`prometheus.yml`)
- **Health Checks**: `/health` endpoint configured
- **Logging**: Pino logger configured in MCP server
- **Recommendation**: Enable monitoring in production

#### Rate Limiting: ✅ CONFIGURED
- Nginx rate limiting: 10 requests/second
- Can be enhanced with Redis for distributed rate limiting

#### CORS Configuration: ✅ CONFIGURED
- Nginx configured for ChatGPT integration
- CORS headers allow `*` (consider restricting in production)

---

## 🎯 Deployment Checklist

### Pre-Deployment
- [ ] Confirm GitHub repository exists and is accessible
- [ ] Generate `LEAD_ENC_KEY` (32-byte base64): `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- [ ] Obtain production `MARKETCHECK_API_KEY`
- [ ] Confirm Supabase project credentials
- [ ] Set up production Supabase redirect URLs
- [ ] Run Supabase migrations (`apps/dealer-dashboard/supabase/migrations/`)
- [ ] Choose hosting platform (Vercel + Railway recommended)
- [ ] Confirm domain name and registrar

### Deployment Steps (Vercel + Railway)
- [ ] Deploy dashboard to Vercel
- [ ] Configure Vercel environment variables
- [ ] Deploy MCP server to Railway
- [ ] Configure Railway environment variables
- [ ] Set up custom domains
- [ ] Configure DNS records
- [ ] Update `DASHBOARD_INGEST_URL` with production dashboard URL
- [ ] Update `WIDGET_HOST` with production MCP server URL
- [ ] Test health endpoints
- [ ] Test MCP integration with ChatGPT
- [ ] Test dashboard authentication
- [ ] Test lead submission flow

### Post-Deployment
- [ ] Set up monitoring and alerts
- [ ] Configure CI/CD pipeline
- [ ] Set up database backups
- [ ] Document production URLs and credentials
- [ ] Test end-to-end workflow

---

## 📝 Summary for ChatGPT Deployment Prompt

**Project Type**: Monorepo with Next.js 15 dashboard and Node.js/TypeScript MCP server

**Tools**: pnpm, Turborepo, Next.js 15, TypeScript, Supabase, SQLite, Express

**Deployment Target**: 
- Dashboard: Vercel (recommended) or Railway
- MCP Server: Railway (recommended) or Docker on VPS

**Environment Variables**: 
- Dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- MCP Server: `MARKETCHECK_API_KEY`, `LEAD_ENC_KEY`, `DASHBOARD_INGEST_URL`, `DASHBOARD_INGEST_TOKEN`, `WIDGET_HOST`, etc.

**Database**: 
- Supabase (cloud) for dashboard ✅
- SQLite (needs persistent volume) or migrate to Postgres for MCP server

**Requirements**:
- ✅ HTTPS/SSL required
- ✅ Environment variables required
- ⚠️ CI/CD recommended
- ⚠️ Database migration recommended (SQLite → Postgres)
- ✅ Monitoring recommended

**Still Need**:
- ❓ GitHub repository URL
- ❓ Domain name and registrar
- ❓ Hosting platform confirmation (Vercel + Railway recommended)
- ❓ Production API keys and credentials

---

## 🚀 Next Steps

1. **Confirm GitHub repository** exists and provide URL
2. **Choose hosting platform** (Vercel + Railway recommended)
3. **Provide domain name** and registrar information
4. **Generate production credentials** (LEAD_ENC_KEY, tokens, etc.)
5. **Run Supabase migrations** in production database
6. **Deploy** using platform-specific instructions
7. **Configure DNS** and SSL certificates
8. **Test** end-to-end workflow
9. **Set up monitoring** and CI/CD

---

## 📚 Reference Files

- Deployment docs: `docs/deployment/production.md`, `docs/deployment/railway.md`
- Environment examples: `env.production.example`, `apps/mcp-server/env.example`
- Railway config: `railway.json`, `apps/dealer-dashboard/railway.json`
- Docker config: `Dockerfile`, `docker-compose.yml`, `nginx.conf`
- Supabase setup: `apps/dealer-dashboard/docs/SUPABASE_SETUP.md`

