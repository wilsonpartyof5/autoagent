import Foundation
import MapKit

/// Intent classification for natural language vehicle search queries.
///
/// The IntentInterpreter analyzes user input and contextual state to determine
/// what action the user wants to perform: refine, replace, compare, or explore.
enum SearchIntentType {
  /// User wants to narrow or add constraints to the current search
  case refine
  
  /// User wants to start a completely new search, clearing previous context
  case replace
  
  /// User wants to find vehicles similar to a specific reference vehicle
  case compare
  
  /// User wants broad recommendations or exploratory guidance
  case explore
}

/// Actions the system should take with map location based on query
enum LocationAction {
  /// Keep the current map region unchanged
  case keepCurrent
  
  /// Move map to a new parsed location
  case moveTo(latitude: Double, longitude: Double, name: String)
  
  /// Fall back to device location or default region
  case fallbackToDefault
}

/// Reference context for interpreting relative queries like "similar" or "cheaper"
enum ReferenceContext: Equatable {
  /// No specific reference; query is standalone
  case none
  
  /// Query refers to the current visible result set on the map
  case currentResults
  
  /// Query refers to a specific vehicle (e.g., from detail view)
  case selectedVehicle(Vehicle)
  
  static func == (lhs: ReferenceContext, rhs: ReferenceContext) -> Bool {
    switch (lhs, rhs) {
    case (.none, .none):
      return true
    case (.currentResults, .currentResults):
      return true
    case (.selectedVehicle(let v1), .selectedVehicle(let v2)):
      return v1.id == v2.id
    default:
      return false
    }
  }
}

/// How the system should respond after interpreting the query
enum ResponseStrategy {
  /// Execute search immediately and show results
  case fetchImmediately
  
  /// Execute search, then generate a natural language summary
  case fetchAndSummarize
  
  /// Ask a follow-up question before executing (only when confidence is very low)
  case askClarification(question: String)
}

/// Structured output from intent interpretation
struct SearchIntent {
  let intentType: SearchIntentType
  let filters: InventorySearchRequest.InventoryFilters?
  let locationAction: LocationAction
  let referenceContext: ReferenceContext
  let responseStrategy: ResponseStrategy
  let confidence: Double // 0.0 to 1.0
}

/// Screen context to help interpret queries differently based on where the user is
enum ScreenContext {
  case chat
  case expandedMap
  case vehicleDetail
}

/// Core intent interpretation service
enum IntentInterpreter {
  
  /// Interpret a natural language query in context
  ///
  /// - Parameters:
  ///   - query: The raw user input
  ///   - screenContext: Which screen the query originated from
  ///   - currentFilters: Active filters from the current search, if any
  ///   - selectedVehicle: The vehicle currently being viewed, if any
  ///   - currentRegion: The active map region
  /// - Returns: A structured SearchIntent with classification and execution plan
  static func interpret(
    query: String,
    screenContext: ScreenContext,
    currentFilters: InventorySearchRequest.InventoryFilters?,
    selectedVehicle: Vehicle?,
    currentRegion: MKCoordinateRegion?
  ) -> SearchIntent {
    let normalized = query.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    
    // Detect intent type first
    let intentType = classifyIntent(
      query: normalized,
      screenContext: screenContext,
      hasCurrentSearch: currentFilters != nil
    )
    
    // Determine reference context
    let referenceContext = determineReferenceContext(
      query: normalized,
      screenContext: screenContext,
      selectedVehicle: selectedVehicle
    )
    
    // Extract filters based on intent
    let filters = extractFilters(
      query: normalized,
      intentType: intentType,
      currentFilters: currentFilters,
      referenceContext: referenceContext
    )
    
    // Determine location action
    let locationAction = determineLocationAction(
      query: normalized,
      intentType: intentType,
      currentRegion: currentRegion
    )
    
    // Calculate confidence
    let confidence = calculateConfidence(
      query: normalized,
      intentType: intentType,
      filters: filters
    )
    
    // Determine response strategy
    let responseStrategy: ResponseStrategy = confidence > 0.6 ? .fetchAndSummarize : .fetchImmediately
    
    return SearchIntent(
      intentType: intentType,
      filters: filters,
      locationAction: locationAction,
      referenceContext: referenceContext,
      responseStrategy: responseStrategy,
      confidence: confidence
    )
  }
  
  // MARK: - Intent Classification
  
