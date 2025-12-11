# Lead Submission Tool Contract

## Overview

The `submit-lead` tool is the **only entry point** for lead submissions. It is UVS-first and tool-driven, meaning:

- All vehicle and dealer data must come from the Unified Vehicle Schema (UVS)
- No direct widget → MCP lead submission is allowed
- All non-UVS provider data is rejected
- UVS lookup is enforced and required

## Tool Name

`submit-lead`

## Input Schema

### Required Fields

All fields are required unless marked as optional.

#### Vehicle Identifiers (from UVS)
- **`vehicleId`** (string): The unique vehicle identifier from UVS (e.g., 'mc-123', 'csv-456', 'api-789'). Must match a vehicle in `uvs_vehicles` table.
- **`vin`** (string): Vehicle Identification Number. Must match the VIN in the UVS record.

#### Dealer Information (from UVS)
- **`dealerId`** (string): Dealer identifier from UVS. Must match `dealer_id` in the UVS vehicle record.
- **`dealerName`** (string): Dealer name from UVS. Must match `dealer_name` in the UVS vehicle record.

#### Pricing Information (from UVS)
- **`pricing`** (object):
  - **`price`** (number, non-negative): Current vehicle price from UVS. If provided, must match UVS price (UVS is source of truth).
  - **`currency`** (string, 3-letter ISO code): Currency code (default: "USD"). Must match UVS currency if available.

#### User Contact Information
- **`user`** (object):
  - **`name`** (string, required): User's full name
  - **`email`** (string, required): User's email address (valid email format)
  - **`phone`** (string, optional): User's phone number
  - **`preferredTime`** (string, optional): Preferred contact time

#### Consent
- **`consent`** (boolean, required): Must be `true`. Lead submission requires explicit consent.

### Schema Validation

- The schema uses `.strict()` mode - any additional fields not defined above will be rejected
- Non-UVS provider data (MarketCheck listing params, query-string injected fields, etc.) are ignored/rejected

## Tool Behavior

### 1. Input Validation

The tool validates:
- All required fields are present
- Field formats (UUID, VIN pattern, email, etc.)
- No extra fields (strict mode)

### 2. UVS Lookup (Enforced)

The tool performs a **required** UVS lookup:

1. First attempts lookup by `vehicleId` in `uvs_vehicles` table
2. Falls back to lookup by `vin` if vehicleId lookup fails
3. **Rejects submission if UVS lookup fails** - vehicle must exist in UVS

### 3. Field Validation Against UVS

After successful UVS lookup, the tool validates:

- **VIN Match**: Provided `vin` must match `baseIdentity.vin` in UVS record
- **Vehicle ID Match**: Provided `vehicleId` must match `id` in UVS record
- **Dealer ID Match**: Provided `dealerId` must match `location.dealer.dealerId` in UVS record (if present)
- **Dealer Name Match**: Provided `dealerName` must match `location.dealer.name` in UVS record (if present)

If any validation fails, the submission is rejected with a specific error message.

### 4. Field Hydration from UVS

If some fields are missing from input but present in UVS, they are hydrated from UVS:

- `dealerId` → from `location.dealer.dealerId`
- `dealerName` → from `location.dealer.name`
- `price` → from `pricing.price` (UVS is source of truth)
- `currency` → from `pricing.currency` (defaults to "USD")

**Note**: `vehicleId` and `vin` are always required in input and cannot be hydrated.

### 5. Lead Persistence

The lead is stored with:

- **UVS Foreign Keys**:
  - `uvs_vehicle_id`: FK to `uvs_vehicles.id`
  - `uvs_dealer_id`: FK to `uvs_vehicles.dealer_id` (if available)

- **Pricing Snapshot**:
  - `price`: Current price at time of submission
  - `currency`: Currency code (default: "USD")

- **Encrypted Payload**: User contact information (name, email, phone, preferredTime) is encrypted and stored

- **Metadata**: `leadId`, `consent`, `createdAt`

### 6. Downstream Processing

After successful storage:

- Lead is forwarded to dashboard (fire-and-forget)
- Lead is delivered to dealer's CRM via ADF XML (fire-and-forget, if dealerId available)
- Analytics event `lead.submit` is tracked (PII-safe: only IDs, no user data)

## Response Format

### Success Response

