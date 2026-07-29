# AutoAgent Markdown Reconciliation (2026-02-24)

## Scope
This document reconciles all markdown documentation in this repository as of **2026-02-24**.

- Total markdown files reconciled: **198**
- Inventory source: `rg --files -g '*.md'`
- Reconciliation output: per-file category, disposition, and usage guidance

## Canonical Current State
1. Product stage: **late-stage stabilization / production operations**.
2. Runtime: **MCP production endpoint is healthy and initializes successfully**.
3. Runtime: **dealer dashboard production root responds**.
4. Local build reality:
   - `@autoagent/mcp-server`: build passes.
   - `@autoagent/dealer-dashboard`: build fails locally due to `openai` module resolution mismatch in current install/lock state.
5. Documentation reality: there are many iterative status reports; date precedence is required when interpreting claims.

## Reconciliation Rules
1. **Authoritative**: foundational docs/specs/guides intended as current references.
2. **Reference**: useful scoped docs (component/process-specific), validate against authoritative set.
3. **Historical**: point-in-time reports, incident logs, status snapshots, and phased implementation notes.
4. **Stale**: materially inaccurate relative to repository state.

## Disposition Summary
- **Authoritative**: 16
- **Reference**: 50
- **Historical**: 131
- **Stale**: 1

## Highest-Priority Contradictions Resolved
1. `MARKDOWN_FILES_SUMMARY.md` says 72 markdown files, but repository currently has 198. Marked **Stale**.
2. Multiple deployment status files conflict (some pending, some complete). Reconciled as **Historical snapshots**.
3. Multiple query parsing files conflict (build error, partial pass, fixed/deployed). Reconciled as **Historical stream** with latest docs indicating completion, while local build still exposes a dependency-resolution issue.
4. MarketCheck onboarding files conflict (pending vs complete). Reconciled as **date-scoped execution logs**, not a single evergreen state doc.
5. Phase 4 files contain iterative audit/fix cycles and non-blocking gaps; reconciled as **Historical phase stream**.

## Authoritative Set (Use First)
- `README.md`
- `CHANGELOG.md`
- `docs/README.md`
- `docs/overview.md`
- `docs/quickstart.md`
- `docs/api.md`
- `docs/api/marketcheck-endpoints.md`
- `docs/deployment/production.md`
- `docs/deployment/railway.md`
- `docs/deployment/QUICK_DEPLOY_GUIDE.md`
- `docs/deployment/VERCEL_DEPLOYMENT.md`
- `docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md`
- `docs/lead-delivery/adf-payload.md`
- `docs/architecture/uvs.md`
- `apps/mcp-server/src/ui/README.md`
- `apps/dealer-dashboard/docs/SUPABASE_SETUP.md`

## Full Per-File Reconciliation (198 files)

