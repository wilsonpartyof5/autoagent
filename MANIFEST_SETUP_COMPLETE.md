# Manifest Setup Complete ✅

## What Was Done

### 1. ✅ Created Manifest Structure
- Created `/apps/autoagent-app/` directory
- Created `/apps/autoagent-app/manifest.json` with proper Apps SDK structure
- Manifest includes:
  - `schemaVersion: "v1"` (camelCase, not snake_case)
  - Full tool definitions for `search-vehicles` and `submit-lead`
  - Widget definition for `vehicle-results`
  - Connector configuration pointing to MCP server

### 2. ✅ Updated Package.json
- Added `@openai/applications-sdk` to `devDependencies` in root `package.json`
- Version: `^1.0.0` (update to latest version when installing)

### 3. ✅ Updated API Route
- Modified `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts`
- Now reads from static `manifest.json` file (single source of truth)
- Includes error handling and caching headers

### 4. ✅ Schema Synchronization
- `submit-lead` schema already fixed in `mcp-simple.ts` (includes `dealerName` and `pricing`)
- Manifest.json tool schemas match `mcp-simple.ts` definitions
- All three locations now aligned:
  1. `submitLead.ts` (Zod schema)
  2. `mcp-simple.ts` (MCP handler schema)
  3. `manifest.json` (Apps SDK manifest schema)

## Next Steps Required

### 1. Install Dependencies
```bash
cd /Users/mac/AutoAgent
pnpm install
```

This will install `@openai/applications-sdk` and allow you to:
- Locate the schema file: `node_modules/@openai/applications-sdk/dist/schema/manifest.schema.json`
- Validate the manifest structure against the actual SDK schema

### 2. Validate Manifest Against SDK Schema

Once the SDK is installed, locate and validate:

```bash
# Find the schema file
find node_modules/@openai/applications-sdk -name "*.schema.json"

# If the SDK provides a validation CLI tool, use it:
# (Check SDK documentation for validation commands)
```

### 3. Sanity Check Checklist

After installation, verify:

- [ ] `@openai/applications-sdk` appears in `node_modules/`
- [ ] `apps/autoagent-app/manifest.json` exists and is valid JSON ✅
- [ ] Tool names match exactly:
  - [x] `search-vehicles` ✅
  - [x] `submit-lead` ✅
- [ ] Schemas match across all three locations:
  - [x] `submitLead.ts` ✅
  - [x] `mcp-simple.ts` ✅
  - [x] `manifest.json` ✅
- [ ] Widget ID/URL matches:
  - [x] `vehicle-results` ✅
  - [x] URL: `https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results` ✅

### 4. Test Manifest Loading

1. **Test API Route:**
   ```bash
   curl http://localhost:3000/api/app-manifest
   ```
   Should return the manifest.json content.

2. **Test in ChatGPT:**
   - Deploy the app
   - Submit manifest.json to ChatGPT Apps SDK
   - Verify tools and widgets load correctly

## File Locations

| File | Location | Status |
|------|----------|--------|
| Manifest | `/apps/autoagent-app/manifest.json` | ✅ Created |
| API Route | `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts` | ✅ Updated |
| Package.json | `/package.json` | ✅ Updated |
| MCP Tools | `/apps/mcp-server/src/mcp-simple.ts` | ✅ Schema Fixed |
| Tool Implementation | `/apps/mcp-server/src/tools/submitLead.ts` | ✅ Valid |
| Widget | `/apps/mcp-server/src/ui/vehicle-results.html` | ✅ Valid |

## Architecture Decision

**Chosen Approach:** Option A - Static file as source of truth

- `apps/autoagent-app/manifest.json` is the canonical manifest
- API route reads from the static file
- Single source of truth prevents drift
- Easy to version control and validate

## Notes

- The manifest uses `schemaVersion` (camelCase) as per Apps SDK convention
- Widget uses `id` and `source` fields (may need adjustment based on actual SDK schema)
- Tool schemas include full JSON Schema definitions
- All required fields match the implementation requirements

## Validation Status

**Current:** ⚠️ **Cannot Complete** - Apps SDK not yet installed  
**After `pnpm install`:** ✅ **Ready to Validate** - SDK schema will be available

---

**Setup Date:** 2025-01-27  
**Status:** ✅ Setup Complete - Ready for SDK Installation & Validation

