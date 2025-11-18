# AutoAgent API Documentation

## Overview

AutoAgent provides a comprehensive API for vehicle search and lead generation through the MCP (Model Context Protocol) for ChatGPT App integration.  
For direct MarketCheck REST endpoints (request parameters, response fields, and integration notes), see `api/marketcheck-endpoints.md`.

## Base URL

```
http://localhost:8787
```

## Authentication

The API uses Bearer token authentication for lead submission and dashboard integration.

## MCP Endpoints

### POST /mcp

Main MCP protocol endpoint for ChatGPT App integration.

#### Available Methods

##### tools/list
Returns available tools and their schemas.

**Response:**
```json
{
  "tools": [
    {
      "name": "search-vehicles",
      "description": "Search for vehicles based on location, price, make, model, and other criteria",
      "inputSchema": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "Location to search for vehicles (e.g., \"Seattle, WA\", \"New York, NY\")"
          },
          "condition": {
            "type": "string",
            "enum": ["new", "used"],
            "description": "Vehicle condition (new or used)"
          },
          "maxPrice": {
            "type": "number",
            "description": "Maximum price in USD"
          },
          "make": {
            "type": "string",
            "description": "Vehicle make (e.g., \"Toyota\", \"Honda\")"
          },
          "model": {
            "type": "string",
            "description": "Vehicle model (e.g., \"Camry\", \"CR-V\")"
          },
          "radiusMiles": {
            "type": "number",
            "description": "Search radius in miles (default: 50)"
          }
        },
        "required": ["location", "condition"]
      }
    },
    {
      "name": "submit-lead",
      "description": "Submit a lead for a vehicle test drive or quote request",
      "inputSchema": {
        "type": "object",
        "properties": {
          "vehicleId": {
            "type": "string",
            "description": "ID of the vehicle"
          },
          "vin": {
            "type": "string",
            "pattern": "^[A-HJ-NPR-Z0-9]{11,17}$",
            "description": "Vehicle Identification Number (VIN)"
          },
          "dealerId": {
            "type": "string",
            "description": "ID of the dealer (optional)"
          },
          "user": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Full name"
              },
              "email": {
                "type": "string",
                "format": "email",
                "description": "Email address"
              },
              "phone": {
                "type": "string",
                "description": "Phone number (optional)"
              },
              "preferredTime": {
                "type": "string",
                "description": "Preferred contact time (optional)"
              }
            },
            "required": ["name", "email"]
          },
          "consent": {
            "type": "boolean",
            "description": "User consent to be contacted (must be true)"
          }
        },
        "required": ["vehicleId", "vin", "user", "consent"]
      }
    }
  ]
}
```

##### tools/call
Execute a tool with parameters.

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "search-vehicles",
    "arguments": {
      "location": "Seattle, WA",
      "condition": "used",
      "maxPrice": 30000,
      "make": "Honda"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "mc-123",
        "vin": "1HGCM82633A004352",
        "stockNumber": "AA-1234",
        "listingId": "mc-123",
        "year": 2022,
        "make": "Toyota",
        "model": "Camry",
        "trim": "SE",
        "condition": "used",
        "bodyType": "Sedan",
        "drivetrain": "FWD",
        "fuelType": "Gasoline",
        "transmission": "Automatic",
        "price": 28500,
        "msrp": 32000,
        "priceChangeHistory": [
          {
            "price": 28950,
            "timestamp": "2025-02-20T17:10:00.000Z",
            "source": "marketcheck"
          }
        ],
        "miles": 15000,
        "dealer": {
          "dealerId": "dealer-1",
          "name": "Seattle Auto Center",
          "city": "Seattle",
          "state": "WA",
          "latitude": 47.6062,
          "longitude": -122.3321,
          "phone": "206-555-0100",
          "website": "https://dealer.example.com",
          "address": "123 Main St, Seattle, WA 98101"
        },
        "photoUrls": [
          "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400"
        ],
        "thumbnailUrl": "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400",
        "imageUrl": "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400",
        "features": ["Bluetooth", "Backup Camera", "Lane Assist"],
        "interiorColor": "Black",
        "exteriorColor": "Blue",
        "certified": false,
        "marketAveragePrice": 29200,
        "daysOnMarket": 21,
        "source": "marketcheck",
        "lastSyncedAt": "2025-02-20T17:10:00.000Z",
        "syncStatus": "success",
        "dataSource": "marketcheck-api",
        "leadStatus": "none",
        "createdAt": "2025-02-20T17:10:00.000Z",
        "updatedAt": "2025-02-20T17:10:00.000Z"
      }
    ],
    "totalCount": 10,
    "searchParams": {
      "location": "Seattle, WA",
      "condition": "used",
      "maxPrice": 30000,
      "make": "Honda"
    }
  }
}
```

##### resources/list
Returns available UI resources.

**Response:**
```json
{
  "resources": [
    {
      "uri": "ui://vehicle-results.html",
      "name": "Vehicle Results Widget",
      "description": "Interactive widget displaying vehicle search results",
      "mimeType": "text/html"
    }
  ]
}
```

##### resources/read
Get UI resource content.

**Request:**
```json
{
  "method": "resources/read",
  "params": {
    "uri": "ui://vehicle-results.html"
  }
}
```

**Response:**
```json
{
  "contents": [
    {
      "uri": "ui://vehicle-results.html",
      "mimeType": "text/html",
      "text": "<!DOCTYPE html>..."
    }
  ]
}
```

## Standard Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-20T20:11:37.473Z",
  "service": "autoagent-mcp-server",
  "version": "1.0.0"
}
```

