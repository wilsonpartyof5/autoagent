# AutoAgent API Documentation

## Overview

AutoAgent provides a comprehensive API for vehicle search and lead generation through the MCP (Model Context Protocol) for ChatGPT App integration.

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
        "id": "1C4PJMCX4KD311132-90120861-5bd1",
        "year": 2019,
        "make": "Jeep",
        "model": "Cherokee",
        "price": 15797,
        "mileage": 82367,
        "vin": "1C4PJMCX4KD311132",
        "imageUrl": "https://pictures.dealer.com/w/westgatecdjramcllc/0303/221fce3b83adfc64ba0357e1cb197c3fx.jpg",
        "features": ["Latitude", "3.2L V6", "Automatic", "4WD"],
        "dealer": {
          "name": "Westgate Chrysler Jeep Dodge Ram",
          "address": "6421 Old Westgate Road, Raleigh, NC, 27617",
          "lat": 35.900279,
          "lng": -78.762276
        }
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
  id: string;
  year: number;
  make: string;
  model: string;
  price: number;
  mileage?: number;
  imageUrl?: string;
  features?: string[];
  vin?: string;
  dealer: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
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
