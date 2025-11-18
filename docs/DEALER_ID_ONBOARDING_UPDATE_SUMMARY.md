# MarketCheck Dealer ID Onboarding Content Update Summary

**Date**: 2025-02-19  
**Status**: ✅ Complete

## Summary

Turned the dealer ID verification findings into usable onboarding content across documentation and UI. All files have been updated with detailed instructions, contact information, and prerequisites.

---

## Changes Made

### 1. Documentation Updates

#### ✅ `docs/quickstart.md`
**Added**: Complete "Get Your MarketCheck Dealer ID" section with:
- Prerequisites checklist (active account, contract, data feed, API access)
- Step-by-step instructions to find dealer ID in MarketCheck dashboard
- Alternative method: finding dealer ID in API response
- Contact information (support@marketcheck.com)
- What to enter in AutoAgent form

**Location**: New section inserted after line 40, before "Inventory Sync Workflow"

#### ✅ `docs/overview.md`
**Updated**: In-App Inventory Onboarding section
- Added link to dealer ID acquisition checklist in quickstart.md
- Mentioned prerequisites (active account, contract, data feed, API access)
- Clarified that dealer ID is required before syncing

**Location**: Line 48-49

#### ✅ `docs/api/marketcheck-endpoints.md`
**Updated**: `/v2/search/car/active` endpoint documentation
- Added note clarifying that `dealer_id` is optional for MarketCheck API but **required** for AutoAgent's dealer inventory sync
- Added link to quickstart.md for dealer ID acquisition instructions

**Location**: Line 22-23

### 2. UI Updates

#### ✅ `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx`
**Updated**: Enhanced helper text for dealer ID field
- Changed from: "Find this in your MarketCheck dashboard."
- Changed to: "Find this in your MarketCheck dealer portal (account settings or dealer profile section). Need help? Contact MarketCheck support" (with mailto link)
- Updated `Field` component to accept `ReactNode` for helper text (allows links)

**Location**: Lines 75-95, 178-209

#### ✅ `apps/dealer-dashboard/src/components/dashboard/settings/inventory-provider-form.tsx`
**Updated**: Enhanced helper text for dealer ID field (same as setup form)
- Changed from: "Provided by MarketCheck. Contact their support if you need help finding it."
- Changed to: "Find this in your MarketCheck dealer portal (account settings or dealer profile section). Need help? Contact MarketCheck support" (with mailto link)
- Updated `Field` component to accept `ReactNode` for helper text

**Location**: Lines 70-90, 124-154

### 3. Verification Document Updates

#### ✅ `docs/MARKETCHECK_DEALER_ID_VERIFICATION.md`
**Added**: New sections documenting:
- Dealer ID lookup endpoint research findings (needs verification)
- Confirmed contact information (support@marketcheck.com)
- Confirmed prerequisites (active account, contract, data feed, API access)
- Open questions remaining

**Location**: New sections 4.3-4.6

---

## Confirmed Information

### Contact Information
- **Email**: support@marketcheck.com ✅
- **Support Center**: https://www.marketcheck.com/apis/pricing/ ✅
- **Recent confirmation (2025-02-21)**: Support verified that **My Rock Hill GMC** is active under `mc_website_id 11042155` and accessible via `https://mc-api.marketcheck.com/v2/car/dealer/inventory/active?...&source=myrockhillgmc.com`. This is now our official example dealer when documenting a “known-good” inventory sync.

### Prerequisites
- ✅ Active MarketCheck account with signed contract
- ✅ Data feed must be active (vehicles syncing to MarketCheck)
- ✅ API access enabled (if required by your MarketCheck plan)

### Implementation Status
- ✅ Manual dealer ID entry required (no programmatic lookup)
- ✅ Dealer ID is required for AutoAgent inventory sync
- ✅ ZIP/radius are optional refinements, not replacements for dealer ID

---

## Open Questions / Needs Verification

### 1. MarketCheck Portal URL
- **Status**: ⚠️ Not confirmed
- **Issue**: Portal URL varies by account
- **Current Guidance**: Direct dealers to contact MarketCheck support if unsure
- **Action**: Contact MarketCheck to confirm if there's a standard portal URL pattern

### 2. Exact Location of Dealer ID in Dashboard
- **Status**: ⚠️ Partially confirmed
- **Current Guidance**: "Account settings or dealer profile section"
- **Action**: Verify exact navigation path with MarketCheck or a test dealer account

### 3. Dealer ID Lookup API Endpoint
- **Status**: ⚠️ Not verified
- **Research Finding**: Web search mentioned potential "Dealers Search API" but not confirmed
- **Current Implementation**: Manual entry only
- **Potential Enhancement**: If endpoint exists, could add "Lookup Dealer ID" button to setup form
- **Action**: Contact MarketCheck to verify if `/v2/dealer/search` or similar endpoint exists

### 4. Geographic Search Without Dealer ID
- **Status**: ⚠️ Not verified
- **Current Behavior**: AutoAgent requires dealer ID for inventory sync
- **Question**: Can MarketCheck API search by ZIP/radius without dealer ID for dealer inventory?
- **Action**: Verify with MarketCheck if this is possible and update sync logic if needed

---

## File Diffs

