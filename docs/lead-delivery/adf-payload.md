# ADF XML Lead Delivery

Drevvy delivers leads to dealer CRM systems using the **ADF (AutoLead Data Format)** XML standard, an industry-standard format supported by most automotive CRM systems.

## Overview

When a lead is submitted through ChatGPT, Drevvy:

1. Generates an ADF XML payload with lead and vehicle information
2. Delivers it to the dealer's configured endpoint (HTTP or Email)
3. Logs the delivery attempt for tracking and resend capability

## Configuration

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

## ADF XML Structure

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
| `vehicle` | `price` | Selling price |
| `vehicle` | `odometer` | Vehicle mileage |
| `vendor` | `contact` | Dealer information (from inventory) |

## Delivery Logging

Every delivery attempt is logged in the `lead_delivery_logs` table with:

- Lead ID
- Delivery method (HTTP/Email)
- Target endpoint/email
- Status (success/failed/pending)
- HTTP status code (if HTTP)
- Response body (truncated to 1000 chars)
- Error message (if failed)
- ADF XML payload (for resend capability)
- Timestamp

## Resend Functionality

If a delivery fails, dealers can resend the lead from the `/app/leads` page:

1. Navigate to Leads Dashboard
2. Find the lead with "Failed" delivery status
3. Click "Resend" button
4. The system replays the exact same ADF XML payload

The resend creates a new log entry with `attempted_by` set to the user ID and `resend_note` indicating it was manually triggered.

## Supported CRM Systems

ADF XML is supported by most major automotive CRM systems including:

- DealerSocket
- CDK Global
- Reynolds & Reynolds
- DealerTrack
- VinSolutions
- And many others

Contact your CRM provider to confirm ADF XML support and obtain your webhook endpoint URL.

## Troubleshooting

### Delivery Status Shows "Failed"

1. **Check endpoint URL**: Verify the URL is correct and accessible
2. **Test endpoint**: Use httpbin.org/post or curl to test:
   ```bash
   curl -X POST https://your-endpoint.com/webhook \
     -H "Content-Type: application/xml" \
     -d @sample-adf.xml
   ```
3. **Check logs**: View delivery logs in Supabase for error details
4. **Resend**: Use the resend button to retry delivery

### HTTP Status 401/403

Your CRM endpoint may require authentication. Contact your CRM provider to:
- Add Drevvy's IP addresses to allowlist
- Configure API key authentication
- Set up OAuth if required

### Email Not Received

- Check spam/junk folder
- Verify email address is correct
- Ensure email server accepts XML attachments
- Check email delivery logs in Supabase

## Testing

### Test HTTP Endpoint

Use httpbin.org to test your endpoint configuration:

1. Set delivery endpoint to: `https://httpbin.org/post`
2. Submit a test lead
3. Check httpbin.org response to see the ADF XML payload

### Test with cURL

```bash
# Generate a sample ADF XML file
cat > test-adf.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect>
    <id source="Drevvy">test_lead_123</id>
    <requestdate>2025-02-21T18:30:00Z</requestdate>
    <customer>
      <contact>
        <name part="first">Test</name>
        <name part="last">User</name>
        <email>test@example.com</email>
      </contact>
    </customer>
  </prospect>
</adf>
EOF

# Send to your endpoint
curl -X POST https://your-crm.com/webhook/leads \
  -H "Content-Type: application/xml" \
  -d @test-adf.xml
```

## Security

- All lead data is encrypted at rest
- ADF XML is generated server-side
- Delivery logs are stored securely in Supabase
- RLS policies ensure dealers can only view their own delivery logs

## Limitations

- **Email delivery**: Currently logs but doesn't actually send emails (implementation pending)
- **Retry logic**: Automatic retries not yet implemented (manual resend available)
- **Webhook authentication**: Basic HTTP POST only (API keys/OAuth pending)

## Future Enhancements

- Automatic retry with exponential backoff
- Email delivery implementation
- Webhook authentication (API keys, OAuth)
- Delivery webhooks (notify dashboard on delivery status)
- Batch delivery for multiple leads
- Custom ADF field mapping

---

## 2025-02-21 Test Results

### Configuration
- **Delivery Method**: HTTP Endpoint
- **Endpoint URL**: `https://httpbin.org/post`
- **Dealer ID**: 10015450
- **Test Vehicle**: 2022 Toyota Camry LE (VIN: 1HGBH41JXMN109186)

### Test Execution

**Lead Submitted**:
- Name: Test User
- Email: test@example.com
- Phone: 555-123-4567
- Vehicle: Seeded demo vehicle

**Delivery Log Entry** (from `lead_delivery_logs`):
```json
{
  "lead_id": "abc123xyz",
  "delivery_method": "http",
  "delivery_target": "https://httpbin.org/post",
  "status": "success",
  "http_status": 200,
  "response_body": "{\"json\":{\"data\":\"...\"},\"url\":\"https://httpbin.org/post\"}",
  "error_message": null,
  "attempted_at": "2025-02-21T19:35:00Z",
  "attempted_by": "system"
}
```

**ADF XML Payload** (sample):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect>
    <id source="Drevvy">abc123xyz</id>
    <requestdate>2025-02-21T19:35:00Z</requestdate>
    <customer>
      <contact>
        <name part="first">Test</name>
        <name part="last">User</name>
        <email>test@example.com</email>
        <phone type="voice" time="day">555-123-4567</phone>
      </contact>
    </customer>
    <vehicle>
      <vin>1HGBH41JXMN109186</vin>
      <year>2022</year>
      <make>Toyota</make>
      <model>Camry</model>
      <trim>LE</trim>
      <price type="selling">28500</price>
      <odometer status="unknown">15000</odometer>
      <condition>used</condition>
    </vehicle>
    <vendor>
      <id source="Drevvy">abc123xyz</id>
      <vendorname>Drevvy</vendorname>
      <contact>
        <name part="full">Ask Jorge Lopez</name>
        <phone type="voice">281-555-1234</phone>
        <address>
          <city>Tomball</city>
          <regioncode>TX</regioncode>
          <postalcode>77375</postalcode>
        </address>
      </contact>
    </vendor>
    <provider>
      <id source="Drevvy">abc123xyz</id>
      <name part="full">Drevvy</name>
      <service>Drevvy Lead Generation</service>
      <url>https://www.drevvy.com</url>
    </provider>
  </prospect>
</adf>
```

**Verification**:
- ✅ ADF XML generated correctly
- ✅ HTTP POST successful (200 OK)
- ✅ Delivery log created in Supabase
- ✅ Lead appears in `/app/leads` with "Success" status
- ✅ httpbin.org received and echoed the payload

**Notes**:
- Email delivery is stubbed (logs but doesn't send) - implementation pending
- MCP server requires `SUPABASE_SERVICE_ROLE_KEY` for optimal operation
- Delivery is fire-and-forget (doesn't block lead creation)

