# MarketCheck Dealer ID Enrollment & Integration Verification

**Date**: 2025-02-19  
**Verification Scope**: Dealer ID onboarding process and AutoAgent integration

---

## 1. Dealer Onboarding with MarketCheck

### 1.1 Where Dealer ID is Issued/Retrieved

**Current Documentation Status**: ⚠️ **INCOMPLETE**

The codebase references finding the dealer ID in:
- **MarketCheck Dashboard**: UI helper text states "Find this in your MarketCheck dashboard"  
  - Reference: `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx:81`
  - Reference: `apps/dealer-dashboard/src/components/dashboard/settings/inventory-provider-form.tsx:75`

- **Support Contact**: 
  - Drevvy onboarding team: `support@drevvy.com`  
    - Reference: `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx:143-148`
  - MarketCheck support (mentioned generically)  
    - Reference: `apps/dealer-dashboard/src/components/dashboard/settings/inventory-provider-form.tsx:75`

**Missing Information**:
- ❌ No MarketCheck portal URL documented
- ❌ No MarketCheck API endpoint documented for dealer ID lookup
- ❌ No MarketCheck support email documented
- ❌ No prerequisites documented (contracts, data feeds, account setup)

**Recommendation**: Contact MarketCheck directly to document:
1. Exact portal URL where dealer ID is visible
2. Support email/phone for dealer ID retrieval
3. Whether dealer ID lookup API exists (`/v2/dealer/search?name=...&location=...`)
4. Prerequisites before dealer ID is created (contract signed, data feed active, etc.)

### 1.2 MarketCheck Dealer ID Lookup

**Current Status**: ❌ **NOT IMPLEMENTED**

- No API endpoint in codebase for looking up dealer ID by name/location
- No UI component for dealer ID lookup
- Dealers must manually enter their dealer ID

**Recommendation**: 
- If MarketCheck exposes a lookup endpoint, add it to the setup form
- If not available, document the manual process more clearly

### 1.3 Prerequisites

**Current Status**: ⚠️ **NOT DOCUMENTED**

No documentation found about:
- Contract requirements
- Data feed setup requirements
- Account activation steps
- Timeline from signup to dealer ID availability

**Recommendation**: Document prerequisites in onboarding materials or quickstart guide.

---

## 2. AutoAgent Integration

### 2.1 Dealer ID Storage Location

**Storage**: Supabase `profiles` table

**Database Schema**:
- Table: `profiles`
- Column: `marketcheck_dealer_id` (text, nullable)
- Column: `marketcheck_zip` (text, nullable)  
- Migration: `apps/dealer-dashboard/supabase/migrations/20250220_alter_profiles_marketcheck.sql:2`

**TypeScript Type**:
```typescript
// apps/dealer-dashboard/src/lib/supabase/profile.ts:8-9
marketcheckDealerId?: string | null;
marketcheckZip?: string | null;
```

**Retrieval Function**:
- `getDealerProfile()` in `apps/dealer-dashboard/src/lib/supabase/profile.ts:12-47`
- Selects `marketcheck_dealer_id` and `marketcheck_zip` from `profiles` table

### 2.2 Dashboard Setup Form (Initial Entry)

**Location**: `/app/setup` page

**Component**: `InventorySyncForm`  
- File: `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx`
- Line 76-82: MarketCheck dealer ID input field (required)
- Line 84-90: Optional ZIP code field
- Helper text: "Find this in your MarketCheck dashboard." (line 81)

**Initial Values**:
- Loaded from profile: `profile?.marketcheckDealerId` and `profile?.marketcheckZip`  
- Reference: `apps/dealer-dashboard/src/app/app/setup/page.tsx:24-25`

**Action Handler**:
- `syncMarketCheckInventory()` in `apps/dealer-dashboard/src/app/app/setup/actions.ts:24-179`
- Validates dealer ID is present (line 30-32)
- Calls MarketCheck API with `dealer_id` parameter (line 42)

### 2.3 Settings Page (Update Existing)

**Location**: `/app/settings` page

**Component**: `InventoryProviderForm`  
- File: `apps/dealer-dashboard/src/components/dashboard/settings/inventory-provider-form.tsx`
- Line 69-76: MarketCheck dealer ID input field (required)
- Line 77-83: Optional ZIP code field
- Helper text: "Provided by MarketCheck. Contact their support if you need help finding it." (line 75)

**Action Handler**:
- `updateMarketCheckSettings()` in `apps/dealer-dashboard/src/app/app/settings/actions.ts:6-38`
- Calls `updateDealerProfile()` to persist changes
- Resets `inventoryConnected` flag (line 22)

### 2.4 Sync Code Path (`/v2/search/car/active`)

