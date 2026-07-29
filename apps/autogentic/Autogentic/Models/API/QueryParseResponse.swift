import Foundation

struct QueryParseResponse: Codable {
  let success: Bool
  let data: QueryParseData?
  let error: QueryParseErrorResponse?
  
  struct QueryParseData: Codable {
    let filters: ParsedFilters
    let confidence: Double
    let parsedFields: [String]
    let explicitFields: [String]
    let location: LocationData?
    let apiCompatibleFilters: APIFilters
  }
  
  struct ParsedFilters: Codable {
    let minPrice: Int?
    let maxPrice: Int?
    let make: String?
    let model: String?
    let year: Int?
    let minYear: Int?
    let maxYear: Int?
    let condition: String?
    let maxMiles: Int?
    let bodyType: String?
    let exteriorColor: String?
    let interiorColor: String?
    let trim: String?
    let drivetrain: String?
    let fuelType: String?
    let locationText: String?
  }
  
  struct LocationData: Codable {
    let raw: String
    let lat: Double
    let lng: Double
    let source: String
  }
  
  struct APIFilters: Codable {
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
  }
}

struct QueryParseErrorResponse: Codable {
  let code: String
  let message: String
}

// Extension to convert API filters to InventorySearchRequest filters
extension QueryParseResponse.APIFilters {
  func toInventoryFilters() -> InventorySearchRequest.InventoryFilters {
    return InventorySearchRequest.InventoryFilters(
      minPrice: self.minPrice,
      maxPrice: self.maxPrice,
      make: self.make,
      model: self.model,
      year: self.year,
      minYear: self.minYear,
      maxYear: self.maxYear,
      maxMiles: self.maxMiles,
      condition: self.condition,
      bodyType: self.bodyType,
      dealerId: nil
    )
  }
}

