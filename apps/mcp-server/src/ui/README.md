# Vehicle Results Widget - UVS-Only Tool-Driven Implementation

## Overview

The vehicle results widget is a UVS-only, tool-driven widget that displays vehicle inventory and handles lead submission exclusively through MCP tools. All vehicle data is sourced from `structuredContent` returned by MCP tools, and lead submission uses `window.openai.callTool("submit-lead")` with no direct POSTs.

## Data Sourcing

### Vehicle Data
- **Source**: `window.openai.toolOutput.structuredContent.results` (returned by `search-vehicles` MCP tool)
- **Format**: UVS (Unified Vehicle Schema) structure
- **No fallbacks**: No query-string JSON blobs, no MarketCheck/raw provider data
- **URL params**: Only minimal routing identifiers (`rid`, `diag`) - no vehicle data in URLs

### Globals Synchronization
- **Source**: `set_globals` event via OpenAI Apps SDK
- **Fields**: `rid`, `locale`, `user`, `session`
- **Access**: `window.GLOBALS` (updated via `window.openai.on('set_globals')`)

## Lead Submission

### Implementation
Lead submission is performed exclusively via `window.openai.callTool("submit-lead", payload)` - **no direct fetch POSTs**.

### Required Payload Fields
All fields must be extracted from UVS structure in `structuredContent`:

```javascript
{
  vehicleId: string,        // UUID from vehicle.id
  vin: string,             // From vehicle.baseIdentity.vin
  dealerId: string,        // From vehicle.location.dealer.dealerId
  dealerName: string,      // From vehicle.location.dealer.name
  pricing: {
    price: number,         // From vehicle.pricing.price
    currency: string       // From vehicle.pricing.currency (default: 'USD')
  },
  user: {
    name: string,           // From form input
    email: string,          // From form input
    phone?: string,         // Optional from form input
    preferredTime?: string  // Optional from form input
  },
  consent: boolean         // From form checkbox (must be true)
}
```

### Validation
The widget validates that all required UVS fields are present before submission:
- VIN must be available
- dealerId must be available
- dealerName must be available
- Price must be > 0

### Success/Failure Handling
- **Success**: Shows success message, closes modal after 2 seconds
- **Failure**: Shows error message with details, keeps form open for retry
- **No PII in analytics**: Lead tracking handled by MCP tool, widget does not emit PII

## Analytics

### Event Tracking
- **No PII**: Analytics events do not include VIN or user data
- **Allowed fields**: `vehicleId`, `dealerId`, `year`, `make`, `model`, `price`, `source`
- **Endpoint**: `/widget/track` (for non-PII analytics only)

### Events Tracked
- `vehicle.view` - Vehicle card viewed
- `vehicle.click` - Vehicle card clicked
- `vehicle.compare` - Vehicles compared
- `lead_start` - Lead form opened
- `sheet_state` - Bottom sheet state changed

## UVS Helper Functions

The widget includes helper functions to extract fields from UVS structure:

- `getUVSYear(vehicle)` - Extract year
- `getUVSMake(vehicle)` - Extract make
- `getUVSModel(vehicle)` - Extract model
- `getUVSVIN(vehicle)` - Extract VIN
- `getUVSPrice(vehicle)` - Extract price
- `getUVSDealer(vehicle)` - Extract dealer object
- `getUVSDealerId(vehicle)` - Extract dealerId
- `getUVSDealerName(vehicle)` - Extract dealerName
- `getUVSPricing(vehicle)` - Extract pricing object
- `getUVSCurrency(vehicle)` - Extract currency (default: 'USD')

## Testing

### Manual Verification Steps

1. **No Direct POSTs**: 
   - Search widget code for `fetch.*submit` or `POST.*lead` - should find none
   - Verify lead submission uses `window.openai.callTool("submit-lead")`

2. **UVS Data Sourcing**:
   - Verify `getResults()` reads from `window.openai.toolOutput.structuredContent.results`
   - Verify no MarketCheck fallback references exist
   - Verify URL params only contain `rid` and `diag` (no vehicle data)

3. **Lead Submission**:
   - Open lead form, fill required fields
   - Submit and verify `callTool` is invoked with correct UVS payload
   - Verify success/failure UI updates correctly

4. **Analytics Sanity**:
   - Verify `logEvent` does not include VIN or user data
   - Verify analytics payload only contains non-PII metadata

## File Structure

- `vehicle-results.html` - Main widget file (UVS-only implementation)
- `README.md` - This documentation

## Notes

- The widget expects vehicle data in UVS format from `structuredContent`
- All vehicle data must come from MCP tools - no direct API calls
- Lead submission is tool-driven only - no direct POSTs to `/mcp` or other endpoints
- Analytics events are sanitized to exclude PII (VIN, user data)

