import Foundation

// Top-level response envelope from POST /api/query/chat-search
struct ChatSearchResponse: Codable {
  let success: Bool
  let data: ChatSearchData?
  let error: ChatSearchAPIError?
}

struct ChatSearchAPIError: Codable {
  let code: String
  let message: String
}

struct ChatSearchData: Codable {
  /// AI-generated, MCP-grounded assistant reply shown in the chat bubble
  let assistantMessage: String

  /// Normalized vehicle list — same shape as InventorySearchVehicle
  let vehicles: [InventorySearchVehicle]

  /// Result counts
  let pagination: ChatSearchPagination

  /// Geocoded location when the query mentioned a place
  let location: ChatSearchLocation?

  /// Merged (current + previous) normalized filters applied to the search
  let apiCompatibleFilters: ChatSearchApiFilters?

  /// MarketCheck-validated canonical values actually sent to the MCP search API
  let canonicalFilters: ChatSearchApiFilters?
}

struct ChatSearchPagination: Codable {
  let total: Int
  let returned: Int
}

struct ChatSearchLocation: Codable {
  let raw: String
  let lat: Double
  let lng: Double
}

struct ChatSearchApiFilters: Codable {
  let minPrice: Int?
  let maxPrice: Int?
  let make: String?
  let model: String?
  let year: Int?
  let minYear: Int?
  let maxYear: Int?
  let maxMiles: Int?
  let condition: String?
  let bodyType: String?
  let exteriorColor: String?
  let seatingCapacity: Int?
  let powertrainType: String?

  func toInventoryFilters() -> InventorySearchRequest.InventoryFilters {
    InventorySearchRequest.InventoryFilters(
      minPrice: minPrice,
      maxPrice: maxPrice,
      make: make,
      model: model,
      year: year,
      minYear: minYear,
      maxYear: maxYear,
      maxMiles: maxMiles,
      condition: condition,
      bodyType: bodyType,
      dealerId: nil
    )
  }
}
