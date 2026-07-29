# Input Bar Send Behavior Specification

## Overview

The input bar is the persistent search control across all screens in the Autogentic iOS app. This document specifies how queries are interpreted and executed based on which screen the user is on.

## Screen Contexts

### 1. Chat View (ContentView)
**Context**: Main conversation interface where users initiate searches

**Placeholder**: "Search for any vehicle..."

**Send Behavior**:
- User input is treated as either a new search or a modification to the active search
- Intent interpreter classifies the query as: refine, replace, compare, or explore
- Query is sent to `ChatViewModel.send()` which:
  1. Appends user message to conversation
  2. Uses `IntentInterpreter` to classify intent and extract structured filters
  3. Calls `QueryParseService` to geocode location (if mentioned) and extract additional filters
  4. Triggers `MapViewModel.fetchInventory()` with combined filters
  5. Generates natural language summary based on result count
- Screen state: Remains on chat view, map tool updates inline

**Example queries**:
- "show me black SUVs under $35k near Charlotte" → New search (replace intent)
- "only Toyota" → Refines current search
- "actually show me trucks instead" → Replaces current search

### 2. Expanded Map View
**Context**: Full-screen map with vehicle carousel, user is actively browsing results

**Placeholder**: "Refine search or try a new one..."

**Send Behavior**:
- User input is sent to `ChatViewModel.send()` via the passed `chatVM` reference
- Intent interpreter receives `screenContext: .expandedMap`
- Assumes user wants to preserve map browsing context unless query clearly indicates otherwise
- Query with location change triggers map region update
- Query without location preserves current map viewport
- Screen state: Stays on expanded map view; map and carousel update in place

**Special handling**:
- Naked modifiers like "under 30k" are treated as refinements
- Location changes like "search in Austin" replace the region
- Category changes like "show trucks" replace the vehicle type filter
- Map camera position is only changed if query includes explicit location or intent is "replace"

**Example queries**:
- "only black ones" → Adds color filter, preserves map region
- "under 30k" → Adds price filter, preserves current results
- "search in Dallas" → Replaces location, fetches new vehicles for Dallas region
- "show me sedans instead" → Replaces body type, preserves rough geographic area

### 3. Vehicle Detail View
**Context**: User is viewing a specific vehicle's listing

**Placeholder**: "Find similar or search for something else..."

**Send Behavior**:
- User input is sent to `ChatViewModel.send()` via the passed `chatVM` reference
- Intent interpreter receives `screenContext: .vehicleDetail` and `selectedVehicle: Vehicle`
- Pronouns and comparative terms reference the currently viewed vehicle
- Screen state: Detail view dismisses, returns to chat/map with new results

**Comparison queries**:
- "similar to this" → Same make, ±2 years, ±20% price
- "same model with lower miles" → Exact model, mileage < current - 5k
- "like this but cheaper" → Same make, price < current - $1000
- "show me this in white" → Same make/model, different color

**New search queries**:
- "actually show me trucks" → Ignores current vehicle, starts fresh search

**Example queries**:
- "find similar with fewer miles" → Uses current vehicle as reference
- "show me this in a different color" → Same make/model, color variation
- "what about a 2023 instead" → Same make/model, year = 2023
- "cheaper options" → Similar vehicle, lower price

## Intent Classification Rules

### By Screen Context

#### Chat View
- Queries without active search → **replace** intent
- Queries with active search + modifier → **refine** intent
- Queries with "actually" or "instead" → **replace** intent
- Questions like "what's a good..." → **explore** intent

#### Expanded Map View
- Naked modifiers → **refine** intent (preserves map)
- Location changes → **replace** intent (new region)
- Category changes → **replace** intent (new vehicle type)
- Price/year/condition modifiers → **refine** intent

#### Vehicle Detail View
- Comparative terms ("similar", "like this", "cheaper") → **compare** intent
- Explicit new search ("show me trucks") → **replace** intent
- Questions → **explore** intent with current vehicle as context

## Filter Merging Strategy

### Refine Intent
- New filters are **merged** with existing filters
- Price constraints become more restrictive (min increases, max decreases)
- Make/model adds to existing constraints
- Preserves location and category from previous search

### Replace Intent
- All previous filters are **cleared**
- New filters extracted from query become the full filter set
- Location resets unless explicitly mentioned
- Category resets to query specification

### Compare Intent
- Uses selected vehicle as baseline
- Derives filters from vehicle attributes:
  - Make: Same as reference vehicle
  - Year: Reference year ± 2
  - Price: Reference price ± 20%
  - Mileage: If query mentions "lower miles", max = reference - 5k
- Additional query terms refine the comparison

## Response Flow

```
User Input → IntentInterpreter → ChatViewModel → QueryParseService → MapViewModel → InventoryAPIService → Results
```

1. User types query in input bar
2. `IntentInterpreter.interpret()` classifies intent and extracts initial filters
3. `ChatViewModel.send()` receives intent, appends to conversation
4. `QueryParseService.parseQueryFull()` geocodes location and extracts additional filters
5. Filters are merged based on intent type
6. `MapViewModel.fetchInventory()` executes API call with final filters
7. Results are displayed in map tool with natural language summary

## Keyboard Behavior

All three screens implement consistent keyboard avoidance:

- **Chat View**: Content padding = 80px + keyboard height
- **Expanded Map**: Carousel padding = 70px + keyboard height
- **Vehicle Detail**: Scroll content padding = 90px + keyboard height

Keyboard appearance/dismissal is animated with `.easeOut(duration: 0.22)`

## Success Criteria

The input bar send behavior is successful when:

1. Users can refine searches without losing context
2. Comparative queries from detail view correctly reference the viewed vehicle
3. Map browsing is preserved for additive refinements
4. Location changes smoothly trigger new region fetches
5. Intent classification matches user's mental model
6. Filters merge appropriately based on intent type
7. Responses feel conversational and immediate
