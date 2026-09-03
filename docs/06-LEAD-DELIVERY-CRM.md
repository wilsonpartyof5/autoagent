# Lead Delivery & CRM

**Last Updated**: 2025-02-21  
**Status**: ✅ Active Documentation

This document consolidates all lead delivery system documentation, ADF XML format specifications, CRM integration guides, and delivery status tracking.

---

## Table of Contents

1. [Lead Delivery Overview](#lead-delivery-overview)
2. [ADF XML Format](#adf-xml-format)
3. [Configuration](#configuration)
4. [Delivery Service](#delivery-service)
5. [Delivery Logging](#delivery-logging)
6. [Resend Workflow](#resend-workflow)
7. [Testing](#testing)
8. [CRM Integration](#crm-integration)

---

## Lead Delivery Overview

### Objective

Replace bespoke CRM integrations with a universal ADF XML push so every dealer can self-configure how leads leave Drevvy. Dealers will enter either a CRM webhook URL or fallback email. Every new lead should generate an ADF payload, attempt delivery, log the outcome, and support manual resend.

### Implementation Status

| Area | Summary | Status |
| --- | --- | --- |
| Dashboard settings | Add "Lead Delivery" card (method selector, endpoint/email inputs, validation) and persist in `profiles`. | ✅ **Done** (2025-02-21) |
| ADF payload generator | Build reusable helper that maps Drevvy lead + vehicle data → ADF XML (Prospect, Customer, Vehicle, Vendor, Provider, timestamps). | ✅ **Done** (2025-02-21) |
| Delivery service | After lead creation: fetch dealer settings, send XML via HTTP POST or email fallback, handle timeouts/retries, store logs. Lives in MCP server. | ✅ **Done** (2025-02-21) |
| Delivery logging | New `lead_delivery_logs` table (+ RLS) capturing method, target, status, http status/response, payload reference, attempted_at/by. | ✅ **Done** (2025-02-21) |
| Resend workflow | Dealer dashboard lead list shows latest delivery status and exposes "Resend" button (replays stored payload + creates new log). | ✅ **Done** (2025-02-21) |
| Documentation & QA | Update README/overview, create ADF payload documentation, add testing checklist (webhook + email). | ✅ **Done** (2025-02-21) |

### Current Notes

- ✅ HTTP endpoint delivery implemented with 5s timeout
- ⚠️ Email delivery stubbed (logs but doesn't send) - needs email service integration
- ✅ Delivery logging to Supabase `lead_delivery_logs` table
- ✅ Resend functionality available in `/app/leads`
- ⚠️ MCP server needs `SUPABASE_SERVICE_ROLE_KEY` for fetching dealer settings (falls back to anon key)

---

## ADF XML Format

### Overview

Drevvy delivers leads to dealer CRM systems using the **ADF (AutoLead Data Format)** XML standard, an industry-standard format supported by most automotive CRM systems.

### ADF XML Structure

The generated ADF XML follows the [AutoLead Data Format specification](https://www.autoleaddataformat.org/). Here's a sample payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect>
    <id source="Drevvy">lead_abc123</id>
    <requestdate>2025-02-21T18:30:00Z</requestdate>
    <customer>
      <contact>
        <name part="first">John</name>
        <name part="last">Doe</name>
        <email>john.doe@example.com</email>
        <phone type="voice" time="day">555-123-4567</phone>
        <preferredcontact>Morning</preferredcontact>
      </contact>
    </customer>
    <vehicle>
      <vin>1HGBH41JXMN109186</vin>
      <year>2022</year>
      <make>Toyota</make>
      <model>Camry</model>
      <trim>LE</trim>
      <stock>STK-001</stock>
      <price type="selling">28500</price>
      <odometer status="unknown">15000</odometer>
      <condition>used</condition>
    </vehicle>
    <vendor>
      <id source="Drevvy">lead_abc123</id>
      <vendorname>Drevvy</vendorname>
      <contact>
        <name part="full">ABC Auto Sales</name>
        <phone type="voice">206-555-1234</phone>
        <address>
          <city>Seattle</city>
          <regioncode>WA</regioncode>
          <postalcode>98101</postalcode>
        </address>
      </contact>
    </vendor>
    <provider>
      <id source="Drevvy">lead_abc123</id>
      <name part="full">Drevvy</name>
      <service>Drevvy Lead Generation</service>
      <url>https://www.drevvy.com</url>
    </provider>
  </prospect>
</adf>
```

### Key Fields

| Section | Field | Description |
|---------|-------|-------------|
| `prospect/id` | `source` | Always "Drevvy" |
| `prospect/id` | Content | Unique lead ID |
| `requestdate` | | ISO 8601 timestamp of lead submission |
| `customer/contact` | `name` | Split into first/last name |
| `customer/contact` | `email` | Customer email address |
| `customer/contact` | `phone` | Customer phone (formatted) |
| `vehicle` | `vin` | Vehicle Identification Number |
| `vehicle` | `year`, `make`, `model`, `trim` | Vehicle specifications |
| `vehicle` | `stock` | Stock number |
| `vehicle` | `price` | Selling price |
| `vehicle` | `odometer` | Mileage |
| `vehicle` | `condition` | new, used, or certified |
| `vendor` | `vendorname` | Dealer name |
| `vendor/contact` | `name`, `phone`, `address` | Dealer contact information |
| `provider` | `name`, `service`, `url` | Drevvy provider information |

### ADF XML Generator

**Location**: `apps/mcp-server/src/services/adf-generator.ts`

The ADF generator creates compliant ADF XML payloads with:
- Prospect section (lead ID, request date)
- Customer section (contact information)
- Vehicle section (VIN, specs, pricing)
- Vendor section (dealer information)
- Provider section (Drevvy information)

---

## Configuration

### Dashboard Settings

Dealers configure their lead delivery settings in the dashboard at `/app/settings`:

- **Delivery Method**: Choose between HTTP endpoint or Email
- **HTTP Endpoint**: Your CRM's webhook URL that accepts ADF XML
- **Email Address**: Email address to receive ADF XML attachments

### HTTP Endpoint Setup

1. Contact your CRM provider to obtain the webhook/API endpoint URL
2. Common endpoint formats:
   - `https://your-crm.com/api/leads`
   - `https://your-crm.com/webhook/adf`
   - `https://your-crm.com/integrations/autoagent`
3. The endpoint should accept `POST` requests with `Content-Type: application/xml`
4. Test your endpoint using a tool like [httpbin.org/post](https://httpbin.org/post) or your CRM's test mode

### Email Setup

Email delivery sends ADF XML as an attachment to your configured email address. Ensure your email server accepts XML attachments.

**Note**: Email delivery is currently stubbed (logs but doesn't send). Email service integration (SendGrid/SES) is planned.

---

## Delivery Service

### Overview

After lead creation, the delivery service:
1. Fetches dealer settings from Supabase
2. Generates ADF XML payload
3. Sends XML via HTTP POST or email fallback
4. Handles timeouts/retries
5. Stores delivery logs

**Location**: `apps/mcp-server/src/services/deliverLead.ts`

### HTTP Endpoint Delivery

**Implementation**:
- Sends ADF XML via HTTP POST
- 5-second timeout
- Handles HTTP errors and timeouts
- Logs delivery attempts

**Request Format**:
- Method: `POST`
- Content-Type: `application/xml`
- Body: ADF XML payload

**Response Handling**:
- HTTP 200-299: Success
- HTTP 400-499: Client error (logged, not retried)
- HTTP 500-599: Server error (logged, can be retried)
- Timeout: Logged as timeout error

### Email Delivery

**Status**: ⚠️ Stubbed (logs but doesn't send)

**Planned Implementation**:
- Send ADF XML as email attachment
- Use SendGrid or AWS SES
- Handle email delivery errors
- Log email delivery attempts

---

## Delivery Logging

### Database Schema

**Table**: `lead_delivery_logs`

```sql
- id (uuid, primary key)
- lead_id (uuid, references leads)
- method (text) -- 'http' or 'email'
- target (text) -- endpoint URL or email address
- status (text) -- 'success', 'failed', 'pending'
- http_status (integer) -- HTTP status code (if method is 'http')
- http_response (text) -- HTTP response body (if method is 'http')
- error_message (text) -- Error details if delivery failed
- payload_reference (text) -- Reference to stored ADF XML payload
- attempted_at (timestamptz)
- attempted_by (text) -- 'mcp-server' or 'dashboard'
```

### Logging Behavior

**On Lead Creation**:
- Delivery attempt logged immediately
- Status set to 'pending' initially
- Updated to 'success' or 'failed' after delivery attempt

**On Resend**:
- New log entry created
- Original payload reused
- New delivery attempt logged

### Querying Delivery Logs

**Via SQL**:
```sql
-- Get delivery logs for a specific lead
SELECT * FROM lead_delivery_logs
WHERE lead_id = 'YOUR_LEAD_ID'
ORDER BY attempted_at DESC;

-- Get failed deliveries
SELECT * FROM lead_delivery_logs
WHERE status = 'failed'
ORDER BY attempted_at DESC;

-- Get delivery statistics
SELECT 
  method,
  status,
  COUNT(*) as count
FROM lead_delivery_logs
GROUP BY method, status;
```

**Via Dashboard**:
- Navigate to `/app/leads`
- View delivery status in leads table
- Click "Resend" for failed deliveries

---

## Resend Workflow

### Overview

Dealer dashboard lead list shows latest delivery status and exposes "Resend" button (replays stored payload + creates new log).

### Implementation

**Location**: `apps/dealer-dashboard/src/app/app/leads/actions.ts`

**Resend Function**:
- Fetches original lead data
- Regenerates ADF XML payload
- Attempts delivery again
- Creates new delivery log entry
- Updates UI with new status

### Usage

1. Navigate to `/app/leads`
2. Find lead with "Failed" delivery status
3. Click "Resend" button
4. Wait for delivery attempt
5. Check updated delivery status

---

## Testing

### Test Configuration

**Configuration**:
- Delivery Method: HTTP Endpoint
- Endpoint: `https://httpbin.org/post`
- Email: Not configured (stubbed)

### Test Lead Submission

**Test Lead**:
- Vehicle: Seeded demo vehicle (VIN: 1HGBH41JXMN109186)
- Dealer ID: 10015450
- Lead submitted via MCP `submit-lead` tool

### Expected Result

- ADF XML generated and POSTed to httpbin.org
- Delivery log created in `lead_delivery_logs` with status='success'
- HTTP status 200 from httpbin.org
- Response body contains ADF XML payload

### Verification

- Check `/app/leads` for delivery status
- Query `lead_delivery_logs` table for latest entry
- Visit https://httpbin.org/post to see payload (if within retention window)

### Testing Checklist

- [ ] Configure lead delivery settings in `/app/settings`
- [ ] Submit test lead via MCP `submit-lead` tool
- [ ] Verify delivery log created in Supabase
- [ ] Check delivery status in `/app/leads`
- [ ] Test resend functionality for failed deliveries
- [ ] Verify ADF XML format is correct
- [ ] Test with real CRM endpoint (if available)

---

## CRM Integration

### Supported CRM Systems

ADF XML is compatible with most automotive CRM systems including:
- DealerSocket
- CDK Global
- Reynolds & Reynolds
- Dealer.com
- Dealer Inspire
- And many others

### Integration Steps

1. **Obtain Webhook URL**
   - Contact your CRM provider
   - Request ADF XML webhook endpoint
   - Verify endpoint accepts `POST` requests with `Content-Type: application/xml`

2. **Configure in Drevvy**
   - Navigate to `/app/settings`
   - Select "HTTP Endpoint" as delivery method
   - Enter your CRM webhook URL
   - Click "Save Lead Delivery Settings"

3. **Test Integration**
   - Submit a test lead
   - Verify lead appears in CRM
   - Check delivery log for success status

4. **Monitor Delivery**
   - Check `/app/leads` for delivery status
   - Monitor delivery logs for errors
   - Use resend functionality for failed deliveries

### Common CRM Endpoints

**DealerSocket**:
- Format: `https://your-dealer.dealersocket.com/api/leads/adf`
- Authentication: API key in header or query parameter

**CDK Global**:
- Format: `https://your-dealer.cdkglobal.com/webhook/adf`
- Authentication: Bearer token

**Reynolds & Reynolds**:
- Format: `https://your-dealer.reynolds.com/integrations/adf`
- Authentication: API key

**Note**: Contact your CRM provider for exact endpoint URL and authentication requirements.

---

## Next Steps

1. ✅ **Complete**: All core functionality implemented
2. ⏳ **Email Integration**: Implement actual email sending (SendGrid/SES)
3. ⏳ **Retry Logic**: Add automatic retry with exponential backoff
4. ⏳ **Webhook Auth**: Support API keys/OAuth for CRM endpoints
5. ⏳ **Production Testing**: Test with real CRM endpoints

---

**Related Documentation**:
- Core Documentation: `docs/01-CORE-DOCUMENTATION.md`
- API Reference: `docs/03-API-INTEGRATION.md`
- Testing Guide: `docs/04-TESTING-QUALITY.md`

