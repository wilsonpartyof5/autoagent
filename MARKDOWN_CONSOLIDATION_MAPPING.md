# Detailed File Mapping for Consolidation

This document provides the exact mapping of all 168 markdown files to the 10 consolidated files.

---

## 1. README.md (Project Overview & Quick Start)

### Files to Merge:
```
./README.md
./docs/README.md
./docs/quickstart.md
./docs/overview.md
```

### Content Priority:
1. Project description and capabilities (from README.md)
2. Quick start guide (from docs/quickstart.md)
3. Architecture snapshot (from README.md)
4. Documentation navigation (from docs/README.md)
5. System overview (from docs/overview.md)

---

## 2. CHANGELOG.md (Release History & Roadmap)

### Files to Merge:
```
./CHANGELOG.md
./PHASE_4_ALL_BLOCKING_DEFECTS_FIXED.md
./PHASE_4_ALL_DEFECTS_FIXED.md
./PHASE_4_ALL_DEFECTS_RESOLVED.md
./PHASE_4_AUDIT_FIXES.md
./PHASE_4_AUDIT_REPORT.md
./PHASE_4_AUDIT_RESPONSE.md
./PHASE_4_AUDIT_RESPONSE_FINAL.md
./PHASE_4_BLOCKING_FIXES_COMPLETE.md
./PHASE_4_COMPLETE_FIX_SUMMARY.md
./PHASE_4_COMPLETE_FIXES_SUMMARY.md
./PHASE_4_COMPLETE_STATUS.md
./PHASE_4_COMPREHENSIVE_FIX.md
./PHASE_4_CRITICAL_DEFECTS_FIXED.md
./PHASE_4_CRITICAL_FIXES.md
./PHASE_4_DELIVERY_REPORT.md
./PHASE_4_FINAL_AUDIT_RESPONSE.md
./PHASE_4_FINAL_BLOCKING_FIXES.md
./PHASE_4_FINAL_FIXES.md
./PHASE_4_FINAL_FIXES_COMPLETE.md
./PHASE_4_FINAL_FIXES_SUMMARY.md
./PHASE_4_FINAL_IMPLEMENTATION.md
./PHASE_4_FIXES_STATUS.md
./PHASE_4_LINE_ITEM_COMPLETION_REPORT.md
./PHASE_4_LINE_ITEM_FIXES.md
./PHASE_4_REFRESH_SCHEDULING.md
./PHASE_4_REMAINING_ISSUES_DOCUMENTED.md
./PHASE_4_VERIFICATION.md
./DEPLOYMENT_STATUS.md
./DEPLOYMENT_STATUS_FINAL.md
./DEPLOYMENT_CONFIG_SUMMARY.md
./DEPLOYMENT_FINAL_REPORT.md
./DEPLOYMENT_PROMPT_SUMMARY.md
```

### Content Organization:
- Keep existing CHANGELOG.md structure
- Add "Phase 4 Development" section summarizing all phase 4 files
- Add "Deployment Milestones" section
- Preserve release dates and version numbers

---

## 3. ARCHITECTURE.md (System Design & Architecture)

### Files to Merge:
```
./docs/01-CORE-DOCUMENTATION.md
./docs/architecture/uvs.md
./docs/02-DEPLOYMENT-INFRASTRUCTURE.md (architecture sections only)
./OFFICIAL_APPS_SDK_SCHEMA_REPORT.md
./APPS_SDK_SETUP_REPORT.md
./APPS_SDK_MANIFEST_VALIDATION_REPORT.md
./MANIFEST_SETUP_COMPLETE.md
```

### Content Organization:
1. System Architecture Overview
2. Component Architecture (MCP Server, Dashboard, etc.)
3. Database Schema (UVS)
4. Data Flow
5. Apps SDK Integration
6. MCP Protocol Implementation

---

## 4. API_REFERENCE.md (API Documentation & Integration)

### Files to Merge:
```
./docs/03-API-INTEGRATION.md
./docs/api.md
./docs/api/marketcheck-endpoints.md
./docs/api/marketcheck-audit-report.md
./docs/api/marketcheck-audit-summary.md
./docs/lead_tool_contract.md
./docs/lead-delivery/adf-payload.md
./docs/lead-delivery/STATUS.md
```

### Content Organization:
1. MCP Protocol Reference
2. Tool Definitions (search-vehicles, submit-lead)
3. MarketCheck API Integration
4. Lead Delivery API
5. ADF XML Format
6. Request/Response Schemas
7. Error Codes and Handling

---

## 5. DEPLOYMENT.md (Deployment & Infrastructure)

