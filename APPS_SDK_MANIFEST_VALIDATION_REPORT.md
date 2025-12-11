# AutoAgent ChatGPT App Manifest Validation Report

**Date:** 2025-01-27  
**Validator:** Lead Engineer Review  
**Status:** ❌ **FAIL - Critical Issues Found**

---

## Executive Summary

This report validates the AutoAgent ChatGPT App manifest against the OpenAI Applications SDK. **Critical finding: The Apps SDK is not installed in this repository, and the expected manifest.json file does not exist.**

### Overall Status: **FAIL**

- ❌ Apps SDK package not installed
- ❌ Manifest.json file missing at expected location
- ⚠️ Current implementation uses MCP (Model Context Protocol) instead of Apps SDK
- ✅ Tools and widgets are implemented and functional
- ⚠️ Manifest structure exists but in API route format, not Apps SDK format

---

## 1. Schema Sources Location

### 1.1 Expected Manifest File
**Status:** ❌ **NOT FOUND**

- **Expected Path:** `/apps/autoagent-app/manifest.json`
- **Actual Status:** Directory `/apps/autoagent-app/` does not exist
- **Found Alternative:** API route at `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts`

### 1.2 Package.json Analysis
**Status:** ✅ **FOUND**

**Root package.json:**
```json
{
  "name": "autoagent",
  "version": "1.0.0",
  "packageManager": "pnpm@8.15.0"
}
```

**MCP Server package.json:**
```json
{
  "name": "@autoagent/mcp-server",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0"
  }
}
```

**Dealer Dashboard package.json:**
```json
{
  "name": "@autoagent/dealer-dashboard",
  "dependencies": {
    // No @openai/applications-sdk found
  }
}
```

### 1.3 Apps SDK Schema File
**Status:** ❌ **NOT FOUND**

**Searched Locations:**
- `node_modules/@openai/applications-sdk/dist/schema/manifest.schema.json` - ❌ Not found
- `node_modules/@openai/applications-sdk/schema/manifest.schema.json` - ❌ Not found
- `**/manifest.schema.json` - ❌ Not found

**Reason:** The `@openai/applications-sdk` package is **not installed** in this repository.

### 1.4 Apps SDK Version
**Status:** ❌ **NOT INSTALLED**

- **Expected Package:** `@openai/applications-sdk`
- **Current Status:** Package not found in any package.json
- **Installed Alternative:** `@modelcontextprotocol/sdk@^0.4.0` (MCP, not Apps SDK)

---

## 2. Current Manifest Structure Analysis

### 2.1 API Route Manifest
**Location:** `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts`

**Current Structure:**
```typescript
{
  schema_version: 'v1',
  name: 'AutoAgent Dealer Demo',
  description: 'Search Rock Hill GMC inventory and submit leads.',
  author: {
    name: 'AutoAgent',
    email: 'support@autoagent.com',
  },
  connectors: [
    {
      type: 'mcp',
      url: 'https://autoagentmcp-server-production.up.railway.app/mcp',
      tools: ['search-vehicles', 'submit-lead'],
    },
  ],
  ui: {
    widgets: [
      {
        name: 'vehicle-results',
        url: 'https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results',
      },
    ],
  },
}
```

### 2.2 Validation Against Apps SDK (Expected Structure)

**Issues Found:**

1. **Field Name Mismatch:**
   - ❌ Current: `schema_version` 
   - ✅ Expected (Apps SDK): `schemaVersion` (camelCase)

2. **Connector Type:**
   - ⚠️ Current: `type: 'mcp'`
   - ⚠️ Apps SDK may use different connector structure

3. **Widget Structure:**
   - ⚠️ Current: `{ name, url }`
   - ⚠️ Apps SDK may require `{ id, source }` or different structure

4. **Missing Fields (Potential):**
   - ❓ `version` field
   - ❓ `permissions` field
   - ❓ `capabilities` field
   - ❓ Tool definitions with full schemas

**Note:** Without the actual Apps SDK schema file, we cannot definitively validate the structure.

---

## 3. Tool Implementation Validation

### 3.1 Tools Defined in Manifest

**From API Route:**
- ✅ `search-vehicles` - Referenced
- ✅ `submit-lead` - Referenced

**Additional Tools in MCP Handler (Not in Manifest):**
- ⚠️ `search` - Implemented but not in manifest
- ⚠️ `fetch` - Implemented but not in manifest
- ⚠️ `ping-ui` - Implemented but not in manifest
- ⚠️ `ping-micro-ui` - Implemented but not in manifest
- ⚠️ `compare-vehicles` - Implemented but not in manifest