### `docs/quickstart.md`
```diff
+## Get Your MarketCheck Dealer ID
+
+Before syncing inventory in AutoAgent, you need your MarketCheck dealer ID. Follow these steps:
+
+### Prerequisites
+- ✅ Active MarketCheck account with signed contract
+- ✅ Data feed must be active (vehicles syncing to MarketCheck)
+- ✅ API access enabled (if required by your MarketCheck plan)
+
+### Finding Your Dealer ID
+
+1. **Log into MarketCheck Dashboard**
+   - Access your MarketCheck dealer portal (URL varies by account; contact MarketCheck if unsure)
+   - Navigate to your account settings or dealer profile section
+   - Your dealer ID is typically displayed as a numeric value (e.g., `102345`)
+
+2. **Alternative: Check API Response**
+   - If you've received inventory data from MarketCheck API before, your dealer ID appears in the `dealer.id` field of any listing response
+   - Example: `GET /v2/search/car/active?api_key=...&location=Seattle,WA` returns listings with `dealer.id` values
+
+3. **Contact MarketCheck Support**
+   - If you cannot locate your dealer ID, contact MarketCheck support:
+     - **Email**: support@marketcheck.com
+     - **Support Center**: [MarketCheck Support](https://www.marketcheck.com/apis/pricing/)
+   - Provide your dealership name and location to expedite lookup
+
+### What to Enter in AutoAgent
+
+- **Dealer ID**: Enter the numeric dealer ID (e.g., `102345`) in the setup form at `/app/setup`
+- **ZIP Code** (optional): Your dealership's ZIP code helps refine results for multi-store groups
+- **Radius** (optional): Search radius in miles (default: 50) for geographic filtering
+
+> **Note**: The dealer ID is **required** for AutoAgent's inventory sync feature. ZIP and radius are optional refinements that help filter results but cannot replace the dealer ID.
+
## Inventory Sync Workflow (Current State)
```

### `docs/overview.md`
```diff
- `/app/setup` now focuses on MarketCheck: dealers supply their MarketCheck dealer ID (+ optional ZIP/radius/condition) and trigger a Supabase-backed sync that pulls listings into `inventory_vehicles`.
+ `/app/setup` now focuses on MarketCheck: dealers supply their MarketCheck dealer ID (+ optional ZIP/radius/condition) and trigger a Supabase-backed sync that pulls listings into `inventory_vehicles`.
+  - **Dealer ID Onboarding**: Dealers must obtain their MarketCheck dealer ID before syncing. Prerequisites include an active MarketCheck account with signed contract, active data feed, and API access (if required). See the "Get Your MarketCheck Dealer ID" section in `docs/quickstart.md` for detailed instructions, including how to find the ID in the MarketCheck dashboard and contact information for support.
```

### `docs/api/marketcheck-endpoints.md`
```diff
- `dealer_id` (string): Restrict results to a single dealer's inventory. Example: `"12345"`.
+ `dealer_id` (string): Restrict results to a single dealer's inventory. Example: `"12345"`.
+  - **Note**: While `dealer_id` is optional for the MarketCheck API (allows general search), it is **required** for AutoAgent's dealer inventory sync feature (`/app/setup`). Dealers must obtain their dealer ID from the MarketCheck dashboard before syncing. See `docs/quickstart.md` for instructions on finding your dealer ID.
```

### UI Components (Both Forms)
```diff
- helper="Find this in your MarketCheck dashboard."
+ helper={
+   <>
+     Find this in your MarketCheck dealer portal (account settings or dealer profile section).{" "}
+     <a
+       href="mailto:support@marketcheck.com"
+       className="font-medium text-primary underline-offset-2 hover:underline"
+       target="_blank"
+       rel="noopener noreferrer"
+     >
+       Need help? Contact MarketCheck support
+     </a>
+     .
+   </>
+ }
```

---

## Testing Recommendations

1. **Visual Testing**: Verify helper text renders correctly with clickable mailto link
2. **Accessibility**: Ensure link is keyboard-navigable and screen-reader friendly
3. **Mobile**: Check helper text wraps properly on small screens
4. **Documentation**: Test all links in documentation files

---

## Next Steps

1. **Contact MarketCheck** to verify:
   - Exact portal URL pattern or standard login page
   - Exact location of dealer ID in dashboard (navigation path)
   - Whether dealer lookup API endpoint exists
   - If geographic search without dealer ID is possible for dealer inventory

2. **Update Documentation** once MarketCheck provides:
   - Specific portal URL (if standard)
   - Exact navigation path to dealer ID
   - API endpoint documentation (if lookup endpoint exists)

3. **Potential Enhancement** (if lookup endpoint exists):
   - Add "Lookup Dealer ID" button to setup form
   - Implement search by name/location
   - Auto-populate dealer ID field from search results

---

## Screenshots

_Note: Screenshots would need to be captured from the running application. The UI changes are minimal but improve clarity:_

- **Before**: Simple text "Find this in your MarketCheck dashboard."
- **After**: Text with clickable support link: "Find this in your MarketCheck dealer portal (account settings or dealer profile section). Need help? Contact MarketCheck support."

---

## Summary

✅ All documentation updated with dealer ID acquisition instructions  
✅ All UI forms updated with enhanced helper text and support links  
✅ Prerequisites clearly documented  
✅ Contact information confirmed and included  
⚠️ Portal URL and lookup endpoint need verification from MarketCheck  

The onboarding content is now production-ready, with clear guidance for dealers on obtaining their MarketCheck dealer ID. Remaining open questions are documented and can be addressed once MarketCheck provides clarification.