```json
{
  "success": true,
  "content": [
    {
      "type": "text",
      "text": "Lead submitted successfully. We'll confirm with the dealer."
    }
  ],
  "structuredContent": {
    "leadId": "abc123...",
    "vehicleId": "uuid-here",
    "dealerId": "dealer-id",
    "vin": "1HGBH41JXMN109186",
    "price": 28500,
    "currency": "USD"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Error Conditions

### 1. Missing UVS Vehicle

**Error**: `"Vehicle not found in UVS inventory. Please verify the vehicle ID or VIN."`

**Cause**: UVS lookup by both `vehicleId` and `vin` failed.

**Resolution**: Ensure the vehicle exists in `uvs_vehicles` table.

### 2. VIN Mismatch

**Error**: `"VIN mismatch: provided VIN "X" does not match UVS VIN "Y""`

**Cause**: Provided VIN does not match the VIN in the UVS record.

**Resolution**: Use the correct VIN from the UVS vehicle record.

### 3. Vehicle ID Mismatch

**Error**: `"Vehicle ID mismatch: provided vehicleId "X" does not match UVS vehicle ID "Y""`

**Cause**: Provided vehicleId does not match the ID in the UVS record.

**Resolution**: Use the correct vehicleId from the UVS vehicle record.

### 4. Dealer ID Mismatch

**Error**: `"Dealer ID mismatch: provided dealerId "X" does not match UVS dealerId "Y""`

**Cause**: Provided dealerId does not match the dealerId in the UVS record.

**Resolution**: Use the correct dealerId from the UVS vehicle record.

### 5. Dealer Name Mismatch

**Error**: `"Dealer name mismatch: provided dealerName "X" does not match UVS dealerName "Y""`

**Cause**: Provided dealerName does not match the dealer name in the UVS record.

**Resolution**: Use the correct dealerName from the UVS vehicle record.

### 6. Missing Dealer Information

**Error**: `"Dealer ID is required. Vehicle in UVS does not have a dealerId."`

**Cause**: UVS vehicle record does not have dealer information.

**Resolution**: Ensure the UVS vehicle record has complete dealer information.

### 7. Missing VIN in UVS

**Error**: `"Vehicle in UVS does not have a VIN. Cannot submit lead."`

**Cause**: UVS vehicle record does not have a VIN.

**Resolution**: Ensure the UVS vehicle record has a VIN.

### 8. Invalid Input Schema

**Error**: `"Invalid input: [list of validation errors]"`

**Cause**: Input does not match the required schema (missing fields, wrong types, etc.).

**Resolution**: Ensure all required fields are provided with correct types and formats.

## Example Payloads

### Minimal Valid Payload

```json
{
  "vehicleId": "mc-12345",
  "vin": "1HGBH41JXMN109186",
  "dealerId": "dealer-123",
  "dealerName": "ABC Auto Sales",
  "pricing": {
    "price": 28500,
    "currency": "USD"
  },
  "user": {
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "consent": true
}
```

### Full Payload with Optional Fields

```json
{
  "vehicleId": "mc-12345",
  "vin": "1HGBH41JXMN109186",
  "dealerId": "dealer-123",
  "dealerName": "ABC Auto Sales",
  "pricing": {
    "price": 28500,
    "currency": "USD"
  },
  "user": {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-123-4567",
    "preferredTime": "Evening"
  },
  "consent": true
}
```

## Integration Notes for Agents B–D

### Agent B: Widget/Tool Integration

When calling the `submit-lead` tool from a widget or tool:

1. **Extract UVS fields** from the current vehicle object:
   - `vehicleId`: `vehicle.id`
   - `vin`: `vehicle.baseIdentity?.vin`
   - `dealerId`: `vehicle.location?.dealer?.dealerId`
   - `dealerName`: `vehicle.location?.dealer?.name`
   - `pricing.price`: `vehicle.pricing?.price`
   - `pricing.currency`: `vehicle.pricing?.currency || "USD"`

2. **Collect user input**:
   - Name (required)
   - Email (required)
   - Phone (optional)
   - Preferred time (optional)
   - Consent checkbox (must be checked)

3. **Call the tool**:
   ```javascript
   const result = await window.openai.callTool('submit-lead', {
     vehicleId: vehicle.id,
     vin: vehicle.baseIdentity?.vin,
     dealerId: vehicle.location?.dealer?.dealerId,
     dealerName: vehicle.location?.dealer?.name,
     pricing: {
       price: vehicle.pricing?.price,
       currency: vehicle.pricing?.currency || 'USD'
     },
     user: {
       name: formData.name,
       email: formData.email,
       phone: formData.phone,
       preferredTime: formData.preferredTime
     },
     consent: true
   });
   ```

4. **Handle response**:
   - Check `result.success`
   - Display success message or error
   - Use `result.structuredContent` for confirmation details

### Agent C: Dashboard Integration

The dashboard receives leads via the `forwardLead` service:

- Lead data includes: `leadId`, `dealerId`, `vehicleId`, `vin`, `createdAt`, `encPayload`
- Display leads with UVS vehicle information
- Decrypt `encPayload` to show user contact information (requires decryption key)

### Agent D: Analytics Integration

Analytics tracking for `lead.submit` events:

- **Event Name**: `lead.submit`
- **Required IDs**: `session_id`, `dealer_id`, `vehicle_id`, `vin`
- **Payload** (PII-safe): `{ leadId, vehicleId, vin }` - no user contact information
- **Metadata**: `request_id`, `session_id` (from request context)

## Database Schema

### Leads Table

```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  uvs_vehicle_id TEXT NOT NULL,  -- FK to uvs_vehicles.id
  uvs_dealer_id TEXT,             -- FK to uvs_vehicles.dealer_id
  vehicleId TEXT NOT NULL,         -- Backward compatibility
  dealerId TEXT,                   -- Backward compatibility
  vin TEXT NOT NULL,
  price NUMERIC NOT NULL,          -- Pricing snapshot
  currency TEXT NOT NULL DEFAULT 'USD',
  encPayload TEXT NOT NULL,        -- Encrypted user contact info
  consent INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  ipAddress TEXT                   -- Optional, for rate limiting
);
```

## Security & Privacy

- **PII Handling**: User contact information (name, email, phone) is encrypted before storage
- **Analytics**: Tracking payloads are PII-safe (only IDs, no user data)
- **Validation**: All vehicle/dealer data is validated against UVS to prevent data injection
- **Strict Schema**: Additional fields are rejected to prevent provider-specific data leakage

## Testing

See `apps/mcp-server/test/submitLead.test.ts` for test examples covering:

- Successful UVS-based lead submission
- Rejection when UVS lookup fails
- VIN mismatch rejection
- Pricing/dealer data coming from UVS
- Field validation

Run tests with:
```bash
cd apps/mcp-server
npm test -- submitLead.test.ts
```