### 3.2 Tool File Validation

#### ✅ `search-vehicles` Tool

**File:** `/apps/mcp-server/src/tools/searchVehicles.ts`

**Validation:**
- ✅ File exists
- ✅ Exports function: `searchVehicles(params, context)`
- ✅ Input schema defined in `mcp-simple.ts`:
  ```typescript
  {
    name: 'search-vehicles',
    description: 'Search for vehicles based on location, price, make, model, and other criteria',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        condition: { type: 'string', enum: ['new', 'used'] },
        maxPrice: { type: 'number' },
        make: { type: 'string' },
        model: { type: 'string' },
        radiusMiles: { type: 'number' },
      },
      required: ['location', 'condition'],
    },
  }
  ```
- ✅ Returns components pattern: `{ type: 'iframe', url: string }`
- ✅ Returns structuredContent with vehicle data
- ✅ Name matches manifest: `search-vehicles`

**Issues:**
- ⚠️ Input schema in `mcp-simple.ts` uses `SearchParamsSchema` from `@autoagent/shared`, but manifest doesn't show full schema
- ⚠️ Apps SDK may require tool definitions in manifest.json, not just in MCP handler

#### ✅ `submit-lead` Tool

**File:** `/apps/mcp-server/src/tools/submitLead.ts`

**Validation:**
- ✅ File exists
- ✅ Exports function: `submitLead(params, context)`
- ✅ Input schema defined in `mcp-simple.ts`:
  ```typescript
  {
    name: 'submit-lead',
    description: 'Submit a lead for a vehicle test drive or quote request',
    inputSchema: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string' },
        vin: { type: 'string', pattern: '^[A-HJ-NPR-Z0-9]{11,17}$' },
        dealerId: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            preferredTime: { type: 'string' },
          },
          required: ['name', 'email'],
        },
        consent: { type: 'boolean' },
      },
      required: ['vehicleId', 'vin', 'user', 'consent'],
    },
  }
  ```
- ✅ Uses Zod schema validation: `SubmitLeadSchema`
- ✅ Returns structuredContent with lead confirmation
- ✅ Name matches manifest: `submit-lead`

**Issues:**
- ⚠️ Actual implementation uses stricter schema (requires `pricing`, `dealerName`) but manifest schema doesn't show these
- ⚠️ Schema mismatch between `mcp-simple.ts` and actual `submitLead.ts` implementation

**Schema Mismatch Details:**
- **Manifest/MCP Handler Schema:** Requires `vehicleId`, `vin`, `user`, `consent`
- **Actual Implementation Schema:** Requires `vehicleId`, `vin`, `dealerId`, `dealerName`, `pricing`, `user`, `consent`
- **Impact:** Tools called from ChatGPT may fail validation if they don't include `pricing` and `dealerName`

### 3.3 Tool Usage Validation

**Found in Codebase:**
- ✅ `window.openai.callTool('submit-lead', ...)` - Used in `vehicle-results.html` (line 1695)
- ✅ `window.openai.callTool('search-vehicles', ...)` - Expected but not directly called (tool is invoked by ChatGPT)

**Issues:**
- ⚠️ No direct calls to `search-vehicles` found (expected, as ChatGPT invokes it)
- ✅ `submit-lead` is correctly called from widget

---

## 4. Widget Implementation Validation

### 4.1 Widgets Defined in Manifest

**From API Route:**
- ✅ `vehicle-results` - Referenced

**Additional Widgets in Codebase (Not in Manifest):**
- ⚠️ `ping` - Exists at `/apps/mcp-server/src/ui/ping.html`
- ⚠️ `micro` - Exists at `/apps/mcp-server/src/ui/micro.html`

### 4.2 Widget File Validation

#### ✅ `vehicle-results` Widget

**File:** `/apps/mcp-server/src/ui/vehicle-results.html`

**Validation:**
- ✅ File exists (1914 lines)
- ✅ HTML syntax valid
- ✅ Uses `window.openai.callTool()` for lead submission
- ✅ Uses `window.openai.toolOutput.structuredContent` for data
- ✅ Uses `window.openai.on('set_globals')` for globals synchronization
- ✅ Widget ID/name matches manifest: `vehicle-results`
- ✅ URL matches manifest: `https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results`

**Issues:**
- ⚠️ Widget uses Apps SDK APIs (`window.openai.*`) but Apps SDK package not installed
- ⚠️ Manifest references widget by `name` but Apps SDK may require `id` or `source` field
- ⚠️ Widget URL is hardcoded in manifest, should be relative or configurable