### Files to Merge:
```
./docs/deployment/production.md
./docs/deployment/railway.md
./docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md
./docs/deployment/RAILWAY_LOGS_MONITORING.md
./docs/deployment/RAILWAY_DEPLOYMENT_MONITORING.md
./docs/deployment/RAILWAY_DEPLOYMENT_STATUS.md
./docs/deployment/RAILWAY_ENV_VARS_STATUS.md
./docs/deployment/RAILWAY_MANUAL_REBUILD.md
./docs/deployment/VERCEL_DEPLOYMENT.md
./docs/deployment/VERCEL_DOMAIN_FIX.md
./docs/deployment/CUSTOM_DOMAIN_SETUP.md
./docs/deployment/CHATGPT_CONNECTIVITY_VERIFICATION.md
./docs/deployment/TIMEOUT_INVESTIGATION_REPORT.md
./docs/deployment/URL_VALIDATION_FIX.md
./docs/deployment/LOGIN_HANG_FIX_REPORT.md
./docs/deployment/autoagent-deployment-plan.md
./VERCEL_DEPLOYMENT_FIX.md
./VERCEL_DEPLOYMENT_SUMMARY.md
./VERCEL_DEPLOYMENT_FINAL_STATUS.md
./VERCEL_DOMAIN_STATUS.md
```

### Content Organization:
1. Production Architecture
2. Railway Deployment
3. Vercel Deployment
4. Environment Configuration
5. Domain Setup
6. Monitoring & Logging
7. Troubleshooting Guide
8. Known Issues & Fixes

---

## 6. MARKETCHECK_INTEGRATION.md (MarketCheck Integration Guide)

### Files to Merge:
```
./docs/05-MARKETCHECK-INTEGRATION.md
./docs/marketcheck/dealer-sync-ask-jorge-lopez.md
./docs/marketcheck/env-setup.md
./docs/marketcheck/MIGRATION_INSTRUCTIONS.md
./docs/marketcheck/MULTI_DEALERSHIP_FEATURE.md
./docs/marketcheck/MULTI_DEALERSHIP_TEST_SUMMARY.md
./docs/marketcheck/ONBOARDING_COMPLETION_SUMMARY.md
./docs/marketcheck/ONBOARDING_EXECUTION_LOG.md
./docs/marketcheck/ONBOARDING_REPORT.md
./docs/marketcheck/ONBOARDING_SUMMARY.md
./docs/marketcheck/PROFILE_UPDATE_ERROR_DIAGNOSIS.md
./docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md
./docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md
./docs/marketcheck/rock-hill-verification.md
./docs/marketcheck/ROOFTOP_DETECTION_SUMMARY.md
./docs/marketcheck/rooftop-auto-detection.md
./docs/marketcheck/STATUS.md
./docs/marketcheck/SYNC_EXECUTION_LOG.md
./docs/marketcheck/SYNC_INSTRUCTIONS.md
./docs/marketcheck/SYNC_TEST_RESULTS.md
./docs/marketcheck/SYNC_TROUBLESHOOTING.md
./docs/marketcheck/SYNC_ZERO_VEHICLES_FIX.md
./docs/marketcheck/ZERO_VEHICLES_DEBUG.md
./docs/marketcheck/screenshots/README.md
./docs/MARKETCHECK_DEALER_ID_VERIFICATION.md
./docs/CHATGPT_INTEGRATION_READY.md
./docs/DEALER_ID_ONBOARDING_UPDATE_SUMMARY.md
./docs/enrichment-sync-test-report.md
./docs/enrichment-test-notes.md
./docs/enrichment-test-results.md
./INVESTIGATE_MCP_500_ERROR.md
./MCP_500_ERROR_INVESTIGATION.md
./MCP_500_ERROR_SUMMARY.md
./MCP_500_DIAGNOSIS_*.md (if any)
./MCP_INGESTION_500_FINDINGS.md
./MCP_INGESTION_500_INVESTIGATION_SUMMARY.md
./MCP_INGESTION_INVESTIGATION_REPORT.md
./FIX_SYNC_500_ERROR.md
./SYNC_ERROR_FIX_REPORT.md
./SYNC_ERROR_DEBUG_REPORT.md
```

### Content Organization:
1. MarketCheck API Overview
2. Setup & Configuration
3. Dealer Onboarding Process
4. Inventory Sync Workflow
5. Vehicle Ingestion Pipeline
6. Multi-Dealership Support
7. Troubleshooting & Error Resolution
8. Testing & Verification

---

## 7. TESTING.md (Testing & Quality Assurance)

### Files to Merge:
```
./docs/04-TESTING-QUALITY.md
./docs/testing/CHATGPT_SMOKE_TEST_EXECUTION.md
./docs/testing/chatgpt-smoke-test.md
./docs/testing/CONVERSATION_SUMMARY.md
./docs/testing/PRIMARY_SOLUTION_TIMEOUT.md
./docs/testing/QUICK_START_CHATGPT.md
./docs/testing/README_FOR_NEXT_AGENT.md
./docs/testing/SMOKE_TEST_EXECUTION_LOG.md
./docs/testing/SOLUTION_SUMMARY.md
./docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md
./docs/testing/TIMEOUT_DIAGNOSIS.md
./TEST_VERIFICATION_REPORT.md
./STRICT_VALIDATION_IMPLEMENTATION.md
./STRICT_VALIDATION_VERIFICATION.md
./apps/mcp-server/test/STRICT_VALIDATION_README.md
./QUICK_ERROR_CHECK.md
./CHECK_RAILWAY_LOGS_NOW.md
./GET_RAILWAY_ERROR_STEPS.md
./CAPTURE_RAILWAY_ERROR.md
./CAPTURE_ACTUAL_RAILWAY_ERROR.md
./RAILWAY_LOG_CAPTURE_INSTRUCTIONS.md
./WATCH_LOGS_REALTIME.md
```

