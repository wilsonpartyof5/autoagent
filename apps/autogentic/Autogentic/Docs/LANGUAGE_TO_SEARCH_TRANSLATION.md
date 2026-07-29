# Natural Language to Structured Search Translation

## Overview

This document specifies how natural language vehicle queries are transformed into structured API-ready filter objects, location actions, and execution strategies. The translation process bridges user intent with the inventory search system.

## Translation Pipeline

```mermaid
flowchart LR
  userInput[User Input] --> intent[Intent Classification]
  intent --> extract[Filter Extraction]
  extract --> location[Location Determination]
  location --> merge[Filter Merging]
  merge --> api[API Request]
  api --> results[Results Display]
```

### Stage 1: Intent Classification
- Classifies query into: refine, replace, compare, or explore
- See `AI_INTENT_CLASSIFICATION.md` for full specification

### Stage 2: Filter Extraction
- Parses natural language for vehicle attributes
- Outputs structured `InventorySearchRequest.InventoryFilters`

### Stage 3: Location Determination
- Geocodes location mentions via `QueryParseService`
- Determines map region action: keep, move, or fallback

### Stage 4: Filter Merging
- Combines extracted filters with existing search state
- Strategy varies by intent type (refine vs replace)

### Stage 5: API Execution
- Constructs `InventorySearchRequest` with bounds and filters
- Calls `InventoryAPIService.searchInventory()`

## Filter Structure

```swift
struct InventoryFilters {
  var minPrice: Int?          // Minimum price in dollars
  var maxPrice: Int?          // Maximum price in dollars
  var make: String?           // Vehicle make (e.g., "Toyota")
  var model: String?          // Vehicle model (e.g., "Camry")
  var year: Int?              // Exact year
  var minYear: Int?           // Minimum year
  var maxYear: Int?           // Maximum year
  var maxMiles: Int?          // Maximum mileage
  var condition: String?      // "New", "Used", "Certified Pre-Owned"
  
  // TODO: Future fields
  // var bodyType: String?     // "SUV", "Sedan", "Truck", etc.
  // var drivetrain: String?   // "AWD", "4WD", "FWD", "RWD"
  // var color: String?        // "Black", "White", "Red", etc.
  // var fuelType: String?     // "Gas", "Electric", "Hybrid"
}
```

## Translation Examples

### Example 1: Initial Search
**Query**: "show me black SUVs under $35k near Charlotte"

**Translation**:
```swift
Intent: .replace (new search, no active context)
Filters: {
  maxPrice: 35000,
  // bodyType: "SUV" (TODO: not yet extracted)
  // color: "Black" (TODO: not yet extracted)
}
Location: {
  action: .moveTo(latitude: 35.2271, longitude: -80.8431, name: "Charlotte")
}
Confidence: 0.75
Strategy: .fetchAndSummarize
```

**API Request**:
```json
{
  "bounds": {
    "north": 35.3171,
    "south": 35.1371,
    "east": -80.7531,
    "west": -80.9331
  },
  "filters": {
    "maxPrice": 35000
  },
  "pagination": {
    "page": 1,
    "limit": 50
  }
}
```

### Example 2: Refinement
**Query**: "only Toyota"

**Current State**:
```swift
existingFilters: {
  maxPrice: 35000
}
existingRegion: Charlotte area
```

**Translation**:
```swift
Intent: .refine (modifier + existing search)
Filters: {
  maxPrice: 35000,     // Preserved from existing
  make: "Toyota"       // Newly extracted
}
Location: {
  action: .keepCurrent // No location mentioned
}
Confidence: 0.80
Strategy: .fetchAndSummarize
```

**API Request**:
```json
{
  "bounds": { /* Charlotte region unchanged */ },
  "filters": {
    "maxPrice": 35000,
    "make": "Toyota"
  },
  "pagination": {
    "page": 1,
    "limit": 50
  }
}
```

### Example 3: Comparison from Detail View
**Query**: "find similar with lower miles"

**Current State**:
```swift
selectedVehicle: {
  make: "Honda",
  model: "Civic",
  year: 2021,
  price: 23500,
  mileage: 42000
}
```

**Translation**:
```swift
Intent: .compare (comparison keywords + detail context)
Filters: {
  make: "Honda",           // Same as reference
  model: "Civic",          // Same as reference
  minYear: 2019,           // Reference year - 2
  maxYear: 2023,           // Reference year + 2
  maxMiles: 37000          // Reference mileage - 5000
}
Location: {
  action: .keepCurrent     // Use current map region
}
ReferenceContext: .selectedVehicle(vehicle)
Confidence: 0.85
Strategy: .fetchAndSummarize
```

### Example 4: Location Change
**Query**: "search in Dallas instead"

