# AutoAgent Markdown Files Summary

This document provides a comprehensive summary of all 72 markdown files in the AutoAgent project, organized by category.

---

## 📋 Table of Contents

1. [Root-Level Documentation](#root-level-documentation)
2. [Core Documentation Hub](#core-documentation-hub)
3. [API Documentation](#api-documentation)
4. [Deployment Documentation](#deployment-documentation)
5. [Testing Documentation](#testing-documentation)
6. [MarketCheck Integration](#marketcheck-integration)
7. [Lead Delivery Documentation](#lead-delivery-documentation)
8. [Design Documentation](#design-documentation)
9. [Operations & Support](#operations--support)
10. [App-Specific Documentation](#app-specific-documentation)

---

## 📄 Root-Level Documentation

### `README.md`
**Purpose**: Main project overview and entry point  
**Key Content**:
- Project description: ChatGPT-native vehicle search and lead generation platform
- Key capabilities (MarketCheck inventory, MCP server, widgets, lead pipeline, dealer dashboard)
- Architecture snapshot (MCP Server, Dealer Dashboard, Shared Package)
- Quick start instructions
- MCP tools and UI resources
- Documentation map
- ChatGPT live test prerequisites and handshake validation
- Troubleshooting guide
- Development scripts
- Inventory sync roadmap

### `CHANGELOG.md`
**Purpose**: Version history and release notes  
**Key Content**:
- Unreleased features (Universal ADF XML Lead Delivery, Lead Delivery Settings, Delivery Logging & Resend, ADF XML Generator, Enhanced Leads Dashboard, Inventory metafields schema, MarketCheck endpoint docs, Dealer dashboard shell, MarketCheck-powered inventory sync, Settings panel)
- Initial 1.0.0 release (Core Features, Technical Achievements, Testing & Quality Assurance, Production Metrics, Deployment Ready, Business Value, Development Journey, Key Technical Decisions, Lessons Learned)

### `DEPLOYMENT_PROMPT_SUMMARY.md`
**Purpose**: Summary for ChatGPT deployment assistance  
**Key Content**:
- Project overview (Next.js dashboard + Node.js MCP server)
- Technical stack details
- What to deploy (both applications)
- Recommended hosting platforms (Vercel + Railway)
- Required environment variables for both apps
- Database setup (Supabase, SQLite)
- Additional requirements (HTTPS/SSL, CI/CD, monitoring)
- Configuration files present
- Build/start commands
- Items needing confirmation (GitHub repo, domain, production credentials)
- Deployment priority

### `DEPLOYMENT_CONFIG_SUMMARY.md`
**Purpose**: Detailed deployment configuration analysis  
**Key Content**:
- Project type analysis
- Tools & frameworks (pnpm, Turborepo, Next.js 15, TypeScript, Supabase, SQLite, Express)
- Required environment variables
- External services
- GitHub repository status (needs confirmation)
- Hosting platform preference (Vercel + Railway recommended)
- Domain registration status (needs confirmation)
- Additional requirements (HTTPS/SSL, CI/CD, database hosting, monitoring, rate limiting, CORS)
- Deployment checklist
- Summary for ChatGPT deployment prompt

---

## 🗂️ Core Documentation Hub

### `docs/README.md`
**Purpose**: Documentation hub and navigation guide  
**Key Content**:
- Reading order for key documentation files
- Current onboarding focus
- Deployment guides references
- Operations & support references
- History & change tracking
- Suggested workflow for new agents

### `docs/overview.md`
**Purpose**: System overview and architecture deep dive  
**Key Content**:
- Product mission
- Architecture & stack (Node.js/Express, OpenAI Apps SDK, SQLite, HTML/Leaflet.js, MarketCheck, libsodium)
- Platform capabilities (Vehicle Search, Interactive Vehicle Widget, Lead Pipeline with ADF XML Delivery, Dealer Dashboard, In-App Inventory Onboarding with MarketCheck sync and listing enrichment)
- Diagnostics & observability
- Testing & verification tools
- Operational snapshot
- Recent fixes & regressions prevented
- Key URLs (current ngrok session)
- Developer field notes
- Roadmap & suggested initiatives

### `docs/quickstart.md`
**Purpose**: Quick start checklist for new sessions  
**Key Content**:
- Current operational snapshot (MCP URL, status, tools)
- Environment setup (install dependencies, copy env files, populate variables)
- Instructions to get MarketCheck Dealer ID
- Inventory sync workflow
- Enrichment details
- Command reference
- Verify stack commands
- Troubleshooting playbook

### `docs/CHATGPT_INTEGRATION_READY.md`
**Purpose**: ChatGPT App integration readiness status  
**Key Content**:
- Status: Ready for live demo
- MarketCheck integration status
- Sync function status
- Onboarding guide references
- Demo inventory status
- Lead delivery status
- Widget readiness
- MCP server handshake status
- Quick start steps
- Verification checklist
- Known issues (MarketCheck API, email delivery, Supabase service role key)
- Files created/modified
- SQL output
- Next steps

### `docs/DEALER_ID_ONBOARDING_UPDATE_SUMMARY.md`
**Purpose**: Summary of MarketCheck Dealer ID onboarding updates  
**Key Content**:
- Changes made to documentation files
- UI component updates
- Confirmed information (contact, prerequisites, implementation status)
- Open questions (MarketCheck portal URL, exact location of Dealer ID, lookup API endpoint, geographic search without Dealer ID)

### `docs/MARKETCHECK_DEALER_ID_VERIFICATION.md`
**Purpose**: MarketCheck Dealer ID enrollment and integration verification report  
**Key Content**:
- Where dealer ID is issued/retrieved (incomplete documentation)
- Lookup status (not implemented)
- Prerequisites (not documented)
- AutoAgent integration (storage, dashboard setup form, settings page, sync code path, missing dealer ID vs ZIP/Radius fallback)
- Documentation alignment
- Critical findings and action items

---

## 🔌 API Documentation

### `docs/api.md`
**Purpose**: AutoAgent API documentation  
**Key Content**:
- Overview
- Base URL
- Authentication
- MCP endpoints (`tools/list`, `tools/call`, `resources/list`, `resources/read`)
- Standard endpoints (`/health`, `/widget/vehicle-results`)
- Data models (Vehicle, Lead)
- Error handling
- Rate limiting
- Security (PII encryption, VIN validation, consent management)
- Environment variables
- Performance
- Testing
- Deployment
- Support

### `docs/api/marketcheck-endpoints.md`
**Purpose**: MarketCheck Cars API v2 endpoints documentation  
**Key Content**:
- `/v2/search/car/active` (primary search, parameters, response structure, pagination, notes)
- Planned endpoints (`/v2/listing/car/{id}`, `/v2/listing/car/{id}/media`, `/v2/listing/car/{id}/extra`, `/v2/dealer/{dealer_id}`)
- General API notes (authentication, rate limiting, error handling, caching, base URL)
- Integration checklist

### `docs/api/marketcheck-audit-summary.md`
**Purpose**: Executive summary of MarketCheck API documentation audit  
**Key Content**:
- Critical findings (endpoint coverage, parameter issues, response structure)
- Required edits to `marketcheck-endpoints.md`
- Validation checklist
- Questions to resolve

### `docs/api/marketcheck-audit-report.md`
**Purpose**: Detailed MarketCheck API documentation audit report  
**Key Content**:
- Comparison against actual codebase usage
- Official MarketCheck API documentation patterns
- Required metafields
- Endpoint coverage
- Detailed audit of `/v2/search/car/active` (parameters, response structure, pagination)
- Audits of unused endpoints
- Critical gaps
- Recommended actions
- Questions for product/engineering

---

## 🚀 Deployment Documentation

### `docs/deployment/production.md`
**Purpose**: Production deployment guide  
**Key Content**:
- Production architecture (MCP Server, Nginx, Prometheus, Docker)
- Quick start (local production)
- Cloud deployment options (AWS ECS, Google Cloud Run, Railway)
- Production configuration (environment variables, SSL/TLS)
- Monitoring & alerting
- Security best practices
- CI/CD pipeline
- Troubleshooting
- Scaling
- ChatGPT integration
- Maintenance

### `docs/deployment/railway.md`
**Purpose**: Railway deployment summary  
**Key Content**:
- Completed tasks (repository setup, Railway configuration, environment variables, documentation updates, local testing)
- Next steps for Railway deployment (push to GitHub, deploy on Railway, configure environment variables, verify deployment)
- Railway configuration
- Important notes

### `docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md`
**Purpose**: Step-by-step Railway deployment guide  
**Key Content**:
- Prerequisites
- Pre-deployment review (configuration files, required environment variables)
- Railway deployment steps
- Environment variables configuration
- Post-deployment verification
- Hand-off checklist
- Additional notes on Railway's features
- Troubleshooting

### `docs/deployment/RAILWAY_DEPLOYMENT_STATUS.md`
**Purpose**: Railway deployment status report  
**Key Content**:
- Status: Manual Deployment Required
- Completed pre-deployment checklist items
- Required but not verified items (Railway account, Supabase env vars, Railway deployment)
- Blocking issues
- Deployment instructions
- Environment variables reference
- Next steps

### `docs/deployment/RAILWAY_ENV_VARS_STATUS.md`
**Purpose**: Railway environment variables status  
**Key Content**:
- Status: All values configured - Production deployment complete
- All found values
- Configured production URLs (`DASHBOARD_INGEST_URL`, `WIDGET_HOST`)
- Copy-paste ready formats
- Details on where values were found
- Values still needed
- Next steps to complete deployment

### `docs/deployment/RAILWAY_DEPLOYMENT_MONITORING.md`
**Purpose**: Guide on monitoring Railway deployments  
**Key Content**:
- Prerequisites (CLI or Dashboard)
- Monitoring deployment status (CLI, Dashboard, monitoring script)
- Deployment workflow (after each code push, if deployment doesn't start)
- Troubleshooting
- Monitoring checklist
- Quick commands

### `docs/deployment/RAILWAY_MANUAL_REBUILD.md`
**Purpose**: Instructions for manually rebuilding on Railway  
**Key Content**:
- Options via Railway Dashboard
- Railway CLI option
- Checking GitHub Webhook
- Verification steps
- Current latest commit

### `docs/deployment/RAILWAY_LOGS_MONITORING.md`
**Purpose**: Guide on monitoring Railway logs during ChatGPT connector creation  
**Key Content**:
- Steps to open dashboard
- Watch for incoming requests
- Check request details
- Interpret results (request appears vs no request)
- What to capture
- Quick checklist
- Current server status
- Example log patterns
- Custom domain solution if requests don't reach Railway

### `docs/deployment/CUSTOM_DOMAIN_SETUP.md`
**Purpose**: Step-by-step guide for setting up custom domain for Railway MCP server  
**Key Content**:
- Purchasing a domain
- Configuring in Railway
- Setting up DNS records
- Updating environment variables
- Verifying SSL
- Testing the new domain
- Updating the ChatGPT connector
- Verification checklist
- Troubleshooting tips

### `docs/deployment/CHATGPT_CONNECTIVITY_VERIFICATION.md`
**Purpose**: Guide for verifying ChatGPT connectivity  
**Key Content**:
- HTTPS certificate verification
- Endpoint response times
- URL format verification
- DNS resolution
- Railway logs monitoring
- Network accessibility
- Custom domain as fallback
- Troubleshooting steps for connector timeouts
- Quick test commands

### `docs/deployment/URL_VALIDATION_FIX.md`
**Purpose**: Documents fix for Zod URL validation failing on widget URLs  
**Key Content**:
- Problem description
- Root cause (strict Zod validation with template literals)
- Solution (using `URL` API with `URLSearchParams` for proper encoding)
- Files changed
- Benefits
- Testing instructions

### `docs/deployment/TIMEOUT_INVESTIGATION_REPORT.md`
**Purpose**: Executive summary of production MCP server timeout investigation  
**Key Content**:
- Conclusion: Service is healthy and all handshake tests pass, no timeout errors detected
- Deployment verification
- Handshake test results
- Service responsiveness
- Recent fixes applied
- Log monitoring instructions
- Known issues (URL validation error in `search-vehicles` tool)
- Recommendations

### `docs/deployment/autoagent-deployment-plan.md`
**Purpose**: Comprehensive production-ready deployment strategy  
**Key Content**:
- Project overview
- Hosting architecture (Vercel, Railway, Supabase)
- Architecture diagram
- Environment strategy
- Deployment workflow (GitHub Actions, Railway automatic deployment)
- Domain connection
- Security & compliance
- Scaling path
- Testing & validation
- Checklist summary
- Next steps

---

## 🧪 Testing Documentation

### `docs/testing/README_FOR_NEXT_AGENT.md`
**Purpose**: Quick start guide for next agent  
**Key Content**:
- Files to read in order
- Additional reference files
- Quick actions
- Key files modified/created
- Key takeaways
- Important links
- Quick commands

### `docs/testing/CONVERSATION_SUMMARY.md`
**Purpose**: Summarizes conversation about ChatGPT app smoke test and timeout investigation  
**Key Content**:
- Key accomplishments (smoke test documentation, execution, timeout investigation, solution recommendations)
- Current status (MCP server, ngrok tunnel, ChatGPT connector, tool status)
- Key files created/modified
- Technical details
- Next steps (upgrade ngrok or deploy to production)
- Troubleshooting

### `docs/testing/SOLUTION_SUMMARY.md`
**Purpose**: Quick summary of timeout solution  
**Key Content**:
- Root cause (ngrok free tier 60-second timeout + ChatGPT timeout threshold)
- Primary solution (upgrade ngrok plan)
- Quick fix steps
- Alternative (deploy to production)
- Current status

### `docs/testing/PRIMARY_SOLUTION_TIMEOUT.md`
**Purpose**: Details primary solution for ChatGPT timeout issue  
**Key Content**:
- Root cause summary (ngrok free tier 60-second timeout)
- Log evidence (MCP server performance, ngrok status, ChatGPT requests)
- Primary solution (upgrade ngrok plan)
- Alternative solutions (optimize tool execution, alternative tunnel, deploy to production)
- Immediate actions
- Recommended fix priority
- Testing after fix

### `docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md`
**Purpose**: Detailed timeout diagnosis report for ngrok setup  
**Key Content**:
- Conclusion: MCP server is healthy and responding quickly, timeout likely at ngrok free tier layer or ChatGPT's threshold
- Evidence (server performance, ngrok tunnel status, ChatGPT requests, direct curl test)
- Root cause analysis
- Log excerpts
- Recommended investigation steps
- Immediate actions
- Potential fixes
- Next steps

### `docs/testing/TIMEOUT_DIAGNOSIS.md`
**Purpose**: ChatGPT MCP server timeout diagnosis report for Cloudflare Tunnel setup  
**Key Content**:
- Root cause: Cloudflare Tunnel timeout
- Findings (MCP server status, Cloudflare Tunnel status, handshake test, tool execution test, widget URL issue)
- Root cause analysis
- Log excerpts
- Recommended fixes
- Next steps
- Verification commands

### `docs/testing/CHATGPT_SMOKE_TEST_EXECUTION.md`
**Purpose**: Step-by-step execution guide for ChatGPT smoke test  
**Key Content**:
- Prerequisites
- Starting the MCP server
- Starting the HTTPS tunnel (ngrok)
- Updating `WIDGET_HOST`
- Running the handshake test script
- Configuring the ChatGPT connector
- Manual QA testing in ChatGPT (vehicle search, lead submission)
- Troubleshooting guide
- Final checklist

### `docs/testing/QUICK_START_CHATGPT.md`
**Purpose**: Quick start guide for testing in ChatGPT  
**Key Content**:
- Steps to start MCP server
- Start ngrok tunnel
- Update `WIDGET_HOST`
- Get MCP server URL for ChatGPT
- Configure ChatGPT connector
- Test in ChatGPT
- Troubleshooting tips
- Quick reference

### `docs/testing/SMOKE_TEST_EXECUTION_LOG.md`
**Purpose**: Execution log for ChatGPT smoke test  
**Key Content**:
- Completed steps (inventory verification)
- Pending steps (start MCP server, start dashboard, start ngrok, run handshake test, configure ChatGPT connector, E2E search, E2E lead submission)
- Troubleshooting tips
- Test results summary

### `docs/testing/chatgpt-smoke-test.md`
**Purpose**: Comprehensive smoke test checklist (referenced in other docs)

---

## 🚗 MarketCheck Integration

### `docs/marketcheck/STATUS.md`
**Purpose**: Current status of MarketCheck sync  
**Key Content**:
- Active test dealer (My Rock Hill GMC)
- Previous dealer (Ask Jorge Lopez)
- Rock Hill GMC status
- Sync function status
- Onboarding status
- Dashboard flow status
- Provider selector status
- Multi-dealership support status
- Pending migrations/profile updates/sync execution/inventory verification
- Evidence
- Multi-dealership feature details
- Pending actions
- Demo workaround
- Helpful files
- Next steps

### `docs/marketcheck/MULTI_DEALERSHIP_TEST_SUMMARY.md`
**Purpose**: Summary of multi-dealership feature implementation  
**Key Content**:
- Status: Complete
- Implementation checklist (database schema, data layer, server actions, UI components, data scoping)
- Manual test scenarios
- Known limitations
- Next steps (optional enhancements)
- Files modified/created

### `docs/marketcheck/MULTI_DEALERSHIP_FEATURE.md`
**Purpose**: Documents multi-dealership feature  
**Key Content**:
- Overview
- Key features (dealership management, store switcher, scoped data, onboarding updates)
- Database schema
- RLS policies
- Migrations
- API changes (server actions, helper functions)
- UI changes
- Usage examples
- Testing
- Migration notes
- Future enhancements
- Related files
- Troubleshooting

### `docs/marketcheck/dealer-sync-ask-jorge-lopez.md`
**Purpose**: Documents MarketCheck dealer sync test for "Ask Jorge Lopez" dealer  
**Key Content**:
- Test execution summary
- Dealer selection process
- AutoAgent sync process
- Data mapping & normalization
- Sync execution attempt
- API route sync attempt
- Supabase query results
- Sync execution results
- Rooftop auto-detection
- Zero vehicles issue investigation

### `docs/marketcheck/ONBOARDING_COMPLETION_SUMMARY.md`
**Purpose**: Summarizes completion of Rock Hill GMC onboarding  
**Key Content**:
- Accomplishments (database migrations, inventory sync, issues fixed, inventory display)
- Issues and fixes (missing lead delivery columns, image hostname not configured)
- Technical details
- Files created/modified
- Verification
- Next steps
- Key learnings
- Success metrics

### `docs/marketcheck/ONBOARDING_REPORT.md`
**Purpose**: Implementation report for Rock Hill GMC onboarding  
**Key Content**:
- Completed tasks (server setup, database migration preparation, API verification, sync function enhancement, scripts and tools, documentation created/updated)
- Pending manual steps (migrations, user authentication, profile update, sync execution, inventory verification, documentation updates)

### `docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md`
**Purpose**: Complete summary of Rock Hill GMC onboarding  
**Key Content**:
- Completed tasks (server setup, API verification, sync function enhancement, scripts and tools, documentation)
- Pending manual steps (migrations, user authentication, profile update, run sync, verify inventory, document results)
- Quick reference
- Troubleshooting

### `docs/marketcheck/ONBOARDING_EXECUTION_LOG.md`
**Purpose**: Execution log template for Rock Hill GMC onboarding  
**Key Content**:
- Prerequisites
- Steps for database migrations
- Server status
- User authentication
- Profile update
- Sync execution
- Inventory verification
- Documentation updates
- Notes and actual logs/results sections

### `docs/marketcheck/MIGRATION_INSTRUCTIONS.md`
**Purpose**: Database migration instructions for Rock Hill GMC onboarding  
**Key Content**:
- Overview
- Migration files
- Quick start (consolidated migration)
- Alternative (individual migrations)
- Verification
- Troubleshooting
- Next steps

### `docs/marketcheck/SYNC_TROUBLESHOOTING.md`
**Purpose**: Troubleshooting guide for sync issues  
**Key Content**:
- Specific issue: "Sync returns 0 vehicles but API test works"
- Root causes (validation error, database schema missing)
- Symptoms
- Diagnosis
- Troubleshooting steps
- Common issues
- Expected behavior
- Next steps

### `docs/marketcheck/SYNC_ZERO_VEHICLES_FIX.md`
**Purpose**: Documents fix for "Imported 0 vehicles" issue  
**Key Content**:
- Root causes (validation error, database schema missing)
- Solution steps (run migrations, refresh schema cache, verify schema, restart server, try sync again)
- Expected results
- Verification
- Files modified

### `docs/marketcheck/PROFILE_UPDATE_ERROR_DIAGNOSIS.md`
**Purpose**: Diagnoses "Unable to update dealer profile" error  
**Key Content**:
- Changes made (enhanced logging in sync action and profile update function)
- How to capture the error
- Expected error scenarios
- Root cause hypotheses
- Next steps
- Files modified

### `docs/marketcheck/SYNC_TEST_RESULTS.md`
**Purpose**: Reports MarketCheck sync test results  
**Key Content**:
- Environment configuration (API key missing, "fetch failed" error diagnosis)
- Profile update failure
- Sync execution results (console log, screenshots, observations)
- Success criteria

### `docs/marketcheck/SYNC_EXECUTION_LOG.md`
**Purpose**: Execution log for MarketCheck sync  
**Key Content**:
- Pre-sync configuration
- Sync execution steps
- Expected results (console log, detailed fetch logs, inventory page)
- Screenshots required
- Known quirks
- Troubleshooting
- Post-sync verification

### `docs/marketcheck/env-setup.md`
**Purpose**: Guide for MarketCheck environment variable setup  
**Key Content**:
- Required variables for dealer dashboard
- Required variables for MCP server
- Setup instructions
- Verification
- Security notes
- Troubleshooting

### `docs/marketcheck/ROOFTOP_DETECTION_SUMMARY.md`
**Purpose**: Summarizes rooftop auto-detection implementation  
**Key Content**:
- What changed (server action, UI component, sync action integration, profile persistence, documentation)
- How to test
- Code quality
- Open questions
- Next steps
- Files modified

### `docs/marketcheck/rooftop-auto-detection.md`
**Purpose**: Documents MarketCheck rooftop auto-detection feature  
**Key Content**:
- Overview
- How it works (dealer ID entry, UI flow, profile persistence)
- Implementation details (server action, UI component, sync action integration)
- Testing
- Benefits
- Limitations
- Future enhancements
- Related documentation

### `docs/marketcheck/rock-hill-verification.md`
**Purpose**: Summarizes MarketCheck Rock Hill Buick GMC verification  
**Key Content**:
- Test execution summary
- Prerequisites status
- Script execution output (first, second, third attempts)
- Error analysis
- Final status
- Script updates made
- Next steps required
- AutoAgent import logic integration

### `docs/marketcheck/ZERO_VEHICLES_DEBUG.md`
**Purpose**: Debug documentation for zero vehicles issue

### `docs/marketcheck/SYNC_INSTRUCTIONS.md`
**Purpose**: Sync instructions documentation

### `docs/marketcheck/ONBOARDING_SUMMARY.md`
**Purpose**: General onboarding summary

### `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md`
**Purpose**: Step-by-step onboarding guide for Rock Hill GMC

### `docs/marketcheck/screenshots/README.md`
**Purpose**: Describes screenshots folder

### `docs/enrichment-sync-test-report.md`
**Purpose**: Executive summary of MarketCheck enrichment sync test report  
**Key Content**:
- Environment configuration
- UI controls audit
- Expected log output
- UI display verification (dashboard inventory cards, ChatGPT widget)
- Potential issues identified
- Manual testing instructions
- Test checklist

### `docs/enrichment-test-notes.md`
**Purpose**: Notes from MarketCheck enrichment test  
**Key Content**:
- Test setup
- Execution
- Expected log output
- UI display locations
- Potential issues to watch for
- UI polish recommendations
- No dealer-facing toggle
- Test results
- Next steps

### `docs/enrichment-test-results.md`
**Purpose**: Summarizes MarketCheck enrichment test results  
**Key Content**:
- Environment setup
- Code review findings (UI controls, seller comments display, option packages display, enriched photos display, layout & responsiveness)
- Log output structure
- Testing checklist
- Next steps

---

## 📧 Lead Delivery Documentation

### `docs/lead-delivery/STATUS.md`
**Purpose**: Lead delivery overhaul status  
**Key Content**:
- Objective: Replace bespoke CRM integrations with universal ADF XML push
- Work breakdown (Dashboard settings, ADF payload generator, Delivery service, Delivery logging, Resend workflow, Documentation & QA)
- Implementation summary
- Files created/modified
- Current notes
- Testing status
- Next steps

### `docs/lead-delivery/adf-payload.md`
**Purpose**: ADF XML format and CRM integration documentation

---

## 🎨 Design Documentation

### `docs/design/landing/loveable-hero-spec.md`
**Purpose**: Full specification for Loveable.dev handoff for AutoAgent landing-page hero section  
**Key Content**:
- Color tokens
- Typography
- Spacing & layout
- Effects & shadows
- CTA state table
- Gradient implementation
- Change checklist
- Implementation notes recap
- Reference files

### `docs/design/landing/spec.md`
**Purpose**: Brief to recreate Loveable prototype for AutoAgent landing page  
**Key Content**:
- Assets & references
- Page overview
- Content bible (Hero, Features, Benefits, Final CTA, Footer)
- Design tokens & utilities
- Responsive behavior
- Interaction notes
- Implementation notes
- Build & validation
- Implementation checklist

### `docs/design/landing/agent-prompt.md`
**Purpose**: Prompt given to Cursor Agent for building AutoAgent landing page  
**Key Content**:
- Goal
- Files & references
- Requirements (create page, break into components, apply copy, match layout/responsive, implement Tailwind utilities, wire CTA links, ensure responsiveness, update Tailwind config/global CSS, run lint/build, provide manual test notes)
- Deliverables

### `docs/design/landing/assets/README.md`
**Purpose**: Describes design reference assets folder  
**Key Content**:
- `landing.png` as high-resolution screenshot from Loveable prototype

### `docs/design/onboarding/loveable-onboarding-spec.md`
**Purpose**: Authoritative transcription of onboarding experience generated in Lovable preview  
**Key Content**:
- Flow
- Global layout
- Header section
- Progress bar
- Step indicators
- Content card
- Step specifications (Connect Your Inventory, Add Team Members, Set Up Billing, Activation Confirmation)
- Buttons & interactions
- Data model & API notes
- Animations & responsive behavior
- Assets & utilities
- Implementation checklist

---

## 🔧 Operations & Support

### `docs/operations/openai-support-ticket.md`
**Purpose**: OpenAI support ticket for ChatGPT App creation timeout  
**Key Content**:
- Technical evidence that MCP server is fully operational with no infrastructure issues
- Executive summary
- Technical evidence (server health, MCP protocol compliance, endpoint performance, tool performance, available tools, widget & beacon functionality, network & tunnel health)
- ChatGPT request analysis
- Diagnostic commands & results
- Server logs evidence
- Tool response evidence
- Conclusion
- Request for investigation

---

## 📱 App-Specific Documentation

### `apps/dealer-dashboard/docs/SUPABASE_SETUP.md`
**Purpose**: Supabase configuration guide  
**Key Content**:
- Redirect origins configuration
- Profiles table setup (SQL snapshot, usage example)
- Inventory table snapshot
- Environment variables

---

## Root-Level Documentation

#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
### `scripts/debug-sync-error.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- Steps to Reproduce Locally
- 1. Check Environment Variables
- 2. Start Local Development Server
- 3. Start MCP Server (if testing against local instance)

## `scripts/README_MARKDOWN_UPDATER.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Usage
- One-time Update
- Watch Mode
- How It Works

## `apps/mcp-server/test/STRICT_VALIDATION_README.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Running Tests
- Run all tests
- Run only strict validation tests
- Run tests in watch mode

## `apps/mcp-server/src/ui/README.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Data Sourcing
- Vehicle Data
- Globals Synchronization
- Lead Submission

## `apps/dealer-dashboard/QUICK_START_INGESTION.md`
**Purpose**: Documentation file
**Key Content**:
- 🚀 Quick Setup (5 minutes)
- 1. Set Environment Variables
- 2. Deploy
- 3. Test
- 📋 What Was Added

## `apps/dealer-dashboard/DEPLOYMENT_CHECKLIST.md`
**Purpose**: Documentation file
**Key Content**:
- Pre-Deployment
- 1. Environment Variables - MCP Server (Railway)
- 2. Environment Variables - Dealer Dashboard (Vercel)
- 3. Verify Code Changes
- Deployment Steps

## `apps/autoagent-app/README.md`
**Purpose**: Documentation file
**Key Content**:
- File Structure
- Source of Truth
- Schema Synchronization
- Validation
- Tools Defined

## `WATCH_LOGS_REALTIME.md`
**Purpose**: Documentation file
**Key Content**:
- I'll Monitor While You Click the Button
- Option 1: Share Logs as You See Them
- Option 2: Try Railway API (if token available)
- Ready to Monitor

## `VERCEL_DOMAIN_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status (2025-11-18)
- Deployment URLs
- Current Behavior
- Issue
- Marketing Landing Page Status

## `VERCEL_DEPLOYMENT_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Required Action: Configure via Vercel Dashboard
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration
- Step 3: Trigger Fresh Deployment

## `VERCEL_DEPLOYMENT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Status
- Latest Successful Deployment
- Configuration
- Domain Verification
- Apex Domain: `autoagentapp.com`

## `VERCEL_DEPLOYMENT_INSTRUCTIONS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Required Vercel Dashboard Configuration
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration
- Step 3: Trigger Fresh Deployment

## `VERCEL_DEPLOYMENT_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Issue
- Solution: Configure via Vercel Dashboard
- Alternative: Deploy from Root Directory
- Quick Fix Command
- Current Deployment URLs

## `VERCEL_DEPLOYMENT_FINAL_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Current Issue
- Required Vercel Dashboard Configuration
- Settings → General
- Why This Configuration Works

## `UVS_FK_VERIFICATION_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Code Verification Complete
- Metrics Endpoints - Verified ✅
- Dashboard UI - Verified ✅
- ⚠️ Database Migration - Action Required
- Migration File

## `UVS_FK_ALIGNMENT_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Changes Made
- 1. Database Schema
- 2. Metrics API Endpoints
- `/api/metrics/leads` (Updated)

## `TEST_VERIFICATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Test Results Summary
- Test Coverage Verification
- ✅ Valid Payloads (7 tests)
- ✅ Required Blocks Validation (6 tests)
- ✅ Enum Validation (6 tests)

## `SYNC_ERROR_FIX_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Summary
- Root Cause Analysis
- Required Environment Variables (Railway MCP Server):
- Error Flow:
- Solution Steps

## `SYNC_ERROR_DEBUG_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Changes Made
- 1. Enhanced Error Logging (`apps/dealer-dashboard/src/app/app/setup/actions.ts`)
- Next Steps to Find the Error
- Option 1: Reproduce Locally (Recommended)

## `STRICT_VALIDATION_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Build Status
- Shared Package Build
- Exports Verification
- ✅ Implementation Verification
- 1. Orchestrator Integration (`apps/mcp-server/src/ingestion/orchestrator.ts`)

## `STRICT_VALIDATION_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Implementation Summary
- 1. Strict Zod Schemas ✅
- 2. Updated Validation ✅
- 3. Provider Mapper Integration ✅

## `RAILWAY_LOG_CAPTURE_INSTRUCTIONS.md`
**Purpose**: Documentation file
**Key Content**:
- Railway CLI Authentication Required
- Option A: Railway CLI (Manual Login)
- Option B: Railway Dashboard (Easiest)
- Step 1: Prepare to Capture Error
- Step 2: Run Diagnostic Script (Triggers Error)

## `RAILWAY_DEPLOY_METHOD.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Primary Method: GitHub Push → Railway Auto-Deploy
- How It Works
- Documentation References
- Railway Deployment (Automatic)

## `QUICK_ERROR_CHECK.md`
**Purpose**: Documentation file
**Key Content**:
- What Error Did You See?
- Check Logs Now - 3 Options:
- Option 1: Vercel Dashboard (FASTEST - 30 seconds)
- Option 2: Tell Me the Error Message
- Option 3: Quick Test Script

## `PHASE_4_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- Verification Summary
- ✅ 1. Source Field - VERIFIED
- ✅ 2. Dealer ID Constraint - FIXED
- ✅ 3. Session Management - IMPLEMENTED
- ✅ 4. Payload Validation - IMPLEMENTED

## `PHASE_4_REMAINING_ISSUES_DOCUMENTED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ⚠️ Feature Gaps
- 1. Vehicle Compare Feature
- 2. Dashboard Inventory Edit Feature
- 3. Dashboard Inventory Delete Feature

## `PHASE_4_REFRESH_SCHEDULING.md`
**Purpose**: Documentation file
**Key Content**:
- Operational Refresh Strategy
- Option 1: External Cron (Recommended)
- Option 2: Trigger-Based Refresh (Automatic)
- Option 3: pg_cron (Supabase Pro)
- Current Configuration

## `PHASE_4_LINE_ITEM_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Fixes Applied
- ✅ 1. Sessions & Required IDs (Critical)
- ✅ 2. Schema Alignment
- ⚠️ 3. Tracking Coverage (Partial)
- ⚠️ 4. Materialized Views Refresh

## `PHASE_4_LINE_ITEM_COMPLETION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ 1. Sessions & Required IDs (Critical) - COMPLETE
- Dashboard Session Reuse
- MCP Session Handling
- Required ID Enforcement

## `PHASE_4_FIXES_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Completed Fixes ✅
- 1. Schema Improvements
- 2. Tracking Utilities - Core Improvements
- 3. Updated Tracking Calls

## `PHASE_4_FINAL_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- ✅ Fixed
- ❌ Still Needs Fixing
- Root Cause Analysis
- Comprehensive Solution

## `PHASE_4_FINAL_FIXES_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- All Blocking Issues Addressed
- ✅ 1. Session Persistence (FIXED)
- ✅ 2. Required ID Enforcement (FIXED)
- ✅ 3. PII Removal (FIXED)
- ✅ 4. Source Field (FIXED)

## `PHASE_4_FINAL_FIXES_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Fixed: MCP Tracker Compile Error
- ✅ Fixed: Refresh Trigger Actually Refreshes
- ✅ Fixed: Widget Client-Side Tracking
- ✅ Fixed: Analytics Page Uses Relative URLs with Credentials

## `PHASE_4_FINAL_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Identified
- Status: Code Already Fixed ✅
- 1. Source Field ✅
- 2. Dealer ID Constraint ✅
- 3. Session Management ✅

## `PHASE_4_FINAL_BLOCKING_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Fixed: Real FK Constraints with Rejection
- ✅ Fixed: Removed Unused Event Types
- ✅ Fixed: Refresh Worker Implementation
- ✅ Fixed: Conversions Endpoint Consistency

## `PHASE_4_FINAL_AUDIT_RESPONSE.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Blocking Defect 1: Schema Enforcement of Required IDs
- Issue
- Fix Implemented
- ✅ Blocking Defect 2: Session Persistence

## `PHASE_4_DELIVERY_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Deliverables Completed
- 1. Database Schema (Supabase/Postgres) ✅
- `analytics_sessions`
- `analytics_events` (Core Events Table)

## `PHASE_4_CRITICAL_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Issues Identified in Audit
- 1. Schema Issues
- 2. Tracking Utilities
- 3. Missing Tracking Points
- 4. Materialized Views

## `PHASE_4_CRITICAL_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Database-Level Constraints
- ✅ Defect 2: Unified Tracking Utility
- ✅ Defect 3: Widget Tracking Validation
- ✅ Defect 4: Single requestId in searchVehicles

## `PHASE_4_COMPREHENSIVE_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Remaining
- Solution Architecture
- Session Management Strategy
- Required ID Enforcement
- Files Status

## `PHASE_4_COMPLETE_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Critical Issues - Resolution Status
- ✅ 1. Source Field Population
- ✅ 2. Dealer ID Constraint
- ✅ 3. Session Management

## `PHASE_4_COMPLETE_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Critical Fix 1: Database-Level Constraint Enforcement
- ✅ Critical Fix 2: Unified Tracking Utility
- ✅ Critical Fix 3: Widget Tracking Validation
- ✅ Critical Fix 4: Single requestId in searchVehicles

## `PHASE_4_COMPLETE_FIXES_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Fixed: Real FK Constraints with Rejection (No Auto-Create)
- ✅ Fixed: Removed Unused Event Types
- ✅ Fixed: Refresh Worker Implementation
- ✅ Fixed: Conversions Endpoint Consistency

## `PHASE_4_BLOCKING_FIXES_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ 1. Schema Enforcement of Required IDs
- ✅ 2. Session Persistence (Dashboard)
- ✅ 3. Session Persistence (MCP)
- ✅ 4. Materialized View Refresh (Operational)

## `PHASE_4_AUDIT_RESPONSE_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Detailed Response to Audit Findings
- ✅ Deliverable 1: Event Tracking Schema - FIXED
- ✅ Deliverable 2: Event Logging Utilities - FIXED
- ✅ Deliverable 3: Tracking Insertion Points - FIXED

## `PHASE_4_AUDIT_RESPONSE.md`
**Purpose**: Documentation file
**Key Content**:
- Response to Audit Findings
- Issue 1: "Source field not populated"
- Issue 2: "Dealer ID constraint blocks inserts"
- Issue 3: "Session management broken"
- Issue 4: "Payload validation shallow"

## `PHASE_4_AUDIT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. VERIFY: MCP → UVS → Dashboard Alignments
- 1.1 MCP Server ✅ **PASS**
- 2. VERIFY: Widget Uses UVS Structured Content Only
- 2.1 Widget Data Loading ✅ **PASS**

## `PHASE_4_AUDIT_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Fixed
- 1. FK Violation Bug - RESOLVED ✅
- 2. PII Policy Compliance - RESOLVED ✅
- 3. Materialized Views - RESOLVED ✅
- 4. Missing Tracking Points - RESOLVED ✅

## `PHASE_4_ALL_DEFECTS_RESOLVED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Real FK Constraints with Rejection
- ✅ Defect 2: Removed Unused Event Types
- ✅ Defect 3: Refresh Worker Implementation
- ✅ Defect 4: Conversions Endpoint Consistency

## `PHASE_4_ALL_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Database-Level Constraints for Required IDs
- Fix Implemented
- ✅ Defect 2: Unified Tracking Utility
- Fix Implemented

## `PHASE_4_ALL_BLOCKING_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Fixed: Referential Integrity Enforcement
- ✅ Fixed: Non-Blocking Refresh Mechanism
- ✅ Fixed: Conversions Endpoint Accepts dealer_id
- ⚠️ Feature Gaps Documented

## `OFFICIAL_APPS_SDK_SCHEMA_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. Official Documentation URLs
- Primary Documentation:
- 2. Schema File Location
- Status: ⚠️ **Not Found in Package**

## `MIGRATION_READY_TO_APPLY.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Preparation Complete
- What's Ready
- 🚀 Next Steps: Apply Migration
- Quick Method (Recommended)
- Interactive Method

## `MIGRATION_APPLY_AND_VERIFY.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Step 1: Apply Migration in Supabase
- Step 2: Verify FK Constraints
- Step 3: Check for Orphaned Leads
- Step 4: Run Automated Verification Script

## `MCP_INSTRUMENTATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Changes Made
- 1. Top-Level Crash Handlers ✅
- 2. Express Error Middleware ✅
- 3. Path Normalization ✅
- 4. Reduced Noisy Logging ✅

## `MCP_INGESTION_INVESTIGATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- 1. Railway Logs (16:39 UTC)
- 2. Diagnostic Script Results
- 3. UVS Schema Verification
- Migration File Status

## `MCP_INGESTION_500_INVESTIGATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- Status
- 1. Railway Logs (16:39 UTC)
- 2. Diagnostic Script
- 3. UVS Schema Verification

## `MCP_INGESTION_500_FINDINGS.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- 1. Railway Logs Status
- 2. Diagnostic Script
- 3. UVS Schema Verification
- 4. Code Changes Made

## `MCP_BUILD_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Issue
- Solution
- ✅ Removed `.js` Extensions from Internal Imports
- Files Modified
- reqInfo.headers Issue

## `MCP_BUILD_FIX_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Build Status: PASSING
- Fixed Issues
- 1. Router Type Inference (`widget-tracking.ts`)
- 2. Context Type Mismatch (`index.ts`)
- 3. UVS vs UnifiedVehicle Type Mismatch (`orchestrator.ts`)

## `MCP_500_ERROR_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Ready to Investigate
- Quick Start
- 1. Railway Logs (16:39 UTC)
- 2. Run Diagnostic Script
- 3. Verify UVS Schema

## `MCP_500_ERROR_INVESTIGATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Files Created
- Task 1: Railway Logs (16:39 UTC)
- How to Access Railway Logs
- Expected Log Patterns

## `MCP_500_ERROR_FINDINGS.md`
**Purpose**: Documentation file
**Key Content**:
- Diagnostic Script Results
- Results
- 1. Health Check (`/mcp`)
- 2. Fetch-and-Ingest Endpoint (`/api/ingest/marketcheck/fetch-and-ingest`)
- 3. Direct Ingestion Endpoint (`/api/ingest/marketcheck`)

## `MCP_500_DIAGNOSTIC_RESULTS.md`
**Purpose**: Documentation file
**Key Content**:
- Diagnostic Script Results
- Test Results
- Test 1: Health Check
- Test 2: Fetch-and-Ingest Endpoint
- Test 3: Direct Ingestion Endpoint

## `MARKETCHECK_PAGINATION_ISSUE_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Statement
- What We've Done So Far
- 1. Initial Investigation
- 2. Root Cause Identified
- 3. Pagination Implementation

## `MARKDOWN_CONSOLIDATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- 📊 Current State
- 🎯 Proposed 10-File Structure
- 📁 File Distribution
- 1. README.md (4 files)
- 2. CHANGELOG.md (~25 files)

## `MARKDOWN_CONSOLIDATION_PROPOSAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Current File Distribution
- By Location
- By Category (Estimated)
- Proposed 10-File Structure

## `MARKDOWN_CONSOLIDATION_MAPPING.md`
**Purpose**: Documentation file
**Key Content**:
- 1. README.md (Project Overview & Quick Start)
- Files to Merge:
- Content Priority:
- 2. CHANGELOG.md (Release History & Roadmap)
- Files to Merge:

## `MANIFEST_SETUP_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- What Was Done
- 1. ✅ Created Manifest Structure
- 2. ✅ Updated Package.json
- 3. ✅ Updated API Route
- 4. ✅ Schema Synchronization

## `INVESTIGATE_MCP_500_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- Timeline
- Task 1: Pull Railway Logs Around 16:39 UTC
- Option A: Railway Dashboard (Easiest)
- Option B: Railway CLI

## `INVENTORY_SEARCH_INVESTIGATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Root Cause
- Evidence
- Database Query Results
- Code Analysis
- Fixes Applied

## `INGESTION_AUTOMATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Implementation Complete
- Files Created/Modified
- New Files
- Modified Files
- Key Features

## `GET_RAILWAY_ERROR_STEPS.md`
**Purpose**: Documentation file
**Key Content**:
- Ready to Capture Actual Error
- Step 1: Open Railway Dashboard Logs
- Step 2: Run Diagnostic Script (This Will Trigger the Error)
- Step 3: Immediately Check Railway Logs
- Step 4: Copy the ACTUAL Error

## `FIX_SYNC_500_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Summary
- Root Cause
- Quick Fix Steps
- 1. Verify Railway Environment Variables
- 2. Add Missing Supabase Config to Railway

## `DEPLOY_VERCEL.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Deploy via CLI
- Step 2: Set Environment Variables
- Step 3: Redeploy with Environment Variables
- Step 4: Configure Supabase Redirect URLs
- Step 5: Test

## `DEPLOYMENT_STATUS_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Current Situation
- What Was Done
- Next Steps
- Verification

## `DEPLOYMENT_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Code Changes Deployed
- Changes Included:
- Deployment Method
- ✅ Git Push Complete
- Next Steps

## `DEPLOYMENT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Files Committed and Pushed
- Git Commits
- Current Status
- Required Vercel Dashboard Configuration
- Settings → General

## `DEPLOYMENT_FINAL_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Summary
- Latest Deployment
- Configuration Applied
- Current Status
- Action Required: Clear Build Cache

## `CHECK_RAILWAY_LOGS_NOW.md`
**Purpose**: Documentation file
**Key Content**:
- Direct Access
- What to Look For (Around 16:39 UTC)
- Search/Filter for:
- Error Patterns:
- Copy Here:

## `CAPTURE_RAILWAY_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Tail Railway Logs
- Option A: Railway CLI
- Option B: Railway Dashboard
- Step 2: Run Diagnostic Script
- Step 3: Check Logs Again

## `CAPTURE_ACTUAL_RAILWAY_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Prepare to Monitor Railway Logs
- Railway Dashboard Method (Recommended)
- Search Terms to Use:
- Step 2: Run Diagnostic Script (This will trigger the error)
- Step 3: Immediately Check Railway Logs

## `APPS_SDK_SETUP_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. pnpm Setup
- Status: ✅ **Success**
- 2. Apps SDK Installation Attempts
- Status: ❌ **Package Not Found**

## `APPS_SDK_MANIFEST_VALIDATION_REPORT.md`
**Purpose**: 'Search Rock Hill GMC inventory and submit leads.',
**Key Content**:
- Executive Summary
- Overall Status: **FAIL**
- 1. Schema Sources Location
- 1.1 Expected Manifest File
- 1.2 Package.json Analysis

## `.agents/skills/supabase/references/skill-feedback.md`
**Purpose**: Documentation file
**Key Content**:
- Steps

## `.agents/skills/supabase/assets/feedback-issue-template.md`
**Purpose**: Documentation file
**Key Content**:
- What happened
- Source
- Fix suggestion

## `.agents/skills/supabase/SKILL.md`
**Purpose**: "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations (supabase-js, @supabase/ssr) in Next.js, React, SvelteKit, Astro, Remix; auth issues (login, logout, sessions, JWT, cookies, getSession, getUser, getClaims, RLS); Supabase CLI or MCP server; schema changes, migrations, declarative schemas, security audits, Postgres extensions (pg_graphql, pg_cron, pg_vector)."
**Key Content**:
- Core Principles
- Supabase CLI
- Supabase MCP Server
- Supabase Documentation
- Making and Committing Schema Changes

## `.agents/skills/supabase/CHANGELOG.md`
**Purpose**: Documentation file
**Key Content**:
- [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10)
- Features
- Bug Fixes
- [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05)
- Features

## `.agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md`
**Purpose**: 5-10x faster RLS queries with proper patterns
**Key Content**:
- Optimize RLS Policies for Performance

## `.agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md`
**Purpose**: Database-enforced tenant isolation, prevent data leaks
**Key Content**:
- Enable Row Level Security for Multi-Tenant Data

## `.agents/skills/supabase-postgres-best-practices/references/security-privileges.md`
**Purpose**: Reduced attack surface, better audit trail
**Key Content**:
- Apply Principle of Least Privilege

## `.agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md`
**Purpose**: Better index locality, reduced fragmentation
**Key Content**:
- Select Optimal Primary Key Strategy

## `.agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md`
**Purpose**: 5-20x faster queries and maintenance on large tables
**Key Content**:
- Partition Large Tables for Better Performance

## `.agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md`
**Purpose**: Avoid case-sensitivity bugs with tools, ORMs, and AI assistants
**Key Content**:
- Use Lowercase Identifiers for Compatibility

## `.agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md`
**Purpose**: 10-100x faster JOINs and CASCADE operations
**Key Content**:
- Index Foreign Key Columns

## `.agents/skills/supabase-postgres-best-practices/references/schema-data-types.md`
**Purpose**: 50% storage reduction, faster comparisons
**Key Content**:
- Choose Appropriate Data Types

## `.agents/skills/supabase-postgres-best-practices/references/schema-constraints.md`
**Purpose**: Prevents migration failures and enables idempotent schema changes
**Key Content**:
- Add Constraints Safely in Migrations

## `.agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md`
**Purpose**: 5-20x smaller indexes, faster writes and queries
**Key Content**:
- Use Partial Indexes for Filtered Queries

## `.agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md`
**Purpose**: 100-1000x faster queries on large tables
**Key Content**:
- Add Indexes on WHERE and JOIN Columns

## `.agents/skills/supabase-postgres-best-practices/references/query-index-types.md`
**Purpose**: 10-100x improvement with correct index type
**Key Content**:
- Choose the Right Index Type for Your Data

## `.agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md`
**Purpose**: 2-5x faster queries by eliminating heap fetches
**Key Content**:
- Use Covering Indexes to Avoid Table Lookups

## `.agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md`
**Purpose**: 5-10x faster multi-column queries
**Key Content**:
- Create Composite Indexes for Multi-Column Queries

## `.agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md`
**Purpose**: 2-10x better query plans with accurate statistics
**Key Content**:
- Maintain Table Statistics with VACUUM and ANALYZE

## `.agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md`
**Purpose**: Identify top resource-consuming queries
**Key Content**:
- Enable pg_stat_statements for Query Analysis

## `.agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md`
**Purpose**: Identify exact bottlenecks in query execution
**Key Content**:
- Use EXPLAIN ANALYZE to Diagnose Slow Queries

## `.agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md`
**Purpose**: 10x throughput for worker queues
**Key Content**:
- Use SKIP LOCKED for Non-Blocking Queue Processing

## `.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md`
**Purpose**: 3-5x throughput improvement, fewer deadlocks
**Key Content**:
- Keep Transactions Short to Reduce Lock Contention

## `.agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md`
**Purpose**: Eliminate deadlock errors, improve reliability
**Key Content**:
- Prevent Deadlocks with Consistent Lock Ordering

## `.agents/skills/supabase-postgres-best-practices/references/lock-advisory.md`
**Purpose**: Efficient coordination without row-level lock overhead
**Key Content**:
- Use Advisory Locks for Application-Level Locking

## `.agents/skills/supabase-postgres-best-practices/references/data-upsert.md`
**Purpose**: Atomic operation, eliminates race conditions
**Key Content**:
- Use UPSERT for Insert-or-Update Operations

## `.agents/skills/supabase-postgres-best-practices/references/data-pagination.md`
**Purpose**: Consistent O(1) performance regardless of page depth
**Key Content**:
- Use Cursor-Based Pagination Instead of OFFSET

## `.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md`
**Purpose**: 10-100x fewer database round trips
**Key Content**:
- Eliminate N+1 Queries with Batch Loading

## `.agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md`
**Purpose**: 10-50x faster bulk inserts
**Key Content**:
- Batch INSERT Statements for Bulk Data

## `.agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md`
**Purpose**: Avoid prepared statement conflicts in pooled environments
**Key Content**:
- Use Prepared Statements Correctly with Pooling

## `.agents/skills/supabase-postgres-best-practices/references/conn-pooling.md`
**Purpose**: Handle 10-100x more concurrent users
**Key Content**:
- Use Connection Pooling for All Applications

## `.agents/skills/supabase-postgres-best-practices/references/conn-limits.md`
**Purpose**: Prevent database crashes and memory exhaustion
**Key Content**:
- Set Appropriate Connection Limits

## `.agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md`
**Purpose**: Reclaim 30-50% of connection slots from idle clients
**Key Content**:
- Configure Idle Connection Timeouts

## `.agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md`
**Purpose**: 10-100x faster JSONB queries with proper indexing
**Key Content**:
- Index JSONB Columns for Efficient Querying

## `.agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md`
**Purpose**: 100x faster than LIKE, with ranking support
**Key Content**:
- Use tsvector for Full-Text Search

## `.agents/skills/supabase-postgres-best-practices/references/_template.md`
**Purpose**: 5-20x query speedup for filtered queries
**Key Content**:
- [Rule Title]

## `.agents/skills/supabase-postgres-best-practices/references/_sections.md`
**Purpose**: ** Slow queries, missing indexes, inefficient query plans. The most common source of Postgres performance issues.
**Key Content**:
- 1. Query Performance (query)
- 2. Connection Management (conn)
- 3. Security & RLS (security)
- 4. Schema Design (schema)
- 5. Concurrency & Locking (lock)

## `.agents/skills/supabase-postgres-best-practices/references/_contributing.md`
**Purpose**: Documentation file
**Key Content**:
- Key Principles
- 1. Concrete Transformation Patterns
- 2. Error-First Structure
- 3. Quantified Impact
- 4. Self-Contained Examples

## `.agents/skills/supabase-postgres-best-practices/SKILL.md`
**Purpose**: Postgres performance optimization and best practices from Supabase. Use this skill when writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations.
**Key Content**:
- When to Apply
- Rule Categories by Priority
- How to Use
- References

## `.agents/skills/supabase-postgres-best-practices/CHANGELOG.md`
**Purpose**: Documentation file
**Key Content**:
- [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10)
- Features
- Bug Fixes
- [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05)
- Features

## `scripts/README_VERCEL_DEMO_SETUP.md`
**Purpose**: Documentation file
**Key Content**:
- ⚠️ IMPORTANT: Production Write Guard
- Prerequisites
- Option 1: Automated Setup (Recommended)
- Step 1: Install Dependencies
- Step 2: Configure Environment Variables

## `scripts/README_MARKDOWN_UPDATER.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Usage
- One-time Update
- Watch Mode
- How It Works

## `docs/QUERY_PARSING_DEPLOYMENT_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Situation
- ✅ Vercel (Dealer Dashboard) - **SUCCESS**
- ⏳ Railway (MCP Server) - **BUILDING**
- Analysis:
- Possible Causes:

## `docs/QUERY_PARSING_DEPLOYMENT_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Error Found
- Fix Applied
- Before (Line 371):
- After:
- Deployment Actions

## `docs/QUERY_PARSING_DEPLOYMENT_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Actions Completed
- ✅ Git Operations
- ⚠️ Vercel Deployment
- Deployment Status
- Current State

## `apps/mcp-server/test/STRICT_VALIDATION_README.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Running Tests
- Run all tests
- Run only strict validation tests
- Run tests in watch mode

## `apps/mcp-server/src/ui/README.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Data Sourcing
- Vehicle Data
- Globals Synchronization
- Lead Submission

## `apps/dealer-dashboard/QUICK_START_INGESTION.md`
**Purpose**: Documentation file
**Key Content**:
- 🚀 Quick Setup (5 minutes)
- 1. Set Environment Variables
- 2. Deploy
- 3. Test
- 📋 What Was Added

## `apps/dealer-dashboard/DEPLOYMENT_CHECKLIST.md`
**Purpose**: Documentation file
**Key Content**:
- Pre-Deployment
- 1. Environment Variables - MCP Server (Railway)
- 2. Environment Variables - Dealer Dashboard (Vercel)
- 3. Verify Code Changes
- Deployment Steps

## `apps/autoagent-app/README.md`
**Purpose**: Documentation file
**Key Content**:
- File Structure
- Source of Truth
- Schema Synchronization
- Validation
- Tools Defined

## `WATCH_LOGS_REALTIME.md`
**Purpose**: Documentation file
**Key Content**:
- I'll Monitor While You Click the Button
- Option 1: Share Logs as You See Them
- Option 2: Try Railway API (if token available)
- Ready to Monitor

## `VERCEL_DOMAIN_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status (2025-11-18)
- Deployment URLs
- Current Behavior
- Issue
- Marketing Landing Page Status

## `VERCEL_DEPLOYMENT_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Required Action: Configure via Vercel Dashboard
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration
- Step 3: Trigger Fresh Deployment

## `VERCEL_DEPLOYMENT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Status
- Latest Successful Deployment
- Configuration
- Domain Verification
- Apex Domain: `autoagentapp.com`

## `VERCEL_DEPLOYMENT_INSTRUCTIONS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Required Vercel Dashboard Configuration
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration
- Step 3: Trigger Fresh Deployment

## `VERCEL_DEPLOYMENT_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Issue
- Solution: Configure via Vercel Dashboard
- Alternative: Deploy from Root Directory
- Quick Fix Command
- Current Deployment URLs

## `VERCEL_DEPLOYMENT_FINAL_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Current Issue
- Required Vercel Dashboard Configuration
- Settings → General
- Why This Configuration Works

## `UVS_FK_VERIFICATION_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Code Verification Complete
- Metrics Endpoints - Verified ✅
- Dashboard UI - Verified ✅
- ⚠️ Database Migration - Action Required
- Migration File

## `UVS_FK_ALIGNMENT_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Changes Made
- 1. Database Schema
- 2. Metrics API Endpoints
- `/api/metrics/leads` (Updated)

## `TEST_VERIFICATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Test Results Summary
- Test Coverage Verification
- ✅ Valid Payloads (7 tests)
- ✅ Required Blocks Validation (6 tests)
- ✅ Enum Validation (6 tests)

## `SYNC_ERROR_FIX_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Summary
- Root Cause Analysis
- Required Environment Variables (Railway MCP Server):
- Error Flow:
- Solution Steps

## `SYNC_ERROR_DEBUG_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Changes Made
- 1. Enhanced Error Logging (`apps/dealer-dashboard/src/app/app/setup/actions.ts`)
- Next Steps to Find the Error
- Option 1: Reproduce Locally (Recommended)

## `STRICT_VALIDATION_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Build Status
- Shared Package Build
- Exports Verification
- ✅ Implementation Verification
- 1. Orchestrator Integration (`apps/mcp-server/src/ingestion/orchestrator.ts`)

## `STRICT_VALIDATION_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Implementation Summary
- 1. Strict Zod Schemas ✅
- 2. Updated Validation ✅
- 3. Provider Mapper Integration ✅

## `RAILWAY_LOG_CAPTURE_INSTRUCTIONS.md`
**Purpose**: Documentation file
**Key Content**:
- Railway CLI Authentication Required
- Option A: Railway CLI (Manual Login)
- Option B: Railway Dashboard (Easiest)
- Step 1: Prepare to Capture Error
- Step 2: Run Diagnostic Script (Triggers Error)

## `RAILWAY_DEPLOY_METHOD.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Primary Method: GitHub Push → Railway Auto-Deploy
- How It Works
- Documentation References
- Railway Deployment (Automatic)

## `QUICK_ERROR_CHECK.md`
**Purpose**: Documentation file
**Key Content**:
- What Error Did You See?
- Check Logs Now - 3 Options:
- Option 1: Vercel Dashboard (FASTEST - 30 seconds)
- Option 2: Tell Me the Error Message
- Option 3: Quick Test Script

## `PHASE_4_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- Verification Summary
- ✅ 1. Source Field - VERIFIED
- ✅ 2. Dealer ID Constraint - FIXED
- ✅ 3. Session Management - IMPLEMENTED
- ✅ 4. Payload Validation - IMPLEMENTED

## `PHASE_4_REMAINING_ISSUES_DOCUMENTED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ⚠️ Feature Gaps
- 1. Vehicle Compare Feature
- 2. Dashboard Inventory Edit Feature
- 3. Dashboard Inventory Delete Feature

## `PHASE_4_REFRESH_SCHEDULING.md`
**Purpose**: Documentation file
**Key Content**:
- Operational Refresh Strategy
- Option 1: External Cron (Recommended)
- Option 2: Trigger-Based Refresh (Automatic)
- Option 3: pg_cron (Supabase Pro)
- Current Configuration

## `PHASE_4_LINE_ITEM_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Fixes Applied
- ✅ 1. Sessions & Required IDs (Critical)
- ✅ 2. Schema Alignment
- ⚠️ 3. Tracking Coverage (Partial)
- ⚠️ 4. Materialized Views Refresh

## `PHASE_4_LINE_ITEM_COMPLETION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ 1. Sessions & Required IDs (Critical) - COMPLETE
- Dashboard Session Reuse
- MCP Session Handling
- Required ID Enforcement

## `PHASE_4_FIXES_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Completed Fixes ✅
- 1. Schema Improvements
- 2. Tracking Utilities - Core Improvements
- 3. Updated Tracking Calls

## `PHASE_4_FINAL_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- ✅ Fixed
- ❌ Still Needs Fixing
- Root Cause Analysis
- Comprehensive Solution

## `PHASE_4_FINAL_FIXES_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- All Blocking Issues Addressed
- ✅ 1. Session Persistence (FIXED)
- ✅ 2. Required ID Enforcement (FIXED)
- ✅ 3. PII Removal (FIXED)
- ✅ 4. Source Field (FIXED)

## `PHASE_4_FINAL_FIXES_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Fixed: MCP Tracker Compile Error
- ✅ Fixed: Refresh Trigger Actually Refreshes
- ✅ Fixed: Widget Client-Side Tracking
- ✅ Fixed: Analytics Page Uses Relative URLs with Credentials

## `PHASE_4_FINAL_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Identified
- Status: Code Already Fixed ✅
- 1. Source Field ✅
- 2. Dealer ID Constraint ✅
- 3. Session Management ✅

## `PHASE_4_FINAL_BLOCKING_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Fixed: Real FK Constraints with Rejection
- ✅ Fixed: Removed Unused Event Types
- ✅ Fixed: Refresh Worker Implementation
- ✅ Fixed: Conversions Endpoint Consistency

## `PHASE_4_FINAL_AUDIT_RESPONSE.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Blocking Defect 1: Schema Enforcement of Required IDs
- Issue
- Fix Implemented
- ✅ Blocking Defect 2: Session Persistence

## `PHASE_4_DELIVERY_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Deliverables Completed
- 1. Database Schema (Supabase/Postgres) ✅
- `analytics_sessions`
- `analytics_events` (Core Events Table)

## `PHASE_4_CRITICAL_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Issues Identified in Audit
- 1. Schema Issues
- 2. Tracking Utilities
- 3. Missing Tracking Points
- 4. Materialized Views

## `PHASE_4_CRITICAL_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Database-Level Constraints
- ✅ Defect 2: Unified Tracking Utility
- ✅ Defect 3: Widget Tracking Validation
- ✅ Defect 4: Single requestId in searchVehicles

## `PHASE_4_COMPREHENSIVE_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Remaining
- Solution Architecture
- Session Management Strategy
- Required ID Enforcement
- Files Status

## `PHASE_4_COMPLETE_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Critical Issues - Resolution Status
- ✅ 1. Source Field Population
- ✅ 2. Dealer ID Constraint
- ✅ 3. Session Management

## `PHASE_4_COMPLETE_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Critical Fix 1: Database-Level Constraint Enforcement
- ✅ Critical Fix 2: Unified Tracking Utility
- ✅ Critical Fix 3: Widget Tracking Validation
- ✅ Critical Fix 4: Single requestId in searchVehicles

## `PHASE_4_COMPLETE_FIXES_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Fixed: Real FK Constraints with Rejection (No Auto-Create)
- ✅ Fixed: Removed Unused Event Types
- ✅ Fixed: Refresh Worker Implementation
- ✅ Fixed: Conversions Endpoint Consistency

## `PHASE_4_BLOCKING_FIXES_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ 1. Schema Enforcement of Required IDs
- ✅ 2. Session Persistence (Dashboard)
- ✅ 3. Session Persistence (MCP)
- ✅ 4. Materialized View Refresh (Operational)

## `PHASE_4_AUDIT_RESPONSE_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Detailed Response to Audit Findings
- ✅ Deliverable 1: Event Tracking Schema - FIXED
- ✅ Deliverable 2: Event Logging Utilities - FIXED
- ✅ Deliverable 3: Tracking Insertion Points - FIXED

## `PHASE_4_AUDIT_RESPONSE.md`
**Purpose**: Documentation file
**Key Content**:
- Response to Audit Findings
- Issue 1: "Source field not populated"
- Issue 2: "Dealer ID constraint blocks inserts"
- Issue 3: "Session management broken"
- Issue 4: "Payload validation shallow"

## `PHASE_4_AUDIT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. VERIFY: MCP → UVS → Dashboard Alignments
- 1.1 MCP Server ✅ **PASS**
- 2. VERIFY: Widget Uses UVS Structured Content Only
- 2.1 Widget Data Loading ✅ **PASS**

## `PHASE_4_AUDIT_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Fixed
- 1. FK Violation Bug - RESOLVED ✅
- 2. PII Policy Compliance - RESOLVED ✅
- 3. Materialized Views - RESOLVED ✅
- 4. Missing Tracking Points - RESOLVED ✅

## `PHASE_4_ALL_DEFECTS_RESOLVED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Real FK Constraints with Rejection
- ✅ Defect 2: Removed Unused Event Types
- ✅ Defect 3: Refresh Worker Implementation
- ✅ Defect 4: Conversions Endpoint Consistency

## `PHASE_4_ALL_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Database-Level Constraints for Required IDs
- Fix Implemented
- ✅ Defect 2: Unified Tracking Utility
- Fix Implemented

## `PHASE_4_ALL_BLOCKING_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Fixed: Referential Integrity Enforcement
- ✅ Fixed: Non-Blocking Refresh Mechanism
- ✅ Fixed: Conversions Endpoint Accepts dealer_id
- ⚠️ Feature Gaps Documented

## `OFFICIAL_APPS_SDK_SCHEMA_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. Official Documentation URLs
- Primary Documentation:
- 2. Schema File Location
- Status: ⚠️ **Not Found in Package**

## `MIGRATION_READY_TO_APPLY.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Preparation Complete
- What's Ready
- 🚀 Next Steps: Apply Migration
- Quick Method (Recommended)
- Interactive Method

## `MIGRATION_APPLY_AND_VERIFY.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Step 1: Apply Migration in Supabase
- Step 2: Verify FK Constraints
- Step 3: Check for Orphaned Leads
- Step 4: Run Automated Verification Script

## `MCP_INSTRUMENTATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Changes Made
- 1. Top-Level Crash Handlers ✅
- 2. Express Error Middleware ✅
- 3. Path Normalization ✅
- 4. Reduced Noisy Logging ✅

## `MCP_INGESTION_INVESTIGATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- 1. Railway Logs (16:39 UTC)
- 2. Diagnostic Script Results
- 3. UVS Schema Verification
- Migration File Status

## `MCP_INGESTION_500_INVESTIGATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- Status
- 1. Railway Logs (16:39 UTC)
- 2. Diagnostic Script
- 3. UVS Schema Verification

## `MCP_INGESTION_500_FINDINGS.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- 1. Railway Logs Status
- 2. Diagnostic Script
- 3. UVS Schema Verification
- 4. Code Changes Made

## `MCP_BUILD_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Issue
- Solution
- ✅ Removed `.js` Extensions from Internal Imports
- Files Modified
- reqInfo.headers Issue

## `MCP_BUILD_FIX_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Build Status: PASSING
- Fixed Issues
- 1. Router Type Inference (`widget-tracking.ts`)
- 2. Context Type Mismatch (`index.ts`)
- 3. UVS vs UnifiedVehicle Type Mismatch (`orchestrator.ts`)

## `MCP_500_ERROR_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Ready to Investigate
- Quick Start
- 1. Railway Logs (16:39 UTC)
- 2. Run Diagnostic Script
- 3. Verify UVS Schema

## `MCP_500_ERROR_INVESTIGATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Files Created
- Task 1: Railway Logs (16:39 UTC)
- How to Access Railway Logs
- Expected Log Patterns

## `MCP_500_ERROR_FINDINGS.md`
**Purpose**: Documentation file
**Key Content**:
- Diagnostic Script Results
- Results
- 1. Health Check (`/mcp`)
- 2. Fetch-and-Ingest Endpoint (`/api/ingest/marketcheck/fetch-and-ingest`)
- 3. Direct Ingestion Endpoint (`/api/ingest/marketcheck`)

## `MCP_500_DIAGNOSTIC_RESULTS.md`
**Purpose**: Documentation file
**Key Content**:
- Diagnostic Script Results
- Test Results
- Test 1: Health Check
- Test 2: Fetch-and-Ingest Endpoint
- Test 3: Direct Ingestion Endpoint

## `MARKETCHECK_PAGINATION_ISSUE_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Statement
- What We've Done So Far
- 1. Initial Investigation
- 2. Root Cause Identified
- 3. Pagination Implementation

## `MARKDOWN_CONSOLIDATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- 📊 Current State
- 🎯 Proposed 10-File Structure
- 📁 File Distribution
- 1. README.md (4 files)
- 2. CHANGELOG.md (~25 files)

## `MARKDOWN_CONSOLIDATION_PROPOSAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Current File Distribution
- By Location
- By Category (Estimated)
- Proposed 10-File Structure

## `MARKDOWN_CONSOLIDATION_MAPPING.md`
**Purpose**: Documentation file
**Key Content**:
- 1. README.md (Project Overview & Quick Start)
- Files to Merge:
- Content Priority:
- 2. CHANGELOG.md (Release History & Roadmap)
- Files to Merge:

## `MANIFEST_SETUP_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- What Was Done
- 1. ✅ Created Manifest Structure
- 2. ✅ Updated Package.json
- 3. ✅ Updated API Route
- 4. ✅ Schema Synchronization

## `INVESTIGATE_MCP_500_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- Timeline
- Task 1: Pull Railway Logs Around 16:39 UTC
- Option A: Railway Dashboard (Easiest)
- Option B: Railway CLI

## `INVENTORY_SEARCH_INVESTIGATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Root Cause
- Evidence
- Database Query Results
- Code Analysis
- Fixes Applied

## `INVENTORY_SEARCH_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Root Cause
- Evidence
- Database Queries
- Coordinate Verification
- Fixes Applied

## `INGESTION_AUTOMATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Implementation Complete
- Files Created/Modified
- New Files
- Modified Files
- Key Features

## `GET_RAILWAY_ERROR_STEPS.md`
**Purpose**: Documentation file
**Key Content**:
- Ready to Capture Actual Error
- Step 1: Open Railway Dashboard Logs
- Step 2: Run Diagnostic Script (This Will Trigger the Error)
- Step 3: Immediately Check Railway Logs
- Step 4: Copy the ACTUAL Error

## `FIX_SYNC_500_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Summary
- Root Cause
- Quick Fix Steps
- 1. Verify Railway Environment Variables
- 2. Add Missing Supabase Config to Railway

## `DEPLOY_VERCEL.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Deploy via CLI
- Step 2: Set Environment Variables
- Step 3: Redeploy with Environment Variables
- Step 4: Configure Supabase Redirect URLs
- Step 5: Test

## `DEPLOYMENT_STATUS_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Current Situation
- What Was Done
- Next Steps
- Verification

## `DEPLOYMENT_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Code Changes Deployed
- Changes Included:
- Deployment Method
- ✅ Git Push Complete
- Next Steps

## `DEPLOYMENT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Files Committed and Pushed
- Git Commits
- Current Status
- Required Vercel Dashboard Configuration
- Settings → General

## `DEPLOYMENT_FINAL_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Summary
- Latest Deployment
- Configuration Applied
- Current Status
- Action Required: Clear Build Cache

## `CHECK_RAILWAY_LOGS_NOW.md`
**Purpose**: Documentation file
**Key Content**:
- Direct Access
- What to Look For (Around 16:39 UTC)
- Search/Filter for:
- Error Patterns:
- Copy Here:

## `CAPTURE_RAILWAY_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Tail Railway Logs
- Option A: Railway CLI
- Option B: Railway Dashboard
- Step 2: Run Diagnostic Script
- Step 3: Check Logs Again

## `CAPTURE_ACTUAL_RAILWAY_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Prepare to Monitor Railway Logs
- Railway Dashboard Method (Recommended)
- Search Terms to Use:
- Step 2: Run Diagnostic Script (This will trigger the error)
- Step 3: Immediately Check Railway Logs

## `APPS_SDK_SETUP_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. pnpm Setup
- Status: ✅ **Success**
- 2. Apps SDK Installation Attempts
- Status: ❌ **Package Not Found**

## `APPS_SDK_MANIFEST_VALIDATION_REPORT.md`
**Purpose**: 'Search Rock Hill GMC inventory and submit leads.',
**Key Content**:
- Executive Summary
- Overall Status: **FAIL**
- 1. Schema Sources Location
- 1.1 Expected Manifest File
- 1.2 Package.json Analysis

## `scripts/debug-sync-error.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- Steps to Reproduce Locally
- 1. Check Environment Variables
- 2. Start Local Development Server
- 3. Start MCP Server (if testing against local instance)

## `scripts/README_VERCEL_DEMO_SETUP.md`
**Purpose**: Documentation file
**Key Content**:
- ⚠️ IMPORTANT: Production Write Guard
- Prerequisites
- Option 1: Automated Setup (Recommended)
- Step 1: Install Dependencies
- Step 2: Configure Environment Variables

## `docs/QUERY_PARSING_DEPLOYMENT_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Situation
- ✅ Vercel (Dealer Dashboard) - **SUCCESS**
- ⏳ Railway (MCP Server) - **BUILDING**
- Analysis:
- Possible Causes:

## `docs/QUERY_PARSING_DEPLOYMENT_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Error Found
- Fix Applied
- Before (Line 371):
- After:
- Deployment Actions

## `docs/QUERY_PARSING_DEPLOYMENT_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Actions Completed
- ✅ Git Operations
- ⚠️ Vercel Deployment
- Deployment Status
- Current State

## `apps/mcp-server/test/STRICT_VALIDATION_README.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Running Tests
- Run all tests
- Run only strict validation tests
- Run tests in watch mode

## `apps/mcp-server/src/ui/README.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Data Sourcing
- Vehicle Data
- Globals Synchronization
- Lead Submission

## `apps/dealer-dashboard/QUICK_START_INGESTION.md`
**Purpose**: Documentation file
**Key Content**:
- 🚀 Quick Setup (5 minutes)
- 1. Set Environment Variables
- 2. Deploy
- 3. Test
- 📋 What Was Added

## `apps/dealer-dashboard/DEPLOYMENT_CHECKLIST.md`
**Purpose**: Documentation file
**Key Content**:
- Pre-Deployment
- 1. Environment Variables - MCP Server (Railway)
- 2. Environment Variables - Dealer Dashboard (Vercel)
- 3. Verify Code Changes
- Deployment Steps

## `apps/autoagent-app/README.md`
**Purpose**: Documentation file
**Key Content**:
- File Structure
- Source of Truth
- Schema Synchronization
- Validation
- Tools Defined

## `WATCH_LOGS_REALTIME.md`
**Purpose**: Documentation file
**Key Content**:
- I'll Monitor While You Click the Button
- Option 1: Share Logs as You See Them
- Option 2: Try Railway API (if token available)
- Ready to Monitor

## `VERCEL_DOMAIN_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status (2025-11-18)
- Deployment URLs
- Current Behavior
- Issue
- Marketing Landing Page Status

## `VERCEL_DEPLOYMENT_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Required Action: Configure via Vercel Dashboard
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration
- Step 3: Trigger Fresh Deployment

## `VERCEL_DEPLOYMENT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Status
- Latest Successful Deployment
- Configuration
- Domain Verification
- Apex Domain: `autoagentapp.com`

## `VERCEL_DEPLOYMENT_INSTRUCTIONS.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Required Vercel Dashboard Configuration
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration
- Step 3: Trigger Fresh Deployment

## `VERCEL_DEPLOYMENT_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Issue
- Solution: Configure via Vercel Dashboard
- Alternative: Deploy from Root Directory
- Quick Fix Command
- Current Deployment URLs

## `VERCEL_DEPLOYMENT_FINAL_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Current Issue
- Required Vercel Dashboard Configuration
- Settings → General
- Why This Configuration Works

## `UVS_FK_VERIFICATION_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Code Verification Complete
- Metrics Endpoints - Verified ✅
- Dashboard UI - Verified ✅
- ⚠️ Database Migration - Action Required
- Migration File

## `UVS_FK_ALIGNMENT_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Changes Made
- 1. Database Schema
- 2. Metrics API Endpoints
- `/api/metrics/leads` (Updated)

## `TEST_VERIFICATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Test Results Summary
- Test Coverage Verification
- ✅ Valid Payloads (7 tests)
- ✅ Required Blocks Validation (6 tests)
- ✅ Enum Validation (6 tests)

## `SYNC_ERROR_FIX_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Summary
- Root Cause Analysis
- Required Environment Variables (Railway MCP Server):
- Error Flow:
- Solution Steps

## `SYNC_ERROR_DEBUG_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Changes Made
- 1. Enhanced Error Logging (`apps/dealer-dashboard/src/app/app/setup/actions.ts`)
- Next Steps to Find the Error
- Option 1: Reproduce Locally (Recommended)

## `STRICT_VALIDATION_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Build Status
- Shared Package Build
- Exports Verification
- ✅ Implementation Verification
- 1. Orchestrator Integration (`apps/mcp-server/src/ingestion/orchestrator.ts`)

## `STRICT_VALIDATION_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Implementation Summary
- 1. Strict Zod Schemas ✅
- 2. Updated Validation ✅
- 3. Provider Mapper Integration ✅

## `RAILWAY_LOG_CAPTURE_INSTRUCTIONS.md`
**Purpose**: Documentation file
**Key Content**:
- Railway CLI Authentication Required
- Option A: Railway CLI (Manual Login)
- Option B: Railway Dashboard (Easiest)
- Step 1: Prepare to Capture Error
- Step 2: Run Diagnostic Script (Triggers Error)

## `RAILWAY_DEPLOY_METHOD.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Primary Method: GitHub Push → Railway Auto-Deploy
- How It Works
- Documentation References
- Railway Deployment (Automatic)

## `QUICK_ERROR_CHECK.md`
**Purpose**: Documentation file
**Key Content**:
- What Error Did You See?
- Check Logs Now - 3 Options:
- Option 1: Vercel Dashboard (FASTEST - 30 seconds)
- Option 2: Tell Me the Error Message
- Option 3: Quick Test Script

## `PHASE_4_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- Verification Summary
- ✅ 1. Source Field - VERIFIED
- ✅ 2. Dealer ID Constraint - FIXED
- ✅ 3. Session Management - IMPLEMENTED
- ✅ 4. Payload Validation - IMPLEMENTED

## `PHASE_4_REMAINING_ISSUES_DOCUMENTED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ⚠️ Feature Gaps
- 1. Vehicle Compare Feature
- 2. Dashboard Inventory Edit Feature
- 3. Dashboard Inventory Delete Feature

## `PHASE_4_REFRESH_SCHEDULING.md`
**Purpose**: Documentation file
**Key Content**:
- Operational Refresh Strategy
- Option 1: External Cron (Recommended)
- Option 2: Trigger-Based Refresh (Automatic)
- Option 3: pg_cron (Supabase Pro)
- Current Configuration

## `PHASE_4_LINE_ITEM_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Fixes Applied
- ✅ 1. Sessions & Required IDs (Critical)
- ✅ 2. Schema Alignment
- ⚠️ 3. Tracking Coverage (Partial)
- ⚠️ 4. Materialized Views Refresh

## `PHASE_4_LINE_ITEM_COMPLETION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ 1. Sessions & Required IDs (Critical) - COMPLETE
- Dashboard Session Reuse
- MCP Session Handling
- Required ID Enforcement

## `PHASE_4_FIXES_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Completed Fixes ✅
- 1. Schema Improvements
- 2. Tracking Utilities - Core Improvements
- 3. Updated Tracking Calls

## `PHASE_4_FINAL_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- ✅ Fixed
- ❌ Still Needs Fixing
- Root Cause Analysis
- Comprehensive Solution

## `PHASE_4_FINAL_FIXES_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- All Blocking Issues Addressed
- ✅ 1. Session Persistence (FIXED)
- ✅ 2. Required ID Enforcement (FIXED)
- ✅ 3. PII Removal (FIXED)
- ✅ 4. Source Field (FIXED)

## `PHASE_4_FINAL_FIXES_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Fixed: MCP Tracker Compile Error
- ✅ Fixed: Refresh Trigger Actually Refreshes
- ✅ Fixed: Widget Client-Side Tracking
- ✅ Fixed: Analytics Page Uses Relative URLs with Credentials

## `PHASE_4_FINAL_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Identified
- Status: Code Already Fixed ✅
- 1. Source Field ✅
- 2. Dealer ID Constraint ✅
- 3. Session Management ✅

## `PHASE_4_FINAL_BLOCKING_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Fixed: Real FK Constraints with Rejection
- ✅ Fixed: Removed Unused Event Types
- ✅ Fixed: Refresh Worker Implementation
- ✅ Fixed: Conversions Endpoint Consistency

## `PHASE_4_FINAL_AUDIT_RESPONSE.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Blocking Defect 1: Schema Enforcement of Required IDs
- Issue
- Fix Implemented
- ✅ Blocking Defect 2: Session Persistence

## `PHASE_4_DELIVERY_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Deliverables Completed
- 1. Database Schema (Supabase/Postgres) ✅
- `analytics_sessions`
- `analytics_events` (Core Events Table)

## `PHASE_4_CRITICAL_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Issues Identified in Audit
- 1. Schema Issues
- 2. Tracking Utilities
- 3. Missing Tracking Points
- 4. Materialized Views

## `PHASE_4_CRITICAL_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Database-Level Constraints
- ✅ Defect 2: Unified Tracking Utility
- ✅ Defect 3: Widget Tracking Validation
- ✅ Defect 4: Single requestId in searchVehicles

## `PHASE_4_COMPREHENSIVE_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Remaining
- Solution Architecture
- Session Management Strategy
- Required ID Enforcement
- Files Status

## `PHASE_4_COMPLETE_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Critical Issues - Resolution Status
- ✅ 1. Source Field Population
- ✅ 2. Dealer ID Constraint
- ✅ 3. Session Management

## `PHASE_4_COMPLETE_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Critical Fix 1: Database-Level Constraint Enforcement
- ✅ Critical Fix 2: Unified Tracking Utility
- ✅ Critical Fix 3: Widget Tracking Validation
- ✅ Critical Fix 4: Single requestId in searchVehicles

## `PHASE_4_COMPLETE_FIXES_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Fixed: Real FK Constraints with Rejection (No Auto-Create)
- ✅ Fixed: Removed Unused Event Types
- ✅ Fixed: Refresh Worker Implementation
- ✅ Fixed: Conversions Endpoint Consistency

## `PHASE_4_BLOCKING_FIXES_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ 1. Schema Enforcement of Required IDs
- ✅ 2. Session Persistence (Dashboard)
- ✅ 3. Session Persistence (MCP)
- ✅ 4. Materialized View Refresh (Operational)

## `PHASE_4_AUDIT_RESPONSE_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Detailed Response to Audit Findings
- ✅ Deliverable 1: Event Tracking Schema - FIXED
- ✅ Deliverable 2: Event Logging Utilities - FIXED
- ✅ Deliverable 3: Tracking Insertion Points - FIXED

## `PHASE_4_AUDIT_RESPONSE.md`
**Purpose**: Documentation file
**Key Content**:
- Response to Audit Findings
- Issue 1: "Source field not populated"
- Issue 2: "Dealer ID constraint blocks inserts"
- Issue 3: "Session management broken"
- Issue 4: "Payload validation shallow"

## `PHASE_4_AUDIT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. VERIFY: MCP → UVS → Dashboard Alignments
- 1.1 MCP Server ✅ **PASS**
- 2. VERIFY: Widget Uses UVS Structured Content Only
- 2.1 Widget Data Loading ✅ **PASS**

## `PHASE_4_AUDIT_FIXES.md`
**Purpose**: Documentation file
**Key Content**:
- Critical Issues Fixed
- 1. FK Violation Bug - RESOLVED ✅
- 2. PII Policy Compliance - RESOLVED ✅
- 3. Materialized Views - RESOLVED ✅
- 4. Missing Tracking Points - RESOLVED ✅

## `PHASE_4_ALL_DEFECTS_RESOLVED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Real FK Constraints with Rejection
- ✅ Defect 2: Removed Unused Event Types
- ✅ Defect 3: Refresh Worker Implementation
- ✅ Defect 4: Conversions Endpoint Consistency

## `PHASE_4_ALL_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- ✅ Defect 1: Database-Level Constraints for Required IDs
- Fix Implemented
- ✅ Defect 2: Unified Tracking Utility
- Fix Implemented

## `PHASE_4_ALL_BLOCKING_DEFECTS_FIXED.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- ✅ Fixed: Referential Integrity Enforcement
- ✅ Fixed: Non-Blocking Refresh Mechanism
- ✅ Fixed: Conversions Endpoint Accepts dealer_id
- ⚠️ Feature Gaps Documented

## `OFFICIAL_APPS_SDK_SCHEMA_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. Official Documentation URLs
- Primary Documentation:
- 2. Schema File Location
- Status: ⚠️ **Not Found in Package**

## `MIGRATION_READY_TO_APPLY.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Preparation Complete
- What's Ready
- 🚀 Next Steps: Apply Migration
- Quick Method (Recommended)
- Interactive Method

## `MIGRATION_APPLY_AND_VERIFY.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Step 1: Apply Migration in Supabase
- Step 2: Verify FK Constraints
- Step 3: Check for Orphaned Leads
- Step 4: Run Automated Verification Script

## `MCP_INSTRUMENTATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Changes Made
- 1. Top-Level Crash Handlers ✅
- 2. Express Error Middleware ✅
- 3. Path Normalization ✅
- 4. Reduced Noisy Logging ✅

## `MCP_INGESTION_INVESTIGATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- 1. Railway Logs (16:39 UTC)
- 2. Diagnostic Script Results
- 3. UVS Schema Verification
- Migration File Status

## `MCP_INGESTION_500_INVESTIGATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- Status
- 1. Railway Logs (16:39 UTC)
- 2. Diagnostic Script
- 3. UVS Schema Verification

## `MCP_INGESTION_500_FINDINGS.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- 1. Railway Logs Status
- 2. Diagnostic Script
- 3. UVS Schema Verification
- 4. Code Changes Made

## `MCP_BUILD_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Issue
- Solution
- ✅ Removed `.js` Extensions from Internal Imports
- Files Modified
- reqInfo.headers Issue

## `MCP_BUILD_FIX_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Build Status: PASSING
- Fixed Issues
- 1. Router Type Inference (`widget-tracking.ts`)
- 2. Context Type Mismatch (`index.ts`)
- 3. UVS vs UnifiedVehicle Type Mismatch (`orchestrator.ts`)

## `MCP_500_ERROR_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Ready to Investigate
- Quick Start
- 1. Railway Logs (16:39 UTC)
- 2. Run Diagnostic Script
- 3. Verify UVS Schema

## `MCP_500_ERROR_INVESTIGATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Files Created
- Task 1: Railway Logs (16:39 UTC)
- How to Access Railway Logs
- Expected Log Patterns

## `MCP_500_ERROR_FINDINGS.md`
**Purpose**: Documentation file
**Key Content**:
- Diagnostic Script Results
- Results
- 1. Health Check (`/mcp`)
- 2. Fetch-and-Ingest Endpoint (`/api/ingest/marketcheck/fetch-and-ingest`)
- 3. Direct Ingestion Endpoint (`/api/ingest/marketcheck`)

## `MCP_500_DIAGNOSTIC_RESULTS.md`
**Purpose**: Documentation file
**Key Content**:
- Diagnostic Script Results
- Test Results
- Test 1: Health Check
- Test 2: Fetch-and-Ingest Endpoint
- Test 3: Direct Ingestion Endpoint

## `MARKETCHECK_PAGINATION_ISSUE_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Statement
- What We've Done So Far
- 1. Initial Investigation
- 2. Root Cause Identified
- 3. Pagination Implementation

## `MARKDOWN_CONSOLIDATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- 📊 Current State
- 🎯 Proposed 10-File Structure
- 📁 File Distribution
- 1. README.md (4 files)
- 2. CHANGELOG.md (~25 files)

## `MARKDOWN_CONSOLIDATION_PROPOSAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Current File Distribution
- By Location
- By Category (Estimated)
- Proposed 10-File Structure

## `MARKDOWN_CONSOLIDATION_MAPPING.md`
**Purpose**: Documentation file
**Key Content**:
- 1. README.md (Project Overview & Quick Start)
- Files to Merge:
- Content Priority:
- 2. CHANGELOG.md (Release History & Roadmap)
- Files to Merge:

## `MANIFEST_SETUP_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- What Was Done
- 1. ✅ Created Manifest Structure
- 2. ✅ Updated Package.json
- 3. ✅ Updated API Route
- 4. ✅ Schema Synchronization

## `INVESTIGATE_MCP_500_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- Timeline
- Task 1: Pull Railway Logs Around 16:39 UTC
- Option A: Railway Dashboard (Easiest)
- Option B: Railway CLI

## `INVENTORY_SEARCH_INVESTIGATION_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Root Cause
- Evidence
- Database Query Results
- Code Analysis
- Fixes Applied

## `INVENTORY_SEARCH_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Root Cause
- Evidence
- Database Queries
- Coordinate Verification
- Fixes Applied

## `INGESTION_AUTOMATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Implementation Complete
- Files Created/Modified
- New Files
- Modified Files
- Key Features

## `GET_RAILWAY_ERROR_STEPS.md`
**Purpose**: Documentation file
**Key Content**:
- Ready to Capture Actual Error
- Step 1: Open Railway Dashboard Logs
- Step 2: Run Diagnostic Script (This Will Trigger the Error)
- Step 3: Immediately Check Railway Logs
- Step 4: Copy the ACTUAL Error

## `FIX_SYNC_500_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Problem Summary
- Root Cause
- Quick Fix Steps
- 1. Verify Railway Environment Variables
- 2. Add Missing Supabase Config to Railway

## `DEPLOY_VERCEL.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Deploy via CLI
- Step 2: Set Environment Variables
- Step 3: Redeploy with Environment Variables
- Step 4: Configure Supabase Redirect URLs
- Step 5: Test

## `DEPLOYMENT_STATUS_FINAL.md`
**Purpose**: Documentation file
**Key Content**:
- Current Situation
- What Was Done
- Next Steps
- Verification

## `DEPLOYMENT_STATUS.md`
**Purpose**: Documentation file
**Key Content**:
- ✅ Code Changes Deployed
- Changes Included:
- Deployment Method
- ✅ Git Push Complete
- Next Steps

## `DEPLOYMENT_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Files Committed and Pushed
- Git Commits
- Current Status
- Required Vercel Dashboard Configuration
- Settings → General

## `DEPLOYMENT_FINAL_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Summary
- Latest Deployment
- Configuration Applied
- Current Status
- Action Required: Clear Build Cache

## `CHECK_RAILWAY_LOGS_NOW.md`
**Purpose**: Documentation file
**Key Content**:
- Direct Access
- What to Look For (Around 16:39 UTC)
- Search/Filter for:
- Error Patterns:
- Copy Here:

## `CAPTURE_RAILWAY_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Tail Railway Logs
- Option A: Railway CLI
- Option B: Railway Dashboard
- Step 2: Run Diagnostic Script
- Step 3: Check Logs Again

## `CAPTURE_ACTUAL_RAILWAY_ERROR.md`
**Purpose**: Documentation file
**Key Content**:
- Step 1: Prepare to Monitor Railway Logs
- Railway Dashboard Method (Recommended)
- Search Terms to Use:
- Step 2: Run Diagnostic Script (This will trigger the error)
- Step 3: Immediately Check Railway Logs

## `APPS_SDK_SETUP_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- 1. pnpm Setup
- Status: ✅ **Success**
- 2. Apps SDK Installation Attempts
- Status: ❌ **Package Not Found**

## `APPS_SDK_MANIFEST_VALIDATION_REPORT.md`
**Purpose**: 'Search Rock Hill GMC inventory and submit leads.',
**Key Content**:
- Executive Summary
- Overall Status: **FAIL**
- 1. Schema Sources Location
- 1.1 Expected Manifest File
- 1.2 Package.json Analysis

## `scripts/README_MARKDOWN_UPDATER.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Usage
- One-time Update
- Watch Mode
- How It Works

## `node_modules/typescript/SECURITY.md`
**Purpose**: Documentation file
**Key Content**:
- Security
- Reporting Security Issues
- Preferred Languages
- Policy

## `node_modules/typescript/README.md`
**Purpose**: Documentation file
**Key Content**:
- Installing
- Contribute
- Documentation
- Roadmap

## `node_modules/turbo/README.md`
**Purpose**: Documentation file
**Key Content**:
- Getting Started
- Community
- Who is using Turbo?
- Updates
- Author

## `node_modules/prettier/THIRD-PARTY-NOTICES.md`
**Purpose**: Documentation file
**Key Content**:
- @angular/compiler@v20.0.5
- @babel/code-frame@v7.27.1
- @babel/helper-validator-identifier@v7.27.1
- @babel/parser@v7.27.7
- @glimmer/syntax@v0.94.9

## `node_modules/prettier/README.md`
**Purpose**: Documentation file
**Key Content**:
- Intro
- Input
- Output
- Badge
- Contributing

## `node_modules/eslint/README.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Installation and Usage
- Configuration
- Code of Conduct
- Filing Issues

## `node_modules/eslint-visitor-keys/README.md`
**Purpose**: Documentation file
**Key Content**:
- 💿 Installation
- Requirements
- 📖 Usage
- evk.KEYS
- evk.getKeys(node)

## `node_modules/eslint-scope/README.md`
**Purpose**: Documentation file
**Key Content**:
- Install
- 📖 Usage
- Contributing
- Build Commands
- License

## `node_modules/eslint-plugin-react/README.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Configuration (legacy: `.eslintrc*`) <a id="configuration"></a>
- Shareable configs
- Recommended
- All

## `node_modules/eslint-plugin-react-hooks/README.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Legacy Config (.eslintrc)
- Flat Config (eslint.config.js)
- Custom Configuration
- Legacy Config (.eslintrc)

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/tabindex-no-positive.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/scope.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/role-supports-aria-props.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/role-has-required-aria-props.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/prefer-tag-over-role.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-static-element-interactions.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: This element acts like a button, link, menuitem, etc
- Case: The event handler is only being used to capture bubbled events
- Rule options
- Succeed

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-redundant-roles.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-onchange.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-noninteractive-tabindex.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: I am using an `<a>` tag. Isn't that interactive?
- Case: I am using "semantic" HTML. Isn't that interactive?
- Case: Shouldn't I add a tabindex so that users can navigate to this item?
- Rule options

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-noninteractive-element-to-interactive-role.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: This element should be a control, like a button
- Rule options
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-noninteractive-element-interactions.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: This element acts like a button, link, menuitem, etc
- Case: This element is catching bubbled events from elements that it contains
- Case: This is a heading that expands/collapses content on the package
- Case: This element is a table cell

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-interactive-element-to-noninteractive-role.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: The element should be a container, like an article
- Case: The element should be content, like an image
- Rule options
- Accessibility guidelines

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-distracting-elements.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-autofocus.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-aria-hidden-on-focusable.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/no-access-key.md`
**Purpose**: Documentation file
**Key Content**:
- References
- Rule details
- Succeed
- Fail
- Accessibility guidelines

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/mouse-events-have-key-events.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/media-has-caption.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/lang.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/label-has-for.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Bad
- Good
- Succeed
- Fail

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/label-has-associated-control.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: I just want a text label associated with an input.
- Case: The label is a sibling of the control.
- Case: My label and input components are custom components.
- Case: I have two labels for the same input

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/interactive-supports-focus.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: I got the error "Elements with the '${role}' interactive role must be tabbable". How can I fix this?
- Case: I got the error "Elements with the '${role}' interactive role must be focusable". How can I fix this?
- Case: This element is not a button, link, menuitem, etc. It is catching bubbled events from elements that it contains
- Rule options

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/img-redundant-alt.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/iframe-has-title.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/html-has-lang.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/heading-has-content.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Bad
- Succeed
- Fail
- Accessibility guidelines

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/control-has-associated-label.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: I have a simple button that requires a label.
- Case: I have an icon button and I don't want visible text.
- Case: The label for my element is already located on the page and I don't want to repeat the text in my source code.
- Case: My label and input components are custom components, but I still want to require that they have an accessible text label.

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/click-events-have-key-events.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/autocomplete-valid.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/aria-unsupported-elements.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/aria-role.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/aria-proptypes.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/aria-props.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/aria-activedescendant-has-tabindex.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/anchor-is-valid.md`
**Purpose**: Documentation file
**Key Content**:
- How do I resolve this error?
- Case: I want to perform an action and need a clickable UI element
- Case: I want navigable links
- Case: I need the HTML to be interactive, don't I need to use an a tag for that?
- Case: I use Next.js and I'm getting this error inside of `<Link>`s

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/anchor-has-content.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/anchor-ambiguous-text.md`
**Purpose**: Documentation file
**Key Content**:
- Rule options
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/alt-text.md`
**Purpose**: Documentation file
**Key Content**:
- How to resolve
- `<img>`
- `<object>`
- `<input type="image">`
- `<area>`

## `node_modules/eslint-plugin-jsx-a11y/docs/rules/accessible-emoji.md`
**Purpose**: Documentation file
**Key Content**:
- Rule details
- Succeed
- Fail
- Accessibility guidelines
- Resources

## `node_modules/eslint-plugin-jsx-a11y/README.md`
**Purpose**: Documentation file
**Key Content**:
- _Read this in [other languages](https://github.com/ari-os310/eslint-plugin-jsx-a11y/blob/HEAD/translations/Translations.md)._
- Why?
- Installation
- Usage - Legacy Config (`.eslintrc`)
- Configurations

## `node_modules/eslint-plugin-jsx-a11y/LICENSE.md`
**Purpose**: Documentation file

## `node_modules/eslint-plugin-jsx-a11y/CHANGELOG.md`
**Purpose**: Documentation file
**Key Content**:
- [v6.10.2](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/compare/v6.10.1...v6.10.2) - 2024-10-25
- Fixed
- Commits
- [v6.10.1](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/compare/v6.10.0...v6.10.1) - 2024-10-20
- Commits

## `node_modules/eslint-plugin-import/memo-parser/README.md`
**Purpose**: Documentation file
**Key Content**:
- NOTE

## `node_modules/eslint-plugin-import/docs/rules/unambiguous.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- When Not To Use It
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/prefer-default-export.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- rule schema
- Config Options
- single
- any

## `node_modules/eslint-plugin-import/docs/rules/order.md`
**Purpose**: Documentation file
**Key Content**:
- Fail
- Pass
- Limitations of `--fix`
- Options
- `groups`

## `node_modules/eslint-plugin-import/docs/rules/no-webpack-loader-syntax.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Fail
- Pass
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-useless-path-segments.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Options
- noUselessIndex
- commonjs

## `node_modules/eslint-plugin-import/docs/rules/no-unused-modules.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Usage
- Options
- Example for missing exports
- The following will be reported

## `node_modules/eslint-plugin-import/docs/rules/no-unresolved.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Options
- `ignore`
- `caseSensitive`
- `caseSensitiveStrict`

## `node_modules/eslint-plugin-import/docs/rules/no-unassigned-import.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- Fail
- Pass

## `node_modules/eslint-plugin-import/docs/rules/no-self-import.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Fail
- Pass

## `node_modules/eslint-plugin-import/docs/rules/no-restricted-paths.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Examples

## `node_modules/eslint-plugin-import/docs/rules/no-relative-parent-imports.md`
**Purpose**: Documentation file
**Key Content**:
- Examples

## `node_modules/eslint-plugin-import/docs/rules/no-relative-packages.md`
**Purpose**: Documentation file
**Key Content**:
- Examples

## `node_modules/eslint-plugin-import/docs/rules/no-nodejs-modules.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- Rule Details
- Fail
- Pass
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-namespace.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- Rule Details
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-named-export.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-named-default.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details

## `node_modules/eslint-plugin-import/docs/rules/no-named-as-default.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/no-named-as-default-member.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details

## `node_modules/eslint-plugin-import/docs/rules/no-mutable-exports.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Functions/Classes
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-internal-modules.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Examples

## `node_modules/eslint-plugin-import/docs/rules/no-import-module-exports.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- `exceptions`
- Rule Details
- Fail
- Pass

## `node_modules/eslint-plugin-import/docs/rules/no-extraneous-dependencies.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- Rule Details
- Fail
- Pass
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-empty-named-blocks.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Valid
- Invalid

## `node_modules/eslint-plugin-import/docs/rules/no-dynamic-require.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Fail
- Pass

## `node_modules/eslint-plugin-import/docs/rules/no-duplicates.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Query Strings
- Inline Type imports
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-deprecated.md`
**Purpose**: Documentation file
**Key Content**:
- Worklist

## `node_modules/eslint-plugin-import/docs/rules/no-default-export.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-cycle.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Options
- `maxDepth`
- `ignoreExternal`
- `allowUnsafeDynamicCyclicDependency`

## `node_modules/eslint-plugin-import/docs/rules/no-commonjs.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Allow require
- Allow conditional require
- Allow primitive modules
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/no-anonymous-default-export.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- Rule Details
- Fail
- Pass

## `node_modules/eslint-plugin-import/docs/rules/no-amd.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- When Not To Use It
- Contributors
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/no-absolute-path.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Fail
- Pass
- Options

## `node_modules/eslint-plugin-import/docs/rules/newline-after-import.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Example options usage
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/namespace.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Options
- `allowComputed`
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/named.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Settings
- When Not To Use It
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/max-dependencies.md`
**Purpose**: Documentation file
**Key Content**:
- Options
- `max`
- Fail
- Pass
- `ignoreTypeImports`

## `node_modules/eslint-plugin-import/docs/rules/imports-first.md`
**Purpose**: Documentation file

## `node_modules/eslint-plugin-import/docs/rules/group-exports.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Valid
- Invalid
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/first.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- On directives
- With Fixer
- When Not To Use It
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/extensions.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- `PathGroupOverride`
- Exception
- Examples
- When Not To Use It

## `node_modules/eslint-plugin-import/docs/rules/exports-last.md`
**Purpose**: Documentation file
**Key Content**:
- This will be reported
- This will not be reported
- When Not To Use It
- ES6 exports only

## `node_modules/eslint-plugin-import/docs/rules/export.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/enforce-node-protocol-usage.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Options
- Examples
- `'always'`
- `'never'`

## `node_modules/eslint-plugin-import/docs/rules/dynamic-import-chunkname.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- invalid
- valid
- `allowEmpty: true`
- valid

## `node_modules/eslint-plugin-import/docs/rules/default.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- When Not To Use It
- Further Reading

## `node_modules/eslint-plugin-import/docs/rules/consistent-type-specifier-style.md`
**Purpose**: Documentation file
**Key Content**:
- Rule Details
- Options
- Examples
- `prefer-top-level`
- `prefer-inline`

## `node_modules/eslint-plugin-import/SECURITY.md`
**Purpose**: Documentation file
**Key Content**:
- Supported Versions
- Reporting a Vulnerability

## `node_modules/eslint-plugin-import/README.md`
**Purpose**: Documentation file
**Key Content**:
- Rules
- Helpful warnings
- Module systems
- Static analysis
- Style guide

## `node_modules/eslint-plugin-import/CHANGELOG.md`
**Purpose**: Documentation file
**Key Content**:
- [Unreleased]
- [2.32.0] - 2025-06-20
- Added
- Fixed
- Changed

## `node_modules/eslint-module-utils/CHANGELOG.md`
**Purpose**: Documentation file
**Key Content**:
- Unreleased
- v2.12.1 - 2025-06-19
- Fixed
- Changed
- v2.12.0 - 2024-09-26

## `node_modules/eslint-import-resolver-typescript/README.md`
**Purpose**: Documentation file
**Key Content**:
- TOC <!-- omit in toc -->
- Notice
- Installation
- `eslint-plugin-import`
- `eslint-plugin-import-x`

## `node_modules/eslint-import-resolver-node/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/visitor-keys/README.md`
**Purpose**: Documentation file
**Key Content**:
- ✋ Internal Package

## `node_modules/@typescript-eslint/utils/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/typescript-estree/README.md`
**Purpose**: Documentation file
**Key Content**:
- Contributing

## `node_modules/@typescript-eslint/types/README.md`
**Purpose**: Documentation file
**Key Content**:
- ✋ Internal Package

## `node_modules/@typescript-eslint/type-utils/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/tsconfig-utils/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/scope-manager/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/project-service/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/parser/README.md`
**Purpose**: Documentation file

## `node_modules/@typescript-eslint/eslint-plugin/README.md`
**Purpose**: Documentation file

## `node_modules/@types/node/README.md`
**Purpose**: Documentation file
**Key Content**:
- Additional Details

## `node_modules/@rushstack/eslint-patch/README.md`
**Purpose**: Documentation file
**Key Content**:
- *.eslint-bulk-suppressions.json**

## `node_modules/@rushstack/eslint-patch/CHANGELOG.md`
**Purpose**: Documentation file
**Key Content**:
- 1.14.0
- Minor changes
- 1.13.0
- Minor changes
- 1.12.0

## `node_modules/@eslint/js/README.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Usage
- License

## `node_modules/@eslint/eslintrc/README.md`
**Purpose**: Documentation file
**Key Content**:
- Installation
- Usage (ESM)
- Usage (CommonJS)
- License

## `node_modules/@eslint-community/regexpp/README.md`
**Purpose**: Documentation file
**Key Content**:
- 💿 Installation
- 📖 Usage
- parseRegExpLiteral(source, options?)
- validateRegExpLiteral(source, options?)
- visitRegExpAST(ast, handlers)

## `node_modules/@eslint-community/eslint-utils/README.md`
**Purpose**: Documentation file
**Key Content**:
- 🏁 Goal
- 📖 Usage
- 📰 Changelog
- ❤️ Contributing
- Development Tools


## App-Specific Documentation

#
#
#
#
#
#
#
#
#
#
#
#
### `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Database Schema Verification
- 1. Verify FK Constraints on Leads Table
- 2. Verify FK Constraints on Analytics Events Table
- API Endpoint Verification

## `apps/dealer-dashboard/docs/INGESTION_AUTOMATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Server Action
- Onboarding Trigger
- Nightly Refresh
- Setting Up Vercel Cron

## `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Step 1: Apply Migration
- Step 2: Verify Code Alignment
- Step 3: Test Endpoints
- Migration Details

## `apps/dealer-dashboard/docs/ANALYTICS_REFRESH_WORKER.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Refresh Mechanisms
- Option 1: Node.js Worker (Recommended for Development)
- Running the Worker
- Environment Variables

## `apps/dealer-dashboard/docs/TENANT_ISOLATION_MONITORING.md`
**Purpose**: Documentation file
**Key Content**:
- Daily Detection Query
- Expected Results
- Incident Response Workflow
- Step 1: Verify the Incident
- Step 2: Determine Root Cause

## `apps/dealer-dashboard/docs/INGESTION_AUTOMATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Server Action
- Onboarding Trigger
- Nightly Refresh
- Setting Up Vercel Cron

## `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Step 1: Apply Migration
- Step 2: Verify Code Alignment
- Step 3: Test Endpoints
- Migration Details

## `apps/dealer-dashboard/docs/ANALYTICS_REFRESH_WORKER.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Refresh Mechanisms
- Option 1: Node.js Worker (Recommended for Development)
- Running the Worker
- Environment Variables

## `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Database Schema Verification
- 1. Verify FK Constraints on Leads Table
- 2. Verify FK Constraints on Analytics Events Table
- API Endpoint Verification

## `apps/dealer-dashboard/docs/TENANT_ISOLATION_MONITORING.md`
**Purpose**: Documentation file
**Key Content**:
- Daily Detection Query
- Expected Results
- Incident Response Workflow
- Step 1: Verify the Incident
- Step 2: Determine Root Cause

## `apps/dealer-dashboard/docs/INGESTION_AUTOMATION.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Server Action
- Onboarding Trigger
- Nightly Refresh
- Setting Up Vercel Cron

## `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Step 1: Apply Migration
- Step 2: Verify Code Alignment
- Step 3: Test Endpoints
- Migration Details

## `apps/dealer-dashboard/docs/ANALYTICS_REFRESH_WORKER.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Refresh Mechanisms
- Option 1: Node.js Worker (Recommended for Development)
- Running the Worker
- Environment Variables


## Core Documentation Hub

#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
### `docs/lead_tool_contract.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Tool Name
- Input Schema
- Required Fields
- Vehicle Identifiers (from UVS)

## `docs/architecture/uvs.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Design Principles
- Schema Structure
- Field Naming Conventions
- camelCase

## `docs/analysis/vehicle-detail-modal-analysis.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- 📊 Currently Stored in Database (UVS Schema)
- ✅ **Base Identity** (Stored)
- ✅ **Core Specs** (Stored)
- ⚠️ **Dimensions & Performance** (Schema exists, but NOT populated from MarketCheck)

## `docs/VERCEL_LOGS_ANALYSIS.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Critical Issues
- 1. **Inventory Page 500 Errors** 🔴
- 2. **Missing Analytics Tables** 🟡
- 3. **Analytics Validation Errors** 🟡

## `docs/VERCEL_DEMO_ACCOUNT_SETUP.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Option 1: Automated Setup (Recommended)
- Option 2: Manual SQL Setup
- Demo Credentials
- What Gets Set Up

## `docs/QUERY_PARSING_TEST_RESULTS.md`
**Purpose**: Documentation file
**Key Content**:
- Cache + Rate Limit Validation
- Test Execution Summary
- ✅ Baseline Request
- ✅ Cache Test
- ⚠️ Rate Limit Test

## `docs/QUERY_PARSING_TEST_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Cache + Rate Limit Validation
- Test Script Created
- How to Run Tests
- Prerequisites
- Run Full Test Suite

## `docs/QUERY_PARSING_STAGE_4_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Query Parsing + Inventory Search Scale Preparation
- Files Changed
- 1. Query Parse API
- 2. Documentation
- Behavior Summary

## `docs/QUERY_PARSING_STAGE_1_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- OpenAI Query Parsing API for iOS Inventory Search
- Files Changed
- 1. New API Route
- 2. Dependencies
- API Endpoint

## `docs/QUERY_PARSING_STAGE_0_DISCOVERY.md`
**Purpose**: Documentation file
**Key Content**:
- OpenAI Query Parsing API for iOS Inventory Search
- Files Read
- Core API Files
- iOS Files
- Documentation

## `docs/QUERY_PARSING_SCALE_PREP.md`
**Purpose**: Documentation file
**Key Content**:
- Caching, Rate Limiting, and Database Optimization
- Overview
- 1. Query Parse Caching Strategy
- Implementation
- Cache Behavior

## `docs/ONBOARDING_ISOLATION_HARDENING_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Changes Implemented
- 1. Isolate Demo vs Production Data Paths
- 2. Tighten `user_dealerships` Insert RLS
- 3. Keep Signup Trigger Minimal and Auditable

## `docs/MAPBOX_GEOCODING_NOTE.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Configuration
- Environment Variable
- API Endpoint
- Implementation Details

## `docs/LOCATION_HANDLING_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- STAGE 1 — Backend (dealer-dashboard)
- Files Changed
- Geocoding Service
- Example Parse Response with Location

## `docs/IOS_LIVE_APP_PLAN.md`
**Purpose**: Documentation file
**Key Content**:
- Purpose
- Scope
- Why This Approach
- Environments
- Staging

## `docs/EXPLICIT_FIELDS_IMPLEMENTATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Deliverable
- Files Changed
- Implementation Summary
- Test Response Snippets
- Test 1: "cars near Rock Hill, SC"

## `docs/EXPLICIT_FIELDS_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Implementation
- Step 1: Updated Schema (OpenAI Structured Output)
- Step 2: Updated System Prompt
- Step 3: Updated Parsing Logic

## `docs/06-LEAD-DELIVERY-CRM.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Lead Delivery Overview
- Objective
- Implementation Status
- Current Notes

## `docs/05-MARKETCHECK-INTEGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Current Status
- Active Test Dealer
- Previous Dealer
- Implementation Status

## `docs/04-TESTING-QUALITY.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- ChatGPT Smoke Test Guide
- Purpose
- Prerequisites
- Environment Prep

## `docs/03-API-INTEGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- AutoAgent MCP API
- Overview
- Authentication
- MCP Endpoints

## `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Project Overview
- Technical Stack
- What to Deploy
- Deployment Strategy

## `docs/01-CORE-DOCUMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Project Overview
- Key Capabilities
- Architecture Snapshot
- Quick Start Guide

## `docs/enhancements/INVALID_INVENTORY_MANAGEMENT_PROPOSAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Problem Statement
- Proposed Solution
- Architecture Overview
- 1. Database Schema Changes

## `docs/architecture/uvs.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Design Principles
- Schema Structure
- Field Naming Conventions
- camelCase

## `docs/analysis/vehicle-detail-modal-analysis.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- 📊 Currently Stored in Database (UVS Schema)
- ✅ **Base Identity** (Stored)
- ✅ **Core Specs** (Stored)
- ⚠️ **Dimensions & Performance** (Schema exists, but NOT populated from MarketCheck)

## `docs/VERCEL_LOGS_ANALYSIS.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Critical Issues
- 1. **Inventory Page 500 Errors** 🔴
- 2. **Missing Analytics Tables** 🟡
- 3. **Analytics Validation Errors** 🟡

## `docs/VERCEL_DEMO_ACCOUNT_SETUP.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Option 1: Automated Setup (Recommended)
- Option 2: Manual SQL Setup
- Demo Credentials
- What Gets Set Up

## `docs/RECONCILED_MARKDOWN_STATUS_2026-02-24.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- Canonical Current State
- Reconciliation Rules
- Disposition Summary
- Highest-Priority Contradictions Resolved

## `docs/QUERY_PARSING_TEST_RESULTS.md`
**Purpose**: Documentation file
**Key Content**:
- Cache + Rate Limit Validation
- Test Execution Summary
- ✅ Baseline Request
- ✅ Cache Test
- ⚠️ Rate Limit Test

## `docs/QUERY_PARSING_TEST_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Cache + Rate Limit Validation
- Test Script Created
- How to Run Tests
- Prerequisites
- Run Full Test Suite

## `docs/QUERY_PARSING_STAGE_4_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Query Parsing + Inventory Search Scale Preparation
- Files Changed
- 1. Query Parse API
- 2. Documentation
- Behavior Summary

## `docs/QUERY_PARSING_STAGE_1_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- OpenAI Query Parsing API for iOS Inventory Search
- Files Changed
- 1. New API Route
- 2. Dependencies
- API Endpoint

## `docs/QUERY_PARSING_STAGE_0_DISCOVERY.md`
**Purpose**: Documentation file
**Key Content**:
- OpenAI Query Parsing API for iOS Inventory Search
- Files Read
- Core API Files
- iOS Files
- Documentation

## `docs/QUERY_PARSING_SCALE_PREP.md`
**Purpose**: Documentation file
**Key Content**:
- Caching, Rate Limiting, and Database Optimization
- Overview
- 1. Query Parse Caching Strategy
- Implementation
- Cache Behavior

## `docs/QUERY_PARSING_PRODUCTION_TEST_REPORT.md`
**Purpose**: '...' },
**Key Content**:
- Test Results
- ✅ Test 1: POST Request (Valid API Key)
- ✅ Test 2: GET Request (Method Not Allowed)
- ✅ Test 3: Rate Limiting
- Test Summary

## `docs/QUERY_PARSING_FIX_COMPLETE.md`
**Purpose**: '...' },
**Key Content**:
- Fix Applied: Option A
- Changes Made
- Files Changed
- Production Test Results
- ✅ Test 1: POST Request (Valid API Key)

## `docs/QUERY_PARSING_DEPLOYMENT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Actions Taken
- 1. Git Commit
- 2. Git Push
- 3. Vercel Auto-Deployment
- Next Steps

## `docs/ONBOARDING_ISOLATION_HARDENING_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Changes Implemented
- 1. Isolate Demo vs Production Data Paths
- 2. Tighten `user_dealerships` Insert RLS
- 3. Keep Signup Trigger Minimal and Auditable

## `docs/MAPBOX_GEOCODING_NOTE.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Configuration
- Environment Variable
- API Endpoint
- Implementation Details

## `docs/MAPBOX_GEOCODING_IMPLEMENTATION_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Files Changed
- Backend
- Documentation
- Implementation Details

## `docs/LOCATION_HANDLING_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- STAGE 1 — Backend (dealer-dashboard)
- Files Changed
- Geocoding Service
- Example Parse Response with Location

## `docs/IOS_LIVE_APP_PLAN.md`
**Purpose**: Documentation file
**Key Content**:
- Purpose
- Scope
- Why This Approach
- Environments
- Staging

## `docs/EXPLICIT_FIELDS_IMPLEMENTATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Deliverable
- Files Changed
- Implementation Summary
- Test Response Snippets
- Test 1: "cars near Rock Hill, SC"

## `docs/EXPLICIT_FIELDS_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Implementation
- Step 1: Updated Schema (OpenAI Structured Output)
- Step 2: Updated System Prompt
- Step 3: Updated Parsing Logic

## `docs/DEFAULT_FILTER_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Problem
- Solution
- Changes Made
- Files Changed
- Cache Issue

## `docs/06-LEAD-DELIVERY-CRM.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Lead Delivery Overview
- Objective
- Implementation Status
- Current Notes

## `docs/05-MARKETCHECK-INTEGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Current Status
- Active Test Dealer
- Previous Dealer
- Implementation Status

## `docs/04-TESTING-QUALITY.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- ChatGPT Smoke Test Guide
- Purpose
- Prerequisites
- Environment Prep

## `docs/03-API-INTEGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- AutoAgent MCP API
- Overview
- Authentication
- MCP Endpoints

## `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Project Overview
- Technical Stack
- What to Deploy
- Deployment Strategy

## `docs/01-CORE-DOCUMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Project Overview
- Key Capabilities
- Architecture Snapshot
- Quick Start Guide

## `docs/lead_tool_contract.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Tool Name
- Input Schema
- Required Fields
- Vehicle Identifiers (from UVS)

## `docs/enhancements/INVALID_INVENTORY_MANAGEMENT_PROPOSAL.md`
**Purpose**: Documentation file
**Key Content**:
- Executive Summary
- Problem Statement
- Proposed Solution
- Architecture Overview
- 1. Database Schema Changes

## `docs/architecture/uvs.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Design Principles
- Schema Structure
- Field Naming Conventions
- camelCase

## `docs/analysis/vehicle-detail-modal-analysis.md`
**Purpose**: Documentation file
**Key Content**:
- Goal
- 📊 Currently Stored in Database (UVS Schema)
- ✅ **Base Identity** (Stored)
- ✅ **Core Specs** (Stored)
- ⚠️ **Dimensions & Performance** (Schema exists, but NOT populated from MarketCheck)

## `docs/VERCEL_LOGS_ANALYSIS.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Critical Issues
- 1. **Inventory Page 500 Errors** 🔴
- 2. **Missing Analytics Tables** 🟡
- 3. **Analytics Validation Errors** 🟡

## `docs/VERCEL_DEMO_ACCOUNT_SETUP.md`
**Purpose**: Documentation file
**Key Content**:
- Quick Start
- Option 1: Automated Setup (Recommended)
- Option 2: Manual SQL Setup
- Demo Credentials
- What Gets Set Up

## `docs/RECONCILED_MARKDOWN_STATUS_2026-02-24.md`
**Purpose**: Documentation file
**Key Content**:
- Scope
- Canonical Current State
- Reconciliation Rules
- Disposition Summary
- Highest-Priority Contradictions Resolved

## `docs/QUERY_PARSING_TEST_RESULTS.md`
**Purpose**: Documentation file
**Key Content**:
- Cache + Rate Limit Validation
- Test Execution Summary
- ✅ Baseline Request
- ✅ Cache Test
- ⚠️ Rate Limit Test

## `docs/QUERY_PARSING_TEST_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- Cache + Rate Limit Validation
- Test Script Created
- How to Run Tests
- Prerequisites
- Run Full Test Suite

## `docs/QUERY_PARSING_STAGE_4_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Query Parsing + Inventory Search Scale Preparation
- Files Changed
- 1. Query Parse API
- 2. Documentation
- Behavior Summary

## `docs/QUERY_PARSING_STAGE_1_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- OpenAI Query Parsing API for iOS Inventory Search
- Files Changed
- 1. New API Route
- 2. Dependencies
- API Endpoint

## `docs/QUERY_PARSING_STAGE_0_DISCOVERY.md`
**Purpose**: Documentation file
**Key Content**:
- OpenAI Query Parsing API for iOS Inventory Search
- Files Read
- Core API Files
- iOS Files
- Documentation

## `docs/QUERY_PARSING_SCALE_PREP.md`
**Purpose**: Documentation file
**Key Content**:
- Caching, Rate Limiting, and Database Optimization
- Overview
- 1. Query Parse Caching Strategy
- Implementation
- Cache Behavior

## `docs/QUERY_PARSING_PRODUCTION_TEST_REPORT.md`
**Purpose**: '...' },
**Key Content**:
- Test Results
- ✅ Test 1: POST Request (Valid API Key)
- ✅ Test 2: GET Request (Method Not Allowed)
- ✅ Test 3: Rate Limiting
- Test Summary

## `docs/QUERY_PARSING_FIX_COMPLETE.md`
**Purpose**: '...' },
**Key Content**:
- Fix Applied: Option A
- Changes Made
- Files Changed
- Production Test Results
- ✅ Test 1: POST Request (Valid API Key)

## `docs/QUERY_PARSING_DEPLOYMENT.md`
**Purpose**: Documentation file
**Key Content**:
- Deployment Actions Taken
- 1. Git Commit
- 2. Git Push
- 3. Vercel Auto-Deployment
- Next Steps

## `docs/MAPBOX_GEOCODING_NOTE.md`
**Purpose**: Documentation file
**Key Content**:
- Overview
- Configuration
- Environment Variable
- API Endpoint
- Implementation Details

## `docs/MAPBOX_GEOCODING_IMPLEMENTATION_COMPLETE.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Files Changed
- Backend
- Documentation
- Implementation Details

## `docs/LOCATION_HANDLING_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- STAGE 1 — Backend (dealer-dashboard)
- Files Changed
- Geocoding Service
- Example Parse Response with Location

## `docs/IOS_LIVE_APP_PLAN.md`
**Purpose**: Documentation file
**Key Content**:
- Purpose
- Scope
- Why This Approach
- Environments
- Staging

## `docs/EXPLICIT_FIELDS_IMPLEMENTATION_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Deliverable
- Files Changed
- Implementation Summary
- Test Response Snippets
- Test 1: "cars near Rock Hill, SC"

## `docs/EXPLICIT_FIELDS_IMPLEMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Summary
- Implementation
- Step 1: Updated Schema (OpenAI Structured Output)
- Step 2: Updated System Prompt
- Step 3: Updated Parsing Logic

## `docs/DEFAULT_FILTER_FIX_SUMMARY.md`
**Purpose**: Documentation file
**Key Content**:
- Problem
- Solution
- Changes Made
- Files Changed
- Cache Issue

## `docs/06-LEAD-DELIVERY-CRM.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Lead Delivery Overview
- Objective
- Implementation Status
- Current Notes

## `docs/05-MARKETCHECK-INTEGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Current Status
- Active Test Dealer
- Previous Dealer
- Implementation Status

## `docs/04-TESTING-QUALITY.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- ChatGPT Smoke Test Guide
- Purpose
- Prerequisites
- Environment Prep

## `docs/03-API-INTEGRATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- AutoAgent MCP API
- Overview
- Authentication
- MCP Endpoints

## `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Project Overview
- Technical Stack
- What to Deploy
- Deployment Strategy

## `docs/01-CORE-DOCUMENTATION.md`
**Purpose**: Documentation file
**Key Content**:
- Table of Contents
- Project Overview
- Key Capabilities
- Architecture Snapshot
- Quick Start Guide


## Deployment Documentation

#
#
#
#
#
#
#
#
#
### `docs/deployment/VERCEL_DOMAIN_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Issue
- Solution: Configure via Vercel Dashboard
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration

## `docs/deployment/QUICK_DEPLOY_GUIDE.md`
**Purpose**: Documentation file
**Key Content**:
- 🚀 Railway Deployment (MCP Server)
- How to Deploy to Railway:
- Verify Deployment:
- Optional: Trigger Script
- 🌐 Vercel Deployment (Dealer Dashboard)

## `docs/deployment/LOGIN_HANG_FIX_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- 🔍 Root Cause Identified
- Console Error Found
- Network Request Analysis
- ✅ Fixes Applied
- 1. Improved Error Handling in Auth Page

## `docs/deployment/VERCEL_DEPLOYMENT.md`
**Purpose**: Documentation file
**Key Content**:
- Prerequisites
- Quick Deploy (Recommended)
- Option 1: Deploy via Vercel Dashboard
- Option 2: Deploy via Vercel CLI
- Monorepo Configuration

## `docs/deployment/QUICK_DEPLOY_GUIDE.md`
**Purpose**: Documentation file
**Key Content**:
- 🚀 Railway Deployment (MCP Server)
- How to Deploy to Railway:
- Verify Deployment:
- Optional: Trigger Script
- 🌐 Vercel Deployment (Dealer Dashboard)

## `docs/deployment/LOGIN_HANG_FIX_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- 🔍 Root Cause Identified
- Console Error Found
- Network Request Analysis
- ✅ Fixes Applied
- 1. Improved Error Handling in Auth Page

## `docs/deployment/VERCEL_DOMAIN_FIX.md`
**Purpose**: Documentation file
**Key Content**:
- Current Status
- Issue
- Solution: Configure via Vercel Dashboard
- Step 1: Update Project Settings
- Step 2: Verify Domain Configuration

## `docs/deployment/VERCEL_DEPLOYMENT.md`
**Purpose**: Documentation file
**Key Content**:
- Prerequisites
- Quick Deploy (Recommended)
- Option 1: Deploy via Vercel Dashboard
- Option 2: Deploy via Vercel CLI
- Monorepo Configuration

## `docs/deployment/QUICK_DEPLOY_GUIDE.md`
**Purpose**: Documentation file
**Key Content**:
- 🚀 Railway Deployment (MCP Server)
- How to Deploy to Railway:
- Verify Deployment:
- Optional: Trigger Script
- 🌐 Vercel Deployment (Dealer Dashboard)

## `docs/deployment/LOGIN_HANG_FIX_REPORT.md`
**Purpose**: Documentation file
**Key Content**:
- 🔍 Root Cause Identified
- Console Error Found
- Network Request Analysis
- ✅ Fixes Applied
- 1. Improved Error Handling in Auth Page


## 📊 Summary Statistics

- **Total Markdown Files**: 72
- **Root-Level Files**: 4
- **Core Documentation**: 7
- **API Documentation**: 4
- **Deployment Documentation**: 13
- **Testing Documentation**: 10
- **MarketCheck Integration**: 23
- **Lead Delivery**: 2
- **Design Documentation**: 5
- **Operations & Support**: 1
- **App-Specific**: 1

---

## 🎯 Key Documentation Patterns

1. **Status Files**: Many files end with `_STATUS.md` or `STATUS.md` - these track current state and pending actions
2. **Summary Files**: Files with `_SUMMARY.md` or `SUMMARY.md` provide executive summaries
3. **Guide Files**: Files with `_GUIDE.md` or `GUIDE.md` provide step-by-step instructions
4. **Test/Execution Logs**: Files with `_EXECUTION_LOG.md` or `_TEST.md` track testing progress
5. **Diagnosis/Fix Files**: Files with `_DIAGNOSIS.md` or `_FIX.md` document problem-solving
6. **Audit Files**: Files with `_AUDIT.md` provide detailed analysis

---

## 🔍 Quick Reference by Topic

### Getting Started
- `README.md` - Main entry point
- `docs/README.md` - Documentation hub
- `docs/quickstart.md` - Quick start checklist

### Understanding the System
- `docs/overview.md` - System architecture
- `docs/api.md` - API reference
- `CHANGELOG.md` - Version history

### Deployment
- `DEPLOYMENT_PROMPT_SUMMARY.md` - Deployment summary
- `DEPLOYMENT_CONFIG_SUMMARY.md` - Deployment configuration
- `docs/deployment/production.md` - Production guide
- `docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md` - Railway guide

### MarketCheck Integration
- `docs/marketcheck/STATUS.md` - Current status
- `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` - Onboarding guide
- `docs/api/marketcheck-endpoints.md` - API endpoints

### Testing
- `docs/testing/README_FOR_NEXT_AGENT.md` - Testing quick start
- `docs/testing/chatgpt-smoke-test.md` - Smoke test checklist
- `docs/testing/CONVERSATION_SUMMARY.md` - Testing summary

### Troubleshooting
- `docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md` - Timeout diagnosis
- `docs/marketcheck/SYNC_TROUBLESHOOTING.md` - Sync troubleshooting
- `docs/deployment/CHATGPT_CONNECTIVITY_VERIFICATION.md` - Connectivity guide

---

**Last Updated**: 2026-07-17  
**Total Files Analyzed**: 72

