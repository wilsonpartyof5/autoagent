# Stage 1 — Query Parsing API Complete
## OpenAI Query Parsing API for iOS Inventory Search

**Date**: 2025-01-27  
**Status**: ✅ Complete — Ready for Stage 2 approval

---

## Files Changed

### 1. New API Route
**`apps/dealer-dashboard/src/app/api/query/parse/route.ts`** (NEW)
- Complete implementation of query parsing endpoint
- OpenAI integration with structured outputs (JSON schema)
- Validation and normalization logic
- Error handling and fallback behavior

### 2. Dependencies
**`apps/dealer-dashboard/package.json`** (MODIFIED)
- Added `openai: ^4.24.1` to dependencies

---

## API Endpoint

### Route
```
POST /api/query/parse
```

### Authentication
Same as `/api/inventory/search`:
- Header: `x-api-key: <INVENTORY_SEARCH_API_KEY>`
- Or: `Authorization: Bearer <INVENTORY_SEARCH_API_KEY>`

### Request Format
```json
{
  "query": "Show me red SUVs under $40,000"
}
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "filters": {
      "maxPrice": 40000,
      "bodyType": "SUV",
      "exteriorColor": "red",
      "minPrice": null,
      "make": null,
      "model": null,
      "year": null,
      "minYear": null,
      "maxYear": null,
      "condition": null,
      "maxMiles": null
    },
    "confidence": 0.8,
    "parsedFields": ["maxPrice", "bodyType", "exteriorColor"],
    "apiCompatibleFilters": {
      "maxPrice": 40000
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Failed to parse query with OpenAI: ..."
  }
}
```

---

## Request/Response Examples

### Example 1: Price and Body Type
**Request:**
```json
{
  "query": "Find trucks under $50,000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filters": {
      "maxPrice": 50000,
      "bodyType": "Truck"
    },
    "confidence": 0.7,
    "parsedFields": ["maxPrice", "bodyType"],
    "apiCompatibleFilters": {
      "maxPrice": 50000
    }
  }
}
```

### Example 2: Make, Model, and Condition
**Request:**
```json
{
  "query": "Show me new Toyota Camry 2023"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filters": {
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "condition": "new"
    },
    "confidence": 0.9,
    "parsedFields": ["make", "model", "year", "condition"],
    "apiCompatibleFilters": {
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "condition": "new"
    }
  }
}
```

### Example 3: Price Range and Miles
**Request:**
```json
{
  "query": "Used cars between $20k and $30k with less than 50k miles"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filters": {
      "minPrice": 20000,
      "maxPrice": 30000,
      "maxMiles": 50000,
      "condition": "used"
    },
    "confidence": 0.95,
    "parsedFields": ["minPrice", "maxPrice", "maxMiles", "condition"],
    "apiCompatibleFilters": {
      "minPrice": 20000,
      "maxPrice": 30000,
      "maxMiles": 50000,
      "condition": "used"
    }
  }
}
```

### Example 4: Year Range
**Request:**
```json
{
  "query": "2020 or newer GMC Sierra"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filters": {
      "make": "GMC",
      "model": "Sierra",
      "minYear": 2020
    },
    "confidence": 0.8,
    "parsedFields": ["make", "model", "minYear"],
    "apiCompatibleFilters": {
      "make": "GMC",
      "model": "Sierra",
      "minYear": 2020
    }
  }
}
```

### Example 5: Complex Query
**Request:**
```json
{
  "query": "Certified pre-owned black BMW 3 Series from 2021-2023 under $45k"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filters": {
      "make": "BMW",
      "model": "3 Series",
      "minYear": 2021,
      "maxYear": 2023,
      "maxPrice": 45000,
      "condition": "certified",
      "exteriorColor": "black"
    },
    "confidence": 0.95,
    "parsedFields": ["make", "model", "minYear", "maxYear", "maxPrice", "condition", "exteriorColor"],
    "apiCompatibleFilters": {
      "make": "BMW",
      "model": "3 Series",
      "minYear": 2021,
      "maxYear": 2023,
      "maxPrice": 45000,
      "condition": "certified"
    }
  }
}
```

---

## Prompt & Schema Used

### System Prompt
```
You are a vehicle search query parser. Extract structured filter information from natural language queries about vehicle inventory.

Rules:
- Only extract information that is EXPLICITLY mentioned in the query
- Do NOT infer or assume values
- For prices: Extract numbers with currency context (e.g., "$40k" -> 40000, "under $50000" -> maxPrice: 50000)
- For years: "2023" or "2023 model" -> year: 2023. "2020 or newer" -> minYear: 2020. "older than 2020" -> maxYear: 2019
- For condition: "new" -> "new", "used" -> "used", "certified" or "CPO" -> "certified"
- For miles: "under 50k miles" -> maxMiles: 50000, "less than 30000 miles" -> maxMiles: 30000
- For body types: Standardize to common names (SUV, Sedan, Truck, Coupe, Van, etc.)
- For colors: Extract common color names (red, blue, black, white, silver, gray, etc.)
- Return null for any field not mentioned in the query
- Be conservative - only extract what is clearly stated
```