**Translation**:
```swift
Intent: .replace (location change indicates new search)
Filters: {
  // Previous filters cleared
}
Location: {
  action: .moveTo(latitude: 32.7767, longitude: -96.7970, name: "Dallas")
}
Confidence: 0.90
Strategy: .fetchAndSummarize
```

### Example 5: Exploratory Question
**Query**: "what's a good family SUV under 40k?"

**Translation**:
```swift
Intent: .explore (question + no active search)
Filters: {
  maxPrice: 40000,
  // bodyType: "SUV" (TODO: not yet extracted)
  // seats: >= 7 (TODO: family heuristic)
}
Location: {
  action: .fallbackToDefault // No location mentioned
}
Confidence: 0.70
Strategy: .fetchAndSummarize
```

## Filter Extraction Rules

### Price Constraints

#### "under" / "below"
- Pattern: `(under|below)\s*\$?(\d{1,3})(,?\d{3})*k?`
- Action: Set `maxPrice`
- Examples:
  - "under 30k" → `maxPrice: 30000`
  - "below $25,000" → `maxPrice: 25000`

#### "above" / "over"
- Pattern: `(above|over)\s*\$?(\d{1,3})(,?\d{3})*k?`
- Action: Set `minPrice`
- Examples:
  - "above 20k" → `minPrice: 20000`

#### "between X and Y"
- Pattern: `between\s*\$?(\d+)k?\s*and\s*\$?(\d+)k?`
- Action: Set both `minPrice` and `maxPrice`
- Examples:
  - "between 20k and 40k" → `minPrice: 20000, maxPrice: 40000`

### Year Constraints

#### "newer than" / "after"
- Pattern: `(newer\s+than|after)\s*(20\d{2})`
- Action: Set `minYear`
- Examples:
  - "newer than 2020" → `minYear: 2020`
  - "after 2019" → `minYear: 2019`

#### "older than" / "before"
- Pattern: `(older\s+than|before)\s*(20\d{2})`
- Action: Set `maxYear`
- Examples:
  - "older than 2018" → `maxYear: 2018`

#### Exact year
- Pattern: `\b(20\d{2})\b` (with context check)
- Action: Set `year` (exact match)
- Examples:
  - "2022 Camry" → `year: 2022`

### Mileage Constraints

#### "under X miles"
- Pattern: `(under|below)\s*(\d+)k?\s*miles`
- Action: Set `maxMiles`
- Examples:
  - "under 50k miles" → `maxMiles: 50000`
  - "below 30000 miles" → `maxMiles: 30000`

### Make Extraction

**Method**: Dictionary lookup
**Dictionary**: Common makes (Toyota, Honda, Ford, Chevrolet, Tesla, BMW, Mercedes, Audi, Subaru, etc.)
**Case**: Insensitive match, output capitalized

**Examples**:
- "toyota" → `make: "Toyota"`
- "HONDA" → `make: "Honda"`
- "chevy" → `make: "Chevrolet"` (alias resolution)

### Model Extraction

**Method**: Dictionary lookup
**Dictionary**: Common models (Camry, Civic, F-150, Corolla, Model 3, etc.)
**Case**: Insensitive match, output uppercase

**Examples**:
- "camry" → `model: "CAMRY"`
- "Model 3" → `model: "MODEL 3"`
- "f-150" → `model: "F-150"`

### Condition Extraction

**Keywords**:
- "new" → `condition: "New"`
- "used" → `condition: "Used"`
- "pre-owned" → `condition: "Used"`
- "certified" → `condition: "Certified Pre-Owned"`

**Context check**: Must not be part of "newer" or other compound words

## Location Translation

Location extraction is handled by `QueryParseService.parseQueryFull()` which:

1. Detects location mentions via pattern matching
2. Calls Mapbox Geocoding API to resolve coordinates
3. Returns structured location object

**Input**: "near Charlotte", "in Austin", "around Dallas"
**Output**:
```swift
Location {
  raw: "Charlotte"
  lat: 35.2271
  lng: -80.8431
}
```

**Map Action**:
```swift
MapViewModel.updateRegionToLocation(latitude: 35.2271, longitude: -80.8431)
// Sets region with span: ±0.18 degrees (roughly 20-mile radius)
```

## Filter Merging Strategies

### Refine Intent

**Strategy**: Merge new filters with existing, making constraints MORE restrictive

```swift
// Price: Take the most restrictive range
newMaxPrice = min(existingMaxPrice ?? Int.max, extractedMaxPrice)
newMinPrice = max(existingMinPrice ?? 0, extractedMinPrice)

// Make/Model: Add if not present, preserve if present
if existing.make == nil { new.make = extracted.make }
if existing.model == nil { new.model = extracted.model }

// Year: Narrow the range
newMinYear = max(existing.minYear ?? 0, extracted.minYear)
newMaxYear = min(existing.maxYear ?? Int.max, extracted.maxYear)

// Mileage: Take lower maximum
newMaxMiles = min(existing.maxMiles ?? Int.max, extracted.maxMiles)
```

