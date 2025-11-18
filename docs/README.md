# AutoAgent Documentation Hub

This hub keeps Cursor/Codex agents oriented. Start here, follow the reading order, and jump to deeper guides as needed.

## Reading Order
1. **Quick Start Checklist** → `quickstart.md`  
   Covers environment setup, critical commands, and current deployment endpoints.
2. **System Overview** → `overview.md`  
   Explains architecture, core features, diagnostics, and current state.
3. **API & MCP Contract** → `api.md`  
   JSON-RPC methods, schemas, sample payloads, and error handling.
4. **MarketCheck Endpoint Guide** → `api/marketcheck-endpoints.md`  
   REST parameters, response shapes, and integration notes for MarketCheck inventory APIs.
5. **Supabase Setup** → `apps/dealer-dashboard/docs/SUPABASE_SETUP.md`  
   Defines the tables used by dashboard onboarding (MarketCheck sync, billing banner, inventory listings).

## Current Onboarding Focus
- Inventory sync is currently MarketCheck-only. `/app/setup` triggers a MarketCheck import, `/app/inventory` lists vehicles, and `/app/leads` reflects progress.
- Billing activation and additional DMS connectors (CDK, vAuto) are on deck; check the changelog for the latest roadmap.

## Deployment Guides
- **Production Playbook** → `deployment/production.md`  
  Full-stack production architecture, monitoring, security, CI/CD.
- **Railway Deployment** → `deployment/railway.md`  
  Railway-specific configuration, env vars, and verification steps.

## Operations & Support
- **OpenAI Support Evidence Pack** → `operations/openai-support-ticket.md`  
  Incident write-up, diagnostic proof, and command log for ChatGPT timeout investigations.

## History & Change Tracking
- **Release Notes** → `../CHANGELOG.md`  
  Chronological record of milestones and feature additions.

## Suggested Workflow for New Agents
1. Run through the quick start checklist and confirm the MCP server is reachable.
2. Skim the overview to understand the system boundaries and diagnostics.
3. Review the API contract before modifying tools or widgets.
4. Consult deployment docs before touching infrastructure changes.
5. Check the changelog for context on recent work or outstanding initiatives.

Happy shipping!