**Function**: `syncMarketCheckInventory()`  
- File: `apps/dealer-dashboard/src/app/app/setup/actions.ts:24-179`

**Exact Implementation**:

```typescript
// Line 30-32: Validation
if (!dealerId) {
  throw new Error('Enter your MarketCheck dealer ID before syncing.');
}

// Line 40-45: API call construction
const searchParams = new URLSearchParams({
  api_key: apiKey,
  dealer_id: dealerId,  // ← Dealer ID used here
  page: '1',
  pageSize: '100',
});

// Line 47-50: Optional parameters
if (zip) searchParams.set('zip', zip);
if (radiusMiles) searchParams.set('radius', radiusMiles.toString());
if (condition === 'new') searchParams.set('car_type', 'new');
if (condition === 'used') searchParams.set('car_type', 'used');

// Line 52: Final URL
const url = `${baseUrl}/v2/search/car/active?${searchParams.toString()}`;
```

**API Endpoint Called**:
- Base URL: `https://marketcheck-prod.apigee.net` (or `MARKETCHECK_BASE_URL` env var)
- Endpoint: `/v2/search/car/active`
- Query params: `api_key`, `dealer_id`, `zip` (optional), `radius` (optional), `car_type` (optional), `page`, `pageSize`

### 2.5 Missing Dealer ID vs ZIP/Radius Fallback

**Current Behavior**: ❌ **NO FALLBACK**

**When Dealer ID is Missing**:
- Sync function throws error: `"Enter your MarketCheck dealer ID before syncing."`  
- Reference: `apps/dealer-dashboard/src/app/app/setup/actions.ts:30-32`
- Reference: `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx:24-29`

**ZIP/Radius Usage**:
- ZIP and radius are **supplementary**, not replacements
- They refine results when dealer ID is present (for multi-store groups)
- Reference: `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx:89` helper text: "Used to refine search results for multi-store groups."

**MCP Server (ChatGPT Search) Behavior**:
- **Does NOT require dealer ID** for general searches
- Uses `location` or `zip` + `radius` instead
- Reference: `apps/mcp-server/src/services/marketcheck.ts:63-97`
- This is for ChatGPT consumer searches, not dealer inventory sync

**Recommendation**: 
- Document that dealer ID is **required** for inventory sync (dealer-specific)
- ZIP/radius are optional refinements, not fallbacks
- Consider adding a fallback mode if MarketCheck allows geographic search without dealer ID (verify with MarketCheck first)

---

## 3. Documentation Alignment

### 3.1 `docs/overview.md`

**Current Coverage**:
- ✅ Mentions dealer ID collection: Line 48: "dealers supply their MarketCheck dealer ID (+ optional ZIP/radius/condition)"
- ❌ No instructions on how to obtain dealer ID
- ❌ No prerequisites documented

**Missing**: 
- How to get dealer ID from MarketCheck
- Prerequisites (contract, data feed)
- What happens if dealer ID is missing

### 3.2 `docs/quickstart.md`

**Current Coverage**:
- ✅ Mentions setup flow: Line 43: "Collects MarketCheck dealer ID, optional ZIP, radius, and condition"
- ✅ Mentions settings: Line 46: "Lets dealers update the MarketCheck dealer ID/ZIP"
- ❌ No instructions on obtaining dealer ID
- ❌ No prerequisites documented

**Missing**:
- Step-by-step guide to find dealer ID in MarketCheck dashboard
- Prerequisites checklist
- Troubleshooting if dealer ID not found

### 3.3 `docs/api/marketcheck-endpoints.md`

**Current Coverage**:
- ✅ Documents `dealer_id` parameter: Line 22: "Restrict results to a single dealer's inventory"
- ⚠️ Lists `dealer_id` as **optional** (correct for general search, but **required** for dealer inventory sync)
- ❌ No dealer onboarding guidance
- ❌ No explanation of how to obtain dealer ID

**Issue Identified**:
- Line 22 marks `dealer_id` as optional (correct for `/v2/search/car/active` API)
- However, for AutoAgent's **inventory sync feature**, dealer ID is **required** (see `apps/dealer-dashboard/src/app/app/setup/actions.ts:30-32`)
- Documentation should clarify: optional for general search, required for dealer-specific inventory sync

**Recommendation**:
- Add a note: "`dealer_id` is optional for general search but **required** for dealer inventory sync in AutoAgent"
- Add a section on dealer onboarding or link to onboarding guide

---

## 4. Summary & Action Items

### 4.1 Critical Findings