### Replace Intent

**Strategy**: Clear existing filters, use only newly extracted filters

```swift
// Start fresh
var newFilters = InventorySearchRequest.InventoryFilters()

// Apply only extracted constraints
newFilters.make = extracted.make
newFilters.maxPrice = extracted.maxPrice
// ... etc
```

### Compare Intent

**Strategy**: Derive baseline from reference vehicle, apply query modifiers

```swift
// Baseline from reference vehicle
var filters = InventorySearchRequest.InventoryFilters()
filters.make = referenceVehicle.make

// For "similar"
if query.contains("similar") {
  filters.minYear = referenceVehicle.year - 2
  filters.maxYear = referenceVehicle.year + 2
  filters.minPrice = Int(Double(referenceVehicle.price) * 0.8)
  filters.maxPrice = Int(Double(referenceVehicle.price) * 1.2)
}

// Apply additional query modifiers
if query.contains("cheaper") {
  filters.maxPrice = referenceVehicle.price - 1000
}

if query.contains("lower miles") {
  filters.maxMiles = referenceVehicle.mileage - 5000
}
```

## API Request Construction

Final step: Convert filters and location into `InventorySearchRequest`

```swift
let request = InventorySearchRequest(
  bounds: MapBounds(
    north: region.center.latitude + region.span.latitudeDelta / 2,
    south: region.center.latitude - region.span.latitudeDelta / 2,
    east: region.center.longitude + region.span.longitudeDelta / 2,
    west: region.center.longitude - region.span.longitudeDelta / 2
  ),
  filters: mergedFilters,
  pagination: Pagination(page: 1, limit: 50),
  userLocation: deviceLocation
)
```

## Response Generation

After receiving API results, generate natural language summary:

```swift
let vehicleCount = results.count
let locationName = parsedLocation?.raw

if vehicleCount == 0 {
  return "No vehicles found matching your criteria. Try adjusting your search."
} else if let location = locationName {
  return "Found \(vehicleCount) vehicle\(vehicleCount == 1 ? "" : "s") near \(location). Tap the map to explore or scroll the cards below."
} else {
  return "Found \(vehicleCount) vehicle\(vehicleCount == 1 ? "" : "s") near you. Tap the map to explore or scroll the cards below."
}
```

## Edge Cases and Fallbacks

### Ambiguous Queries
**Query**: "good cars"
**Issue**: No specific constraints
**Handling**: 
- Intent: `.explore`
- Filters: Empty (show all available)
- Response: "Here are some popular vehicles in your area."

### Contradictory Constraints
**Query**: "new cars older than 2020"
**Issue**: "new" implies current year, "older than 2020" contradicts
**Handling**:
- Intent: `.replace`
- Filters: `condition: "New"` (newer constraint ignored)
- Confidence: Low (0.4)

### Unparseable Location
**Query**: "near xyz123"
**Issue**: Geocoding fails
**Handling**:
- Location action: `.keepCurrent` or `.fallbackToDefault`
- Show results for current/default region
- Confidence: Medium (0.5)

### Empty Result Set
**Filters**: `{ make: "Toyota", maxPrice: 5000 }`
**Results**: 0 vehicles
**Handling**:
- Display "No vehicles found" message
- Suggest: "Try adjusting your price range"
- Keep filters visible for easy modification

## Performance Considerations

### Filter Extraction Optimization
- Regex compilation is done once at service initialization
- Dictionary lookups use hash maps (O(1) average)
- Short-circuit evaluation for intent classification

### API Call Debouncing
- Map camera changes debounced to 350ms
- Prevents excessive API calls during pan/zoom
- Query parsing happens immediately (no debounce)

### Caching Strategy
- Parsed locations cached by raw string
- Filter extraction results not cached (inexpensive)
- API responses not cached (real-time inventory)

## Testing Strategy

### Unit Tests
- Filter extraction for each constraint type
- Intent classification for edge cases
- Filter merging logic for all intent types
- Confidence score calculation

### Integration Tests
- End-to-end query translation
- API request construction
- Response summary generation

### Manual Test Cases
See `TEST_QUERIES.md` for comprehensive list of queries and expected translations.

## Future Enhancements

### Short-term (Next Sprint)
- Extract body type from queries
- Extract color from queries
- Support "between X and Y" for all numeric constraints
- Alias expansion (e.g., "beemer" → "BMW")

### Medium-term (Next Quarter)
- Machine learning model for intent classification
- Learned filter extraction from user behavior
- Conversational context across multiple turns
- Explicit disambiguation dialogs

### Long-term (Roadmap)
- Voice input support
- Personalized recommendations based on browse history
- Saved searches and alerts
- Natural language sort preferences ("cheapest first", "closest to me")