### GET /widget/vehicle-results

Serves the interactive vehicle results widget.

**Response:** HTML content for the Zillow-style vehicle search interface.

## Data Models

### Vehicle

```typescript
interface Vehicle {
  // Identity
  id: string;
  vin?: string;
  stockNumber?: string;
  listingId?: string;

  // Specs
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition?: 'new' | 'used' | 'certified';
  bodyType?: string;
  drivetrain?: string;
  fuelType?: string;
  transmission?: string;

  // Pricing
  price: number;
  msrp?: number;
  priceChangeHistory?: Array<{ price: number; timestamp: string; source?: string }>;

  // Mileage
  miles?: number;

  // Dealer
  dealer: {
    dealerId?: string;
    name: string;
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    website?: string;
    address?: string;
  };

  // Media
  photoUrls?: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  imageUrl?: string; // primary photo

  // Features & colors
  features?: string[];
  interiorColor?: string;
  exteriorColor?: string;
  certified?: boolean;

  // Market data
  marketAveragePrice?: number;
  daysOnMarket?: number;
  source?: string;

  // Operational metadata
  lastSyncedAt: string;
  syncStatus: 'pending' | 'in_progress' | 'success' | 'failed';
  dataSource: string;

  // Lead tracking
  leadStatus: 'none' | 'submitted' | 'qualified' | 'sold';
  lastLeadAt?: string;
  leadId?: string;

  // Audit
  createdAt: string;
  updatedAt: string;
}
```

### Lead

```typescript
interface Lead {
  vehicleId: string;
  vin: string;
  dealerId?: string;
  user: {
    name: string;
    email: string;
    phone?: string;
    preferredTime?: string;
  };
  consent: boolean;
}
```

## Error Handling

### MCP Error Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Invalid search parameters: location: Required"
    }
  ],
  "isError": true
}
```

### HTTP Error Response

```json
{
  "error": "Internal server error",
  "message": "MarketCheck API error: Request timeout"
}
```

## Rate Limiting

- **Lead Submission**: 5 leads per IP per 24 hours
- **Search Requests**: No rate limiting (cached results)
- **Widget Access**: No rate limiting

## Security

### PII Encryption
- All user data encrypted with libsodium
- 32-byte encryption key required
- Base64 encoded payloads stored in database

### VIN Validation
- Pattern: `^[A-HJ-NPR-Z0-9]{11,17}$`
- Excludes I, O, Q characters
- Length validation enforced

### Consent Management
- Required user consent for lead capture
- Boolean validation enforced
- Audit trail maintained

## Environment Variables

### Required
- `MARKETCHECK_API_KEY`: MarketCheck API key for real data
- `LEAD_ENC_KEY`: 32-byte base64 encryption key

### Optional
- `PORT`: Server port (default: 8787)
- `MARKETCHECK_BASE_URL`: MarketCheck API base URL
- `DASHBOARD_INGEST_URL`: Dashboard lead ingestion URL
- `DASHBOARD_INGEST_TOKEN`: Dashboard authentication token

## Performance

### Response Times
- Search API: ~200ms average
- Lead submission: <500ms
- Widget loading: <1s
- Health check: <50ms

### Caching
- Search results: 60-second TTL
- LRU cache: 200 entries maximum
- Cache key: Sorted search parameters

## Testing

### Unit Tests
```bash
pnpm --filter mcp-server test
```

### Integration Tests
```bash
# Test MCP protocol
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'

# Test vehicle search
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"search-vehicles","arguments":{"location":"Seattle, WA","condition":"used"}}}'
```

## Deployment

### Development
```bash
pnpm --filter mcp-server dev
```

### Production
```bash
pnpm --filter mcp-server build
pnpm --filter mcp-server start
```

### Docker (Future)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 8787
CMD ["pnpm", "start"]
```

## Support

For issues and questions:
1. Check the health endpoint: `GET /health`
2. Review logs for error details
3. Verify environment variables
4. Test MarketCheck API connectivity