### JSON Schema (Structured Output)
The schema includes all filterable fields:
- **Price**: `minPrice`, `maxPrice` (numbers)
- **Vehicle Identity**: `make`, `model`, `year`, `minYear`, `maxYear`
- **Condition**: `condition` (enum: "new" | "used" | "certified")
- **Mileage**: `maxMiles` (number)
- **Future Fields** (parsed but not yet API-compatible):
  - `bodyType`, `exteriorColor`, `interiorColor`, `trim`, `drivetrain`, `fuelType`

**Schema Features:**
- `strict: true` - Ensures only schema fields are returned
- `nullable: true` - All fields are optional
- Descriptions guide the model on extraction rules

---

## Validation & Normalization

### Price Normalization
- Clamps to `>= 0`
- Ensures `minPrice <= maxPrice` (swaps if invalid)
- Extracts from: "$40k", "under $50000", "between $20k and $30k"

### Year Normalization
- Clamps to `1900-2100` range
- Ensures `minYear <= maxYear` (swaps if invalid)
- Handles: "2023", "2020 or newer", "older than 2020"

### Make/Model Normalization
- Capitalizes first letter of each word
- Examples: "toyota" -> "Toyota", "bmw" -> "Bmw" (preserves brand casing)

### Color Normalization
- Maps common variations to standard names
- Examples: "crimson" -> "red", "jet black" -> "black", "pearl white" -> "white"

### Body Type Normalization
- Standardizes to common values: "SUV", "Sedan", "Truck", "Coupe", "Van", etc.
- Maps: "pickup" -> "Truck", "minivan" -> "Van", "suvs" -> "SUV"

### Condition Validation
- Only accepts: "new", "used", "certified"
- Maps: "CPO" -> "certified", "certified pre-owned" -> "certified"

---

## Error Handling

### Error Codes
1. **`UNAUTHORIZED`** (401)
   - Missing or invalid API key

2. **`INVALID_REQUEST`** (400)
   - Invalid JSON in request body

3. **`INVALID_QUERY`** (400)
   - Missing or empty query string

4. **`PARSE_ERROR`** (500)
   - OpenAI API failure
   - JSON parsing failure
   - Missing `OPENAI_API_KEY` environment variable

5. **`INTERNAL_ERROR`** (500)
   - Unexpected server errors

### Fallback Behavior
- If OpenAI structured output fails, attempts to parse from `message.content` JSON
- Returns empty filters object if parsing completely fails
- Logs errors for debugging

---

## API-Compatible Filters

The response includes both:
1. **`filters`** - All parsed fields (including future fields like `bodyType`, `exteriorColor`)
2. **`apiCompatibleFilters`** - Only fields supported by `/api/inventory/search`:
   - `minPrice`, `maxPrice`
   - `make`, `model`
   - `year`, `minYear`, `maxYear`
   - `condition`
   - `maxMiles`

**Note**: Future fields (`bodyType`, `exteriorColor`, etc.) are parsed and included in `filters` and `parsedFields` for logging/future use, but excluded from `apiCompatibleFilters` until the inventory search API supports them.

---

## Environment Variables Required

### Required
- `OPENAI_API_KEY` - OpenAI API key for query parsing
- `INVENTORY_SEARCH_API_KEY` - API key for authentication (same as inventory search endpoint)

### Setup
Add to Vercel environment variables:
```bash
OPENAI_API_KEY=sk-...
INVENTORY_SEARCH_API_KEY=your-api-key
```

---

## Testing

### cURL Example
```bash
curl -X POST https://your-domain.com/api/query/parse \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "query": "Show me red SUVs under $40,000"
  }'
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "filters": {
      "maxPrice": 40000,
      "bodyType": "SUV",
      "exteriorColor": "red"
    },
    "confidence": 0.8,
    "parsedFields": ["maxPrice", "bodyType", "exteriorColor"],
    "apiCompatibleFilters": {
      "maxPrice": 40000
    }
  }
}
```

---

## Next Steps for Stage 2

1. ✅ Integrate `/api/query/parse` into iOS app
2. ✅ Call parse endpoint on chat send
3. ✅ Merge `apiCompatibleFilters` into `/api/inventory/search` request
4. ✅ Update map/cards with filtered results
5. ✅ Keep debounced map updates

**Ready for Stage 2 approval?** ✅