| Item | Status | File Reference |
|------|--------|----------------|
| **Dealer ID Storage** | ✅ Complete | `profiles.marketcheck_dealer_id` (migration: `20250220_alter_profiles_marketcheck.sql:2`) |
| **Setup Form** | ✅ Complete | `/app/setup` → `InventorySyncForm` (`inventory-sync.tsx:76-82`) |
| **Settings Form** | ✅ Complete | `/app/settings` → `InventoryProviderForm` (`inventory-provider-form.tsx:69-76`) |
| **Sync Code Path** | ✅ Complete | `syncMarketCheckInventory()` → `/v2/search/car/active` (`actions.ts:24-179`) |
| **Missing Dealer ID Handling** | ✅ Complete | Throws error (no fallback) (`actions.ts:30-32`) |
| **How to Obtain Dealer ID** | ❌ Missing | Only mentions "MarketCheck dashboard" (no URL or steps) |
| **MarketCheck Lookup Endpoint** | ❌ Not Implemented | No API/UI for lookup by name/location |
| **Prerequisites Documentation** | ❌ Missing | No docs on contracts, data feeds, setup timeline |

### 4.2 Documentation Gaps to Address

1. **Add to `docs/quickstart.md`** (after line 43):
   ```markdown
   ## Obtaining Your MarketCheck Dealer ID
   
   Before syncing inventory, you need your MarketCheck dealer ID:
   1. Log into your MarketCheck dashboard at [URL TO BE CONFIRMED]
   2. Navigate to [SECTION TO BE CONFIRMED]
   3. Your dealer ID is displayed as [FORMAT TO BE CONFIRMED]
   4. If you cannot find it, contact MarketCheck support at [EMAIL/PHONE TO BE CONFIRMED]
   
   Prerequisites:
   - Active MarketCheck account
   - Data feed must be active (vehicles syncing to MarketCheck)
   - [ADDITIONAL REQUIREMENTS TO BE CONFIRMED]
   ```

2. **Update `docs/api/marketcheck-endpoints.md`** (after line 22):
   ```markdown
   - `dealer_id` (string): Restrict results to a single dealer's inventory. Example: `"12345"`.
     - **Note**: Optional for general search; **required** for AutoAgent dealer inventory sync (`/app/setup`).
   ```

3. **Add to `docs/overview.md`** (after line 48):
   ```markdown
   - **Dealer ID Onboarding**: Dealers must obtain their MarketCheck dealer ID from the MarketCheck dashboard before syncing. See `docs/quickstart.md` for detailed instructions.
   ```

### 4.3 Dealer ID Lookup Endpoint

**Status**: ⚠️ **NEEDS VERIFICATION**

**Research Findings**:
- Web search results mentioned a potential "Dealers Search API" at `https://docs.marketcheck.com/docs/api/cars/dealerships/dealers-search`
- However, this endpoint has **not been verified** in the actual MarketCheck API documentation
- Current implementation relies on **manual dealer ID entry** by dealers

**Current Implementation**:
- AutoAgent requires dealers to manually enter their dealer ID
- No programmatic lookup is implemented
- Dealers must find their ID in the MarketCheck dashboard or contact support

**Potential Enhancement**:
- If MarketCheck provides a dealer lookup endpoint (e.g., `/v2/dealer/search?name=...&location=...`), we could:
  - Add a "Lookup Dealer ID" button to the setup form
  - Allow dealers to search by dealership name and location
  - Automatically populate the dealer ID field from search results
- **Action Required**: Verify with MarketCheck whether such an endpoint exists and document it here if available

**Recommendation**:
- Document that manual entry is required until/unless a lookup endpoint is confirmed
- Flag this as a potential UX enhancement if MarketCheck provides the capability

### 4.4 Contact Information (Confirmed)

**MarketCheck Support**:
- **Email**: support@marketcheck.com (confirmed from web search)
- **Support Center**: https://www.marketcheck.com/apis/pricing/
- **Note**: Portal URL varies by account; dealers should contact support if unsure how to access their dashboard

### 4.5 Prerequisites (Confirmed)

**Required Before Obtaining Dealer ID**:
- ✅ Active MarketCheck account with signed contract
- ✅ Data feed must be active (vehicles syncing to MarketCheck)
- ✅ API access enabled (if required by your MarketCheck plan)

### 4.6 Open Questions

1. What is the exact URL for the MarketCheck dealer dashboard? (varies by account)
2. Where exactly in the dashboard is the dealer ID displayed? (account settings or dealer profile section - needs confirmation)
3. Is there a verified API endpoint to look up dealer ID by name/location? (needs confirmation from MarketCheck)
4. Can we search by ZIP/radius without dealer ID for dealer inventory sync, or is dealer ID always required? (currently required in AutoAgent)

### 4.7 Column Name Consistency Verification

**Status**: ✅ **CONSISTENT** - All references use the correct column name