**Widget Features Validated:**
- ✅ Loads vehicle data from `structuredContent`
- ✅ Displays Leaflet map
- ✅ Handles lead form submission via `callTool`
- ✅ Tracks analytics events
- ✅ Handles `set_globals` events

---

## 5. Schema Mismatches and Inconsistencies

### 5.1 Tool Schema Mismatches

#### `submit-lead` Schema Mismatch

**Location:** `/apps/mcp-server/src/tools/submitLead.ts` vs `/apps/mcp-server/src/mcp-simple.ts`

**Issue:**
- **MCP Handler Schema (mcp-simple.ts):** Missing `pricing` and `dealerName` fields
- **Actual Implementation (submitLead.ts):** Requires `pricing` and `dealerName` via Zod schema

**Fix Required:**
```typescript
// In mcp-simple.ts, update submit-lead inputSchema:
{
  name: 'submit-lead',
  inputSchema: {
    type: 'object',
    properties: {
      vehicleId: { type: 'string' },
      vin: { type: 'string', pattern: '^[A-HJ-NPR-Z0-9]{11,17}$' },
      dealerId: { type: 'string' },
      dealerName: { type: 'string' }, // ADD THIS
      pricing: { // ADD THIS
        type: 'object',
        properties: {
          price: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['price', 'currency'],
      },
      user: { /* ... */ },
      consent: { type: 'boolean' },
    },
    required: ['vehicleId', 'vin', 'dealerId', 'dealerName', 'pricing', 'user', 'consent'],
  },
}
```

### 5.2 Naming Conventions

**Issues:**
- ⚠️ Manifest uses `schema_version` (snake_case) but Apps SDK likely uses `schemaVersion` (camelCase)
- ✅ Tool names use kebab-case: `search-vehicles`, `submit-lead` (consistent)
- ✅ Widget name uses kebab-case: `vehicle-results` (consistent)

### 5.3 Missing Tool Definitions in Manifest

**Tools Implemented but Not in Manifest:**
- `search` - Generic search tool
- `fetch` - URL fetching tool
- `ping-ui` - UI testing tool
- `ping-micro-ui` - Minimal UI test
- `compare-vehicles` - Vehicle comparison tool

**Recommendation:**
- Either add these tools to the manifest, or
- Remove them from the MCP handler if not needed

---

## 6. File Path Validation

### 6.1 Tool Files

| Tool Name | Expected Path | Status | Notes |
|-----------|--------------|--------|-------|
| `search-vehicles` | `/apps/mcp-server/src/tools/searchVehicles.ts` | ✅ Exists | Exports `searchVehicles` |
| `submit-lead` | `/apps/mcp-server/src/tools/submitLead.ts` | ✅ Exists | Exports `submitLead` |
| `compare-vehicles` | `/apps/mcp-server/src/tools/compareVehicles.ts` | ✅ Exists | Not in manifest |
| `search` | `/apps/mcp-server/src/tools/search.ts` | ✅ Exists | Not in manifest |
| `fetch` | `/apps/mcp-server/src/tools/fetch.ts` | ✅ Exists | Not in manifest |
| `ping-ui` | `/apps/mcp-server/src/tools/pingUi.ts` | ✅ Exists | Not in manifest |
| `ping-micro-ui` | `/apps/mcp-server/src/tools/pingMicroUi.ts` | ✅ Exists | Not in manifest |

### 6.2 Widget Files

| Widget Name | Expected Path | Status | Notes |
|-------------|--------------|--------|-------|
| `vehicle-results` | `/apps/mcp-server/src/ui/vehicle-results.html` | ✅ Exists | 1914 lines, valid HTML |
| `ping` | `/apps/mcp-server/src/ui/ping.html` | ✅ Exists | Not in manifest |
| `micro` | `/apps/mcp-server/src/ui/micro.html` | ✅ Exists | Not in manifest |

### 6.3 Manifest File

| Expected Path | Status | Notes |
|--------------|--------|-------|
| `/apps/autoagent-app/manifest.json` | ❌ Missing | Directory doesn't exist |
| `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts` | ✅ Exists | API route, not static file |

---

## 7. Critical Issues Summary

### 7.1 Blocking Issues

1. **❌ Apps SDK Not Installed**
   - **Impact:** Cannot validate against actual SDK schema
   - **Severity:** CRITICAL
   - **Fix:** Install `@openai/applications-sdk` package

2. **❌ Manifest.json File Missing**
   - **Impact:** No static manifest file for Apps SDK to load
   - **Severity:** CRITICAL
   - **Fix:** Create `/apps/autoagent-app/manifest.json` with proper structure