### Content Organization:
1. Testing Strategy
2. Unit Tests
3. Integration Tests
4. MCP Protocol Tests
5. ChatGPT Smoke Tests
6. Validation Tests
7. Test Execution Guides
8. Debugging & Error Capture
9. Log Analysis Procedures

---

## 8. LEAD_DELIVERY.md (Lead Delivery & CRM Integration)

### Files to Merge:
```
./docs/06-LEAD-DELIVERY-CRM.md
./docs/lead-delivery/adf-payload.md
./docs/lead-delivery/STATUS.md
./UVS_FK_ALIGNMENT_SUMMARY.md
./UVS_FK_VERIFICATION_STATUS.md
./apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md
./apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md
./apps/dealer-dashboard/docs/ANALYTICS_REFRESH_WORKER.md
./MIGRATION_READY_TO_APPLY.md
./MIGRATION_APPLY_AND_VERIFY.md
```

### Content Organization:
1. Lead Capture Workflow
2. Encryption & Security
3. ADF XML Format
4. CRM Integration
5. Delivery Methods (HTTP, Email)
6. Delivery Logging & Resend
7. UVS Schema & Migrations
8. Analytics & Reporting

---

## 9. OPERATIONS.md (Operations & Troubleshooting)

### Files to Merge:
```
./docs/operations/openai-support-ticket.md
./MCP_BUILD_FIX_FINAL.md
./MCP_BUILD_FIX_SUMMARY.md
./MCP_INSTRUMENTATION_SUMMARY.md
```

### Content Organization:
1. Incident Response Procedures
2. Common Issues & Solutions
3. Diagnostic Tools & Scripts
4. Monitoring & Alerting
5. Support Ticket Templates
6. Operational Checklists
7. Performance Tuning

---

## 10. DEVELOPER_GUIDE.md (Developer Setup & Workflows)

### Files to Merge:
```
./apps/dealer-dashboard/docs/ANALYTICS_REFRESH_WORKER.md (if not in LEAD_DELIVERY)
./apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md (if not in LEAD_DELIVERY)
./apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md (if not in LEAD_DELIVERY)
./apps/autoagent-app/README.md
./docs/design/onboarding/loveable-onboarding-spec.md
./docs/design/landing/spec.md
./docs/design/landing/loveable-hero-spec.md
./docs/design/landing/agent-prompt.md
./docs/design/landing/assets/README.md
./docs/VERCEL_DEMO_ACCOUNT_SETUP.md
./scripts/README_VERCEL_DEMO_SETUP.md
./scripts/README_MARKDOWN_UPDATER.md
./scripts/debug-sync-error.md
```

### Content Organization:
1. Development Environment Setup
2. App-Specific Setup (dealer-dashboard, mcp-server, autoagent-app)
3. Design System & UI Components
4. Scripts & Utilities
5. Development Workflows
6. Code Organization
7. Contributing Guidelines

---

## Files to Archive (Not Delete)

These files contain historical information that should be archived but may not be directly merged:

```
./MARKDOWN_FILES_SUMMARY.md (this is a meta-document about docs)
```

### Archive Structure:
```
docs/archive/2025-03-02/
  ├── phase4-reports/
  ├── error-investigations/
  ├── deployment-status/
  └── historical-reports/
```

---

## Files to Delete (Redundant/Outdated)

These files are likely redundant and can be safely deleted after verification:
- Multiple status files with identical or very similar content
- Intermediate fix attempts that were superseded
- Duplicate investigation reports

**Note**: Always verify before deletion. Archive if uncertain.

---

## Implementation Checklist

- [ ] Create backup of all markdown files
- [ ] Set up archive directory structure
- [ ] Create each of the 10 consolidated files
- [ ] Merge content systematically
- [ ] Update all internal links
- [ ] Verify all cross-references
- [ ] Test all links
- [ ] Review each consolidated file
- [ ] Archive original files
- [ ] Update README.md to reference new structure
- [ ] Update CI/CD and tooling
- [ ] Communicate changes to team

---

## Estimated Timeline

- **Week 1**: Content extraction and mapping (detailed)
- **Week 2**: Create 10 consolidated files
- **Week 3**: Review, refine, and update links
- **Week 4**: Archive, cleanup, and final verification

---

**Total Files to Process**: 168  
**Files to Consolidate**: ~149  
**Files to Archive**: ~15  
**Files to Delete**: ~4