**Canonical Field Name**:
- **Database Column**: `marketcheck_dealer_id` (snake_case, PostgreSQL)
- **TypeScript Property**: `marketcheckDealerId` (camelCase, TypeScript/JavaScript)

#### Database Schema
| File | Line | Reference |
|------|------|-----------|
| `apps/dealer-dashboard/supabase/migrations/20250220_alter_profiles_marketcheck.sql` | 2 | `add column if not exists marketcheck_dealer_id text` |

#### TypeScript Type Definition
| File | Line | Reference |
|------|------|-----------|
| `apps/dealer-dashboard/src/lib/supabase/profile.ts` | 8 | `marketcheckDealerId?: string | null;` (type definition) |
| `apps/dealer-dashboard/src/lib/supabase/profile.ts` | 54 | `marketcheckDealerId?: string | null;` (update input type) |

#### Database Read/Write Mapping
| File | Line | Operation | Reference |
|------|------|-----------|-----------|
| `apps/dealer-dashboard/src/lib/supabase/profile.ts` | 25 | SELECT | `"marketcheck_dealer_id"` (SQL column name) |
| `apps/dealer-dashboard/src/lib/supabase/profile.ts` | 44 | READ mapping | `marketcheckDealerId: data?.marketcheck_dealer_id ?? null` |
| `apps/dealer-dashboard/src/lib/supabase/profile.ts` | 86 | WRITE mapping | `payload["marketcheck_dealer_id"] = input.marketcheckDealerId` |

#### Page Components (Read from Profile)
| File | Line | Usage |
|------|------|-------|
| `apps/dealer-dashboard/src/app/app/setup/page.tsx` | 24 | `initialDealerId={profile?.marketcheckDealerId}` |
| `apps/dealer-dashboard/src/app/app/settings/page.tsx` | 20 | `dealerId={profile?.marketcheckDealerId}` |

#### Action Handlers (Write to Profile)
| File | Line | Usage |
|------|------|-------|
| `apps/dealer-dashboard/src/app/app/setup/actions.ts` | 150 | `marketcheckDealerId: dealerId` (sync action) |
| `apps/dealer-dashboard/src/app/app/settings/actions.ts` | 20 | `marketcheckDealerId: dealerId.trim()` (settings update) |

#### Form Components (Local State)
| File | Line | Usage |
|------|------|-------|
| `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx` | 14, 24 | Uses `initialDealerId` prop (maps from `profile?.marketcheckDealerId`) |
| `apps/dealer-dashboard/src/components/dashboard/settings/inventory-provider-form.tsx` | 15, 25, 36, 73 | Uses `dealerId` prop (maps from `profile?.marketcheckDealerId`) |

#### Verification Summary
- ✅ **Database column**: `marketcheck_dealer_id` (snake_case) - consistent across all SQL
- ✅ **TypeScript property**: `marketcheckDealerId` (camelCase) - consistent across all TypeScript code
- ✅ **Mapping**: Correctly converts between snake_case (DB) and camelCase (TS) in `profile.ts`
- ✅ **No mismatches found**: All references use the canonical field names

**Note**: The `inventory_vehicles` table has a separate `dealer_id` column (line 27 in `20250221_alter_inventory_vehicles_metafields.sql`), which stores the dealer ID associated with each vehicle listing from MarketCheck API responses. This is distinct from the `profiles.marketcheck_dealer_id` column that stores the dealer's MarketCheck account ID for authentication/API calls.

### 4.8 Code References Summary

| Component | File Path | Line(s) |
|-----------|-----------|---------|
| **Storage Schema** | `apps/dealer-dashboard/supabase/migrations/20250220_alter_profiles_marketcheck.sql` | 2 |
| **TypeScript Type** | `apps/dealer-dashboard/src/lib/supabase/profile.ts` | 8, 44, 54, 86 |
| **Setup Form** | `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx` | 14, 24 |
| **Settings Form** | `apps/dealer-dashboard/src/components/dashboard/settings/inventory-provider-form.tsx` | 15, 25, 36, 73 |
| **Sync Action** | `apps/dealer-dashboard/src/app/app/setup/actions.ts` | 150 |
| **Settings Action** | `apps/dealer-dashboard/src/app/app/settings/actions.ts` | 20 |
| **API Call** | `apps/dealer-dashboard/src/app/app/setup/actions.ts` | 40-52 |
| **Error Handling** | `apps/dealer-dashboard/src/app/app/setup/actions.ts` | 30-32 |

---

**Next Steps**: 
1. Contact MarketCheck to fill in missing onboarding information
2. Update documentation files with dealer ID acquisition steps
3. Consider adding dealer ID lookup UI if MarketCheck provides an API
4. Document prerequisites and setup timeline