3. **❌ Schema Mismatch in `submit-lead` Tool**
   - **Impact:** Tool calls may fail validation
   - **Severity:** HIGH
   - **Fix:** Update `mcp-simple.ts` to match actual implementation schema

### 7.2 Non-Blocking Issues

4. **⚠️ Field Naming Convention**
   - **Impact:** May not conform to Apps SDK camelCase convention
   - **Severity:** MEDIUM
   - **Fix:** Use `schemaVersion` instead of `schema_version`

5. **⚠️ Tools Not in Manifest**
   - **Impact:** Tools exist but aren't exposed in manifest
   - **Severity:** LOW
   - **Fix:** Add missing tools or remove unused implementations

6. **⚠️ Widget Structure**
   - **Impact:** Widget definition may not match Apps SDK format
   - **Severity:** MEDIUM
   - **Fix:** Verify widget structure against Apps SDK schema

---

## 8. Fix Plan

### 8.1 Install Apps SDK

**Step 1:** Install the Apps SDK package

```bash
cd /Users/mac/AutoAgent
pnpm add @openai/applications-sdk --workspace-root
# OR if it should be in a specific app:
cd apps/dealer-dashboard
pnpm add @openai/applications-sdk
```

**Step 2:** Locate the schema file

```bash
find node_modules/@openai/applications-sdk -name "manifest.schema.json"
```

**Step 3:** Validate against actual schema

### 8.2 Create Manifest.json File

**Step 1:** Create directory structure

```bash
mkdir -p apps/autoagent-app
```

**Step 2:** Create manifest.json (draft - needs validation against actual SDK schema)

```json
{
  "schemaVersion": "v1",
  "name": "AutoAgent Dealer Demo",
  "description": "Search Rock Hill GMC inventory and submit leads.",
  "version": "1.0.0",
  "author": {
    "name": "AutoAgent",
    "email": "support@autoagent.com"
  },
  "connectors": [
    {
      "type": "mcp",
      "url": "https://autoagentmcp-server-production.up.railway.app/mcp",
      "tools": [
        "search-vehicles",
        "submit-lead"
      ]
    }
  ],
  "ui": {
    "widgets": [
      {
        "id": "vehicle-results",
        "source": "https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results"
      }
    ]
  }
}
```

**Note:** This is a draft. The actual structure must be validated against the installed SDK schema.

### 8.3 Fix Tool Schema Mismatch

**File:** `/apps/mcp-server/src/mcp-simple.ts`

**Line:** 120-168

**Current Code:**
```typescript
{
  name: 'submit-lead',
  inputSchema: {
    type: 'object',
    properties: {
      vehicleId: { type: 'string' },
      vin: { type: 'string', pattern: '^[A-HJ-NPR-Z0-9]{11,17}$' },
      dealerId: { type: 'string' },
      user: { /* ... */ },
      consent: { type: 'boolean' },
    },
    required: ['vehicleId', 'vin', 'user', 'consent'],
  },
}
```

**Fixed Code:**
```typescript
{
  name: 'submit-lead',
  inputSchema: {
    type: 'object',
    properties: {
      vehicleId: {
        type: 'string',
        description: 'ID of the vehicle',
      },
      vin: {
        type: 'string',
        pattern: '^[A-HJ-NPR-Z0-9]{11,17}$',
        description: 'Vehicle Identification Number (VIN)',
      },
      dealerId: {
        type: 'string',
        description: 'ID of the dealer (required)',
      },
      dealerName: {
        type: 'string',
        description: 'Name of the dealer (required)',
      },
      pricing: {
        type: 'object',
        description: 'Vehicle pricing information',
        properties: {
          price: {
            type: 'number',
            description: 'Vehicle price',
          },
          currency: {
            type: 'string',
            description: 'Currency code (ISO 3-letter)',
            default: 'USD',
          },
        },
        required: ['price', 'currency'],
      },
      user: {
        type: 'object',
        description: 'User contact information',
        properties: {
          name: {
            type: 'string',
            description: 'Full name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address',
          },
          phone: {
            type: 'string',
            description: 'Phone number (optional)',
          },
          preferredTime: {
            type: 'string',
            description: 'Preferred contact time (optional)',
          },
        },
        required: ['name', 'email'],
      },
      consent: {
        type: 'boolean',
        description: 'User consent to be contacted (must be true)',
      },
    },
    required: ['vehicleId', 'vin', 'dealerId', 'dealerName', 'pricing', 'user', 'consent'],
  },
}
```