| File | Last Modified | Category | Disposition | Reconciliation Note |
|---|---|---|---|---|
| `APPS_SDK_MANIFEST_VALIDATION_REPORT.md` | 2025-12-04 | Other | **Historical** | Legacy or point-in-time markdown |
| `APPS_SDK_SETUP_REPORT.md` | 2025-12-04 | Other | **Historical** | Legacy or point-in-time markdown |
| `CAPTURE_ACTUAL_RAILWAY_ERROR.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `CAPTURE_RAILWAY_ERROR.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `CHANGELOG.md` | 2025-11-07 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `CHECK_RAILWAY_LOGS_NOW.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `DEPLOYMENT_CONFIG_SUMMARY.md` | 2025-11-11 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `DEPLOYMENT_FINAL_REPORT.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `DEPLOYMENT_PROMPT_SUMMARY.md` | 2025-11-11 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `DEPLOYMENT_REPORT.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `DEPLOYMENT_STATUS.md` | 2025-12-08 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `DEPLOYMENT_STATUS_FINAL.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `DEPLOY_VERCEL.md` | 2025-11-17 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `FIX_SYNC_500_ERROR.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `GET_RAILWAY_ERROR_STEPS.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `INGESTION_AUTOMATION_SUMMARY.md` | 2025-12-04 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `INVENTORY_SEARCH_FIX_SUMMARY.md` | 2025-12-22 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `INVENTORY_SEARCH_INVESTIGATION_REPORT.md` | 2025-12-22 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `INVESTIGATE_MCP_500_ERROR.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MANIFEST_SETUP_COMPLETE.md` | 2025-12-04 | Other | **Historical** | Legacy or point-in-time markdown |
| `MARKDOWN_CONSOLIDATION_MAPPING.md` | 2025-12-11 | Meta | **Historical** | Consolidation planning artifacts |
| `MARKDOWN_CONSOLIDATION_PROPOSAL.md` | 2025-12-11 | Meta | **Historical** | Consolidation planning artifacts |
| `MARKDOWN_CONSOLIDATION_SUMMARY.md` | 2025-12-11 | Meta | **Historical** | Consolidation planning artifacts |
| `MARKDOWN_FILES_SUMMARY.md` | 2025-11-17 | Meta | **Stale** | Claims 72 files; repo currently has 198 markdown files |
| `MARKETCHECK_PAGINATION_ISSUE_SUMMARY.md` | 2025-12-12 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `MCP_500_DIAGNOSTIC_RESULTS.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_500_ERROR_FINDINGS.md` | 2025-12-08 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_500_ERROR_INVESTIGATION.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_500_ERROR_SUMMARY.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_BUILD_FIX_FINAL.md` | 2025-12-08 | Other | **Historical** | Legacy or point-in-time markdown |
| `MCP_BUILD_FIX_SUMMARY.md` | 2025-12-08 | Other | **Historical** | Legacy or point-in-time markdown |
| `MCP_INGESTION_500_FINDINGS.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_INGESTION_500_INVESTIGATION_SUMMARY.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_INGESTION_INVESTIGATION_REPORT.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MCP_INSTRUMENTATION_SUMMARY.md` | 2025-12-08 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `MIGRATION_APPLY_AND_VERIFY.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `MIGRATION_READY_TO_APPLY.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `OFFICIAL_APPS_SDK_SCHEMA_REPORT.md` | 2025-12-04 | Other | **Historical** | Legacy or point-in-time markdown |
| `PHASE_4_ALL_BLOCKING_DEFECTS_FIXED.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_ALL_DEFECTS_FIXED.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_ALL_DEFECTS_RESOLVED.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_AUDIT_FIXES.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_AUDIT_REPORT.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_AUDIT_RESPONSE.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_AUDIT_RESPONSE_FINAL.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_BLOCKING_FIXES_COMPLETE.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_COMPLETE_FIXES_SUMMARY.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_COMPLETE_FIX_SUMMARY.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_COMPLETE_STATUS.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_COMPREHENSIVE_FIX.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_CRITICAL_DEFECTS_FIXED.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_CRITICAL_FIXES.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_DELIVERY_REPORT.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FINAL_AUDIT_RESPONSE.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FINAL_BLOCKING_FIXES.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FINAL_FIXES.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FINAL_FIXES_COMPLETE.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FINAL_FIXES_SUMMARY.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FINAL_IMPLEMENTATION.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_FIXES_STATUS.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_LINE_ITEM_COMPLETION_REPORT.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_LINE_ITEM_FIXES.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_REFRESH_SCHEDULING.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_REMAINING_ISSUES_DOCUMENTED.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `PHASE_4_VERIFICATION.md` | 2025-11-24 | Phase 4 | **Historical** | Multiple iterative audit/fix logs; outcome largely consolidated |
| `QUICK_ERROR_CHECK.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `RAILWAY_DEPLOY_METHOD.md` | 2025-12-11 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `RAILWAY_LOG_CAPTURE_INSTRUCTIONS.md` | 2025-12-08 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `README.md` | 2025-11-17 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `STRICT_VALIDATION_IMPLEMENTATION.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `STRICT_VALIDATION_VERIFICATION.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `SYNC_ERROR_DEBUG_REPORT.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `SYNC_ERROR_FIX_REPORT.md` | 2025-12-05 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `TEST_VERIFICATION_REPORT.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `UVS_FK_ALIGNMENT_SUMMARY.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `UVS_FK_VERIFICATION_STATUS.md` | 2025-11-24 | Other | **Historical** | Legacy or point-in-time markdown |
| `VERCEL_DEPLOYMENT_FINAL_STATUS.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `VERCEL_DEPLOYMENT_FIX.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `VERCEL_DEPLOYMENT_INSTRUCTIONS.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `VERCEL_DEPLOYMENT_REPORT.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `VERCEL_DEPLOYMENT_SUMMARY.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `VERCEL_DOMAIN_STATUS.md` | 2025-11-18 | Deployment Status | **Historical** | Snapshot status docs; may conflict across dates |
| `WATCH_LOGS_REALTIME.md` | 2025-12-08 | Incident | **Historical** | Incident/debug trail; keep for forensics |
| `apps/autoagent-app/README.md` | 2025-12-04 | App/Script | **Reference** | Component-specific operational notes |
| `apps/dealer-dashboard/DEPLOYMENT_CHECKLIST.md` | 2025-12-04 | App/Script | **Reference** | Component-specific operational notes |
| `apps/dealer-dashboard/QUICK_START_INGESTION.md` | 2025-12-04 | App/Script | **Reference** | Component-specific operational notes |
| `apps/dealer-dashboard/docs/ANALYTICS_REFRESH_WORKER.md` | 2025-11-24 | App/Script | **Reference** | Component-specific operational notes |
| `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md` | 2025-11-24 | App/Script | **Reference** | Component-specific operational notes |
| `apps/dealer-dashboard/docs/INGESTION_AUTOMATION.md` | 2025-12-04 | App/Script | **Reference** | Component-specific operational notes |
| `apps/dealer-dashboard/docs/SUPABASE_SETUP.md` | 2025-11-04 | Technical Spec | **Authoritative** | Implementation contract/spec |
| `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md` | 2025-11-24 | App/Script | **Reference** | Component-specific operational notes |
| `apps/mcp-server/src/ui/README.md` | 2025-11-24 | Technical Spec | **Authoritative** | Implementation contract/spec |
| `apps/mcp-server/test/STRICT_VALIDATION_README.md` | 2025-11-24 | App/Script | **Reference** | Component-specific operational notes |
| `docs/01-CORE-DOCUMENTATION.md` | 2025-12-04 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/02-DEPLOYMENT-INFRASTRUCTURE.md` | 2025-12-04 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/03-API-INTEGRATION.md` | 2025-12-04 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/04-TESTING-QUALITY.md` | 2025-12-04 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/05-MARKETCHECK-INTEGRATION.md` | 2025-12-04 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/06-LEAD-DELIVERY-CRM.md` | 2025-12-04 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/CHATGPT_INTEGRATION_READY.md` | 2025-11-12 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/DEALER_ID_ONBOARDING_UPDATE_SUMMARY.md` | 2025-11-11 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/DEFAULT_FILTER_FIX_SUMMARY.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/EXPLICIT_FIELDS_IMPLEMENTATION.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/EXPLICIT_FIELDS_IMPLEMENTATION_SUMMARY.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/IOS_LIVE_APP_PLAN.md` | 2025-12-23 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/LOCATION_HANDLING_IMPLEMENTATION.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/MAPBOX_GEOCODING_IMPLEMENTATION_COMPLETE.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/MAPBOX_GEOCODING_NOTE.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/MARKETCHECK_DEALER_ID_VERIFICATION.md` | 2025-11-05 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/QUERY_PARSING_DEPLOYMENT.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_DEPLOYMENT_FINAL.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_DEPLOYMENT_FIX.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_DEPLOYMENT_STATUS.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_FIX_COMPLETE.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_PRODUCTION_TEST_REPORT.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_SCALE_PREP.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_STAGE_0_DISCOVERY.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_STAGE_1_COMPLETE.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_STAGE_4_COMPLETE.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_TEST_REPORT.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/QUERY_PARSING_TEST_RESULTS.md` | 2025-12-23 | Query Parsing Stream | **Historical** | Latest feature stream (Dec 2025) with mixed interim/final docs |
| `docs/README.md` | 2025-11-05 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `docs/VERCEL_DEMO_ACCOUNT_SETUP.md` | 2025-11-17 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/VERCEL_LOGS_ANALYSIS.md` | 2025-12-12 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/analysis/vehicle-detail-modal-analysis.md` | 2025-12-12 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/api.md` | 2025-11-05 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `docs/api/marketcheck-audit-report.md` | 2025-11-05 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/api/marketcheck-audit-summary.md` | 2025-11-05 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/api/marketcheck-endpoints.md` | 2025-11-05 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `docs/architecture/uvs.md` | 2025-11-21 | Technical Spec | **Authoritative** | Implementation contract/spec |
| `docs/deployment/CHATGPT_CONNECTIVITY_VERIFICATION.md` | 2025-11-20 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/CUSTOM_DOMAIN_SETUP.md` | 2025-11-20 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/LOGIN_HANG_FIX_REPORT.md` | 2025-11-18 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/QUICK_DEPLOY_GUIDE.md` | 2025-12-12 | Deployment Guide | **Authoritative** | Reusable operational guide |
| `docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md` | 2025-11-21 | Deployment Guide | **Authoritative** | Reusable operational guide |
| `docs/deployment/RAILWAY_DEPLOYMENT_MONITORING.md` | 2025-11-13 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/RAILWAY_DEPLOYMENT_STATUS.md` | 2025-11-12 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/RAILWAY_ENV_VARS_STATUS.md` | 2025-11-13 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/RAILWAY_LOGS_MONITORING.md` | 2025-11-20 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/RAILWAY_MANUAL_REBUILD.md` | 2025-11-13 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/TIMEOUT_INVESTIGATION_REPORT.md` | 2025-11-13 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/URL_VALIDATION_FIX.md` | 2025-11-13 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/VERCEL_DEPLOYMENT.md` | 2025-11-17 | Deployment Guide | **Authoritative** | Reusable operational guide |
| `docs/deployment/VERCEL_DOMAIN_FIX.md` | 2025-11-18 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/autoagent-deployment-plan.md` | 2025-11-12 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/deployment/production.md` | 2025-10-22 | Deployment Guide | **Authoritative** | Reusable operational guide |
| `docs/deployment/railway.md` | 2025-10-27 | Deployment Guide | **Authoritative** | Reusable operational guide |
| `docs/design/landing/agent-prompt.md` | 2025-11-11 | Design | **Reference** | Design/spec material |
| `docs/design/landing/assets/README.md` | 2025-10-28 | Design | **Reference** | Design/spec material |
| `docs/design/landing/loveable-hero-spec.md` | 2025-11-11 | Design | **Reference** | Design/spec material |
| `docs/design/landing/spec.md` | 2025-11-11 | Design | **Reference** | Design/spec material |
| `docs/design/onboarding/loveable-onboarding-spec.md` | 2025-11-04 | Design | **Reference** | Design/spec material |
| `docs/enhancements/INVALID_INVENTORY_MANAGEMENT_PROPOSAL.md` | 2025-12-12 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/enrichment-sync-test-report.md` | 2025-11-05 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/enrichment-test-notes.md` | 2025-11-05 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/enrichment-test-results.md` | 2025-11-05 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/lead-delivery/STATUS.md` | 2025-11-11 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/lead-delivery/adf-payload.md` | 2025-11-07 | Technical Spec | **Authoritative** | Implementation contract/spec |
| `docs/lead_tool_contract.md` | 2025-11-24 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/marketcheck/MIGRATION_INSTRUCTIONS.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/MULTI_DEALERSHIP_FEATURE.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/MULTI_DEALERSHIP_TEST_SUMMARY.md` | 2025-11-12 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ONBOARDING_COMPLETION_SUMMARY.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ONBOARDING_EXECUTION_LOG.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ONBOARDING_REPORT.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ONBOARDING_SUMMARY.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/PROFILE_UPDATE_ERROR_DIAGNOSIS.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ROOFTOP_DETECTION_SUMMARY.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/STATUS.md` | 2025-11-12 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/SYNC_EXECUTION_LOG.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/SYNC_INSTRUCTIONS.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/SYNC_TEST_RESULTS.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/SYNC_TROUBLESHOOTING.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/SYNC_ZERO_VEHICLES_FIX.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/ZERO_VEHICLES_DEBUG.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` | 2025-11-11 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/env-setup.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/rock-hill-verification.md` | 2025-11-05 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/rooftop-auto-detection.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/marketcheck/screenshots/README.md` | 2025-11-07 | MarketCheck Stream | **Historical** | Onboarding/investigation stream; useful chronology |
| `docs/operations/openai-support-ticket.md` | 2025-11-20 | Docs | **Reference** | General documentation; validate against core docs |
| `docs/overview.md` | 2025-11-20 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `docs/quickstart.md` | 2025-11-20 | Core | **Authoritative** | Primary reference for current architecture/workflow |
| `docs/testing/CHATGPT_SMOKE_TEST_EXECUTION.md` | 2025-11-12 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/CONVERSATION_SUMMARY.md` | 2025-11-20 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/PRIMARY_SOLUTION_TIMEOUT.md` | 2025-11-20 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/QUICK_START_CHATGPT.md` | 2025-11-12 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/README_FOR_NEXT_AGENT.md` | 2025-11-20 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/SMOKE_TEST_EXECUTION_LOG.md` | 2025-11-12 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/SOLUTION_SUMMARY.md` | 2025-11-12 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/TIMEOUT_DIAGNOSIS.md` | 2025-11-20 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md` | 2025-11-20 | Testing | **Historical** | Execution logs and handoff notes |
| `docs/testing/chatgpt-smoke-test.md` | 2025-11-12 | Testing | **Historical** | Execution logs and handoff notes |
| `scripts/README_MARKDOWN_UPDATER.md` | 2025-11-17 | App/Script | **Reference** | Component-specific operational notes |
| `scripts/README_VERCEL_DEMO_SETUP.md` | 2025-11-17 | App/Script | **Reference** | Component-specific operational notes |
| `scripts/debug-sync-error.md` | 2025-12-05 | App/Script | **Reference** | Component-specific operational notes |

## Operational Guidance
1. For current architecture and behavior, start with the Authoritative set above.
2. Use Historical docs only for timeline, incident forensics, and rationale.
3. Treat status/report docs as date-bound snapshots unless promoted into authoritative docs.
4. When adding new status reports, link back to this reconciliation file and explicitly supersede older reports.