  private static func classifyIntent(
    query: String,
    screenContext: ScreenContext,
    hasCurrentSearch: Bool
  ) -> SearchIntentType {
    // Replace indicators
    let replaceKeywords = ["actually", "instead", "start over", "show me", "find me", "search for"]
    let hasReplaceKeyword = replaceKeywords.contains { query.contains($0) }
    
    // Compare indicators
    let compareKeywords = ["similar", "like this", "same", "comparable", "this one"]
    let hasCompareKeyword = compareKeywords.contains { query.contains($0) }
    
    // Explore indicators (questions or open-ended requests)
    let exploreKeywords = ["what", "which", "should i", "recommend", "best", "good"]
    let hasExploreKeyword = exploreKeywords.contains { query.contains($0) }
    
    // Refine indicators (modifiers without full context)
    let refineKeywords = ["under", "below", "above", "only", "with", "without", "newer", "older", "closer"]
    let hasRefineKeyword = refineKeywords.contains { query.contains($0) }
    
    // Decision logic
    if hasCompareKeyword && screenContext == .vehicleDetail {
      return .compare
    }
    
    if hasExploreKeyword && !hasCurrentSearch {
      return .explore
    }
    
    if hasReplaceKeyword || (screenContext == .chat && !hasCurrentSearch) {
      return .replace
    }
    
    if hasRefineKeyword && hasCurrentSearch {
      return .refine
    }
    
    // Default: if user has a current search, assume refinement; otherwise, new search
    return hasCurrentSearch ? .refine : .replace
  }
  
  // MARK: - Reference Context Detection
  
  private static func determineReferenceContext(
    query: String,
    screenContext: ScreenContext,
    selectedVehicle: Vehicle?
  ) -> ReferenceContext {
    let contextKeywords = ["this", "this one", "similar", "like", "same"]
    let hasContextReference = contextKeywords.contains { query.contains($0) }
    
    if hasContextReference && screenContext == .vehicleDetail && selectedVehicle != nil {
      return .selectedVehicle(selectedVehicle!)
    }
    
    if hasContextReference && screenContext == .expandedMap {
      return .currentResults
    }
    
    return .none
  }
  
  // MARK: - Filter Extraction
  
  private static func extractFilters(
    query: String,
    intentType: SearchIntentType,
    currentFilters: InventorySearchRequest.InventoryFilters?,
    referenceContext: ReferenceContext
  ) -> InventorySearchRequest.InventoryFilters? {
    var filters = currentFilters
    
    // For replace intent, start fresh (unless it's a compare)
    if intentType == .replace && referenceContext == .none {
      filters = InventorySearchRequest.InventoryFilters()
    } else if filters == nil {
      filters = InventorySearchRequest.InventoryFilters()
    }
    
    // Extract price constraints
    if let priceFilter = extractPrice(from: query) {
      if intentType == .refine {
        // Merge with existing - copy to local variables to avoid overlapping access
        let currentMaxPrice = filters?.maxPrice ?? Int.max
        let currentMinPrice = filters?.minPrice ?? 0
        
        filters?.maxPrice = min(currentMaxPrice, priceFilter.max ?? Int.max)
        if let min = priceFilter.min {
          filters?.minPrice = max(currentMinPrice, min)
        }
      } else {
        filters?.minPrice = priceFilter.min
        filters?.maxPrice = priceFilter.max
      }
    }
    
    // Extract make/model
    if let make = extractMake(from: query) {
      filters?.make = make
    }
    
    if let model = extractModel(from: query) {
      filters?.model = model
    }
    
    // Extract year constraints
    if let yearFilter = extractYear(from: query) {
      filters?.minYear = yearFilter.min
      filters?.maxYear = yearFilter.max
    }
    
    // Extract mileage constraints
    if let maxMiles = extractMaxMileage(from: query) {
      filters?.maxMiles = maxMiles
    }
    
    // Extract condition
    if let condition = extractCondition(from: query) {
      filters?.condition = condition
    }
    
    // Handle comparison context
    if case .selectedVehicle(let vehicle) = referenceContext {
      filters = deriveFiltersFromVehicle(vehicle, query: query, baseFilters: filters)
    }
    
    return filters
  }
  
  // MARK: - Filter Extraction Helpers
  
  private static func extractPrice(from query: String) -> (min: Int?, max: Int?)? {
    // Match patterns like "under 30k", "below $35000", "under $30,000"
    if query.contains("under") || query.contains("below") {
      if let match = query.range(of: #"\$?(\d{1,3})(,?\d{3})*k?"#, options: .regularExpression) {
        let priceStr = String(query[match])
          .replacingOccurrences(of: "$", with: "")
          .replacingOccurrences(of: ",", with: "")
          .replacingOccurrences(of: "k", with: "000")
        if let maxPrice = Int(priceStr) {
          return (min: nil, max: maxPrice)
        }
      }
    }
    
    // Match "between X and Y"
    if query.contains("between") {
      // Simple pattern for now
      return nil
    }
    
    return nil
  }
  
  private static func extractMake(from query: String) -> String? {
    let commonMakes = ["toyota", "honda", "ford", "chevrolet", "chevy", "tesla", "bmw", "mercedes", "audi", "subaru", "nissan", "mazda", "volkswagen", "vw", "hyundai", "kia", "jeep", "ram", "gmc", "dodge"]
    
    for make in commonMakes {
      if query.contains(make) {
        return make.capitalized
      }
    }
    
    return nil
  }
  