**Reasoning:** The MCP handler schema must match the actual Zod schema in `submitLead.ts` to prevent validation failures.

### 8.4 Update API Route Manifest (If Keeping Both)

**File:** `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts`

**Option A:** Keep API route and sync with static manifest.json
**Option B:** Remove API route and use static manifest.json only

**Recommendation:** Use static `manifest.json` file as Apps SDK expects, remove or deprecate API route.

### 8.5 Add Tool Definitions to Manifest (If Required by Apps SDK)

If Apps SDK requires full tool definitions in manifest.json (not just names), add:

```json
{
  "tools": [
    {
      "name": "search-vehicles",
      "description": "Search for vehicles based on location, price, make, model, and other criteria",
      "inputSchema": {
        "type": "object",
        "properties": {
          "location": { "type": "string" },
          "condition": { "type": "string", "enum": ["new", "used"] },
          "maxPrice": { "type": "number" },
          "make": { "type": "string" },
          "model": { "type": "string" },
          "radiusMiles": { "type": "number" }
        },
        "required": ["location", "condition"]
      }
    },
    {
      "name": "submit-lead",
      "description": "Submit a lead for a vehicle test drive or quote request",
      "inputSchema": {
        // ... (use fixed schema from 8.3)
      }
    }
  ]
}
```

**Note:** This depends on Apps SDK requirements. Validate against actual schema first.

---

## 9. Validation Checklist

### Pre-Validation Requirements

- [ ] Install `@openai/applications-sdk` package
- [ ] Locate `manifest.schema.json` file
- [ ] Create `/apps/autoagent-app/manifest.json` file
- [ ] Fix `submit-lead` schema mismatch in `mcp-simple.ts`

### Manifest Validation (After SDK Installation)

- [ ] Validate `schemaVersion` field
- [ ] Validate `name` field
- [ ] Validate `description` field
- [ ] Validate `version` field (if required)
- [ ] Validate `author` object structure
- [ ] Validate `connectors` array structure
- [ ] Validate connector `type` value
- [ ] Validate connector `url` format
- [ ] Validate connector `tools` array
- [ ] Validate `ui.widgets` array structure
- [ ] Validate widget `id` or `name` field
- [ ] Validate widget `source` or `url` field
- [ ] Check for deprecated fields
- [ ] Check for unknown fields

### Tool Validation

- [ ] All tools in manifest have corresponding files
- [ ] All tool files export expected handlers
- [ ] Tool input schemas match manifest definitions
- [ ] Tool names match between manifest and implementation
- [ ] Tool return values match expected format

### Widget Validation

- [ ] All widgets in manifest have corresponding HTML files
- [ ] HTML files are syntactically valid
- [ ] Widget IDs/names match manifest
- [ ] Widget URLs are accessible
- [ ] Widgets use correct Apps SDK APIs

---

## 10. Next Steps

### Immediate Actions Required

1. **Install Apps SDK:**
   ```bash
   pnpm add @openai/applications-sdk
   ```

2. **Locate Schema:**
   ```bash
   find node_modules/@openai/applications-sdk -name "*.schema.json"
   ```

3. **Fix Tool Schema:**
   - Update `mcp-simple.ts` to match `submitLead.ts` schema

4. **Create Manifest:**
   - Create `/apps/autoagent-app/manifest.json`
   - Validate against actual SDK schema

5. **Re-validate:**
   - Run validation again after fixes

### Recommended Actions

6. **Decide on Architecture:**
   - Use Apps SDK manifest.json (static file)
   - OR continue with MCP-only approach
   - OR support both (hybrid)

7. **Documentation:**
   - Document which tools/widgets are exposed
   - Document schema requirements
   - Document deployment process

8. **Testing:**
   - Test manifest loading in ChatGPT
   - Test tool invocations
   - Test widget rendering

---

## 11. Conclusion

**Current State:**
- The repository does not have the Apps SDK installed
- The expected manifest.json file does not exist
- The current implementation uses MCP (Model Context Protocol)
- Tools and widgets are implemented and functional
- There is a schema mismatch in the `submit-lead` tool

**Recommendation:**
1. Install the Apps SDK to enable proper validation
2. Create the manifest.json file with the correct structure
3. Fix the tool schema mismatch
4. Re-validate against the actual SDK schema

**Validation Status:** **CANNOT COMPLETE** - Apps SDK not installed. This report is based on analysis of the current codebase structure and expected Apps SDK patterns. A complete validation requires the SDK to be installed.

---

**Report Generated:** 2025-01-27  
**Next Review:** After Apps SDK installation and manifest.json creation

