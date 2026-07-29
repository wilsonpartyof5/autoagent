import Foundation

struct InventorySearchResponse: Codable {
  let success: Bool
  let data: InventorySearchData?
  let error: InventorySearchError?
  
  struct InventorySearchData: Codable {
    let vehicles: [InventorySearchVehicle]
    let pagination: InventoryPagination
  }
}

struct InventorySearchError: Codable {
  let code: String
  let message: String
}

struct InventorySearchVehicle: Codable {
  let id: String
  let year: Int
  let make: String
  let model: String
  let trim: String?
  let condition: String
  let price: Int
  let msrp: Int?
  let miles: Int?
  let bodyType: String?
  let thumbnailUrl: String?
  let primaryPhotoUrl: String?
  let photoUrls: [String]?
  let location: InventoryLocation
  let vin: String?
}

struct InventoryLocation: Codable {
  let latitude: Double
  let longitude: Double
  let dealerName: String
  let dealerCity: String?
  let dealerState: String?
}

struct InventoryPagination: Codable {
  let page: Int
  let limit: Int
  let total: Int
  let totalPages: Int
  let hasNextPage: Bool
  let hasPreviousPage: Bool
}

// Extension to convert API vehicle to app Vehicle model
extension InventorySearchVehicle {
  func toVehicle() -> Vehicle {
    // Prefer specific photo URLs, fallback to photoUrls array
    let thumbnailUrl = self.thumbnailUrl ?? self.photoUrls?.first
    let primaryPhotoUrl = self.primaryPhotoUrl ?? self.photoUrls?.first
    
    if thumbnailUrl != nil {
      print("🟣 DEBUG: Vehicle \(self.make) \(self.model) has thumbnail URL")
    } else {
      print("🟠 DEBUG: Vehicle \(self.make) \(self.model) has NO thumbnail URL")
    }
    
    return Vehicle(
      id: self.id,
      make: self.make,
      model: self.model,
      year: self.year,
      price: self.price,
      mileage: self.miles ?? 0,
      latitude: self.location.latitude,
      longitude: self.location.longitude,
      dealerName: self.location.dealerName,
      color: "Unknown",
      distanceMiles: nil,
      trim: self.trim,
      condition: self.condition,
      msrp: self.msrp,
      thumbnailUrl: thumbnailUrl,
      primaryPhotoUrl: primaryPhotoUrl,
      photoUrls: self.photoUrls,
      vin: self.vin,
      bodyType: self.bodyType,
      dealerCity: self.location.dealerCity,
      dealerState: self.location.dealerState
    )
  }
}