  private static func extractModel(from query: String) -> String? {
    let commonModels = ["camry", "civic", "accord", "f-150", "f150", "corolla", "rav4", "model 3", "model s", "model x", "model y", "outback", "forester", "crv", "cr-v"]
    
    for model in commonModels {
      if query.contains(model) {
        return model.uppercased()
      }
    }
    
    return nil
  }
  
  private static func extractYear(from query: String) -> (min: Int?, max: Int?)? {
    // Match "newer than 2020", "2022 or newer", "older than 2019"
    if query.contains("newer") || query.contains("after") {
      if let match = query.range(of: #"(20\d{2})"#, options: .regularExpression) {
        if let year = Int(String(query[match])) {
          return (min: year, max: nil)
        }
      }
    }
    
    if query.contains("older") || query.contains("before") {
      if let match = query.range(of: #"(20\d{2})"#, options: .regularExpression) {
        if let year = Int(String(query[match])) {
          return (min: nil, max: year)
        }
      }
    }
    
    return nil
  }
  
  private static func extractMaxMileage(from query: String) -> Int? {
    // Match "under 50k miles", "below 30000 miles"
    if query.contains("miles") && (query.contains("under") || query.contains("below")) {
      if let match = query.range(of: #"(\d+)k?\s*miles"#, options: .regularExpression) {
        let milesStr = String(query[match])
          .replacingOccurrences(of: "k", with: "000")
          .replacingOccurrences(of: " miles", with: "")
          .replacingOccurrences(of: "miles", with: "")
        if let maxMiles = Int(milesStr.trimmingCharacters(in: .whitespaces)) {
          return maxMiles
        }
      }
    }
    
    return nil
  }
  
  private static func extractCondition(from query: String) -> String? {
    if query.contains("new") && !query.contains("newer") {
      return "New"
    }
    if query.contains("used") || query.contains("pre-owned") {
      return "Used"
    }
    if query.contains("certified") {
      return "Certified Pre-Owned"
    }
    return nil
  }
  
  private static func deriveFiltersFromVehicle(
    _ vehicle: Vehicle,
    query: String,
    baseFilters: InventorySearchRequest.InventoryFilters?
  ) -> InventorySearchRequest.InventoryFilters {
    var filters = baseFilters ?? InventorySearchRequest.InventoryFilters()
    
    // "similar" means same make, close year and price range
    if query.contains("similar") || query.contains("like") {
      filters.make = vehicle.make
      filters.minYear = vehicle.year - 2
      filters.maxYear = vehicle.year + 2
      filters.minPrice = Int(Double(vehicle.price) * 0.8)
      filters.maxPrice = Int(Double(vehicle.price) * 1.2)
    }
    
    // "cheaper" means same category but lower price
    if query.contains("cheaper") || query.contains("less expensive") {
      filters.make = vehicle.make
      filters.maxPrice = vehicle.price - 1000
    }
    
    // "lower miles" means similar vehicle but fewer miles
    if query.contains("lower miles") || query.contains("fewer miles") {
      filters.make = vehicle.make
      filters.model = vehicle.model
      filters.maxMiles = vehicle.mileage - 5000
    }
    
    // "same model" means exact model match
    if query.contains("same model") {
      filters.make = vehicle.make
      filters.model = vehicle.model
    }
    
    return filters
  }
  
  // MARK: - Location Action Determination
  
  private static func determineLocationAction(
    query: String,
    intentType: SearchIntentType,
    currentRegion: MKCoordinateRegion?
  ) -> LocationAction {
    // Check for explicit location mentions
    // For now, we'll keep current region unless explicitly changed
    // The actual geocoding happens in QueryParseService
    
    let locationKeywords = ["in", "near", "around", "at"]
    let hasLocationMention = locationKeywords.contains { query.contains($0) }
    
    if hasLocationMention && intentType == .replace {
      // Location will be parsed by QueryParseService
      return .keepCurrent // Placeholder; actual geocoding happens externally
    }
    
    // For refine intents, preserve map location
    if intentType == .refine {
      return .keepCurrent
    }
    
    return .keepCurrent
  }
  
  // MARK: - Confidence Calculation
  
  private static func calculateConfidence(
    query: String,
    intentType: SearchIntentType,
    filters: InventorySearchRequest.InventoryFilters?
  ) -> Double {
    var confidence: Double = 0.5
    
    // Boost confidence if we extracted specific filters
    if let filters = filters {
      if filters.make != nil { confidence += 0.15 }
      if filters.model != nil { confidence += 0.15 }
      if filters.maxPrice != nil || filters.minPrice != nil { confidence += 0.10 }
      if filters.minYear != nil || filters.maxYear != nil { confidence += 0.10 }
    }
    
    // Boost confidence for clear intent indicators
    let intentKeywords = ["show", "find", "search", "similar", "under", "newer"]
    let matchCount = intentKeywords.filter { query.contains($0) }.count
    confidence += Double(matchCount) * 0.05
    
    return min(confidence, 1.0)
  }
}
