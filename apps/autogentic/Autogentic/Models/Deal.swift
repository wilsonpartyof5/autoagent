import Foundation

struct Deal: Identifiable, Codable, Equatable {
  let id: String
  let listingId: String
  let status: DealStatus
  let outreachLockedUntilPaid: Bool
  let vehicle: VehicleSnapshot
  let createdAt: String
  let updatedAt: String
  
  enum DealStatus: String, Codable {
    case interested = "interested"
    case negotiating = "negotiating"
    case accepted = "accepted"
    case closed = "closed"
    
    var displayName: String {
      switch self {
      case .interested: return "Finding Best Price"
      case .negotiating: return "Negotiating"
      case .accepted: return "Deal Accepted"
      case .closed: return "Closed"
      }
    }
    
    var isActive: Bool {
      switch self {
      case .interested, .negotiating: return true
      case .accepted, .closed: return false
      }
    }
  }
}

struct VehicleSnapshot: Codable, Equatable {
  let year: Int
  let make: String
  let model: String
  let price: Int
  let trim: String?
  let msrp: Int?
  let miles: Int?
  let condition: String?
  let vin: String?
  let bodyType: String?
  let city: String?
  let state: String?
  let latitude: Double?
  let longitude: Double?
  let daysOnMarket: Int?
  let thumbnailUrl: String?
  
  var fullTitle: String {
    if let trim = trim, !trim.isEmpty {
      return "\(year) \(make) \(model) \(trim)"
    }
    return "\(year) \(make) \(model)"
  }
  
  var formattedPrice: String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencySymbol = "$"
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: price)) ?? "$\(price)"
  }
  
  var formattedMiles: String? {
    guard let miles = miles else { return nil }
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    return formatter.string(from: NSNumber(value: miles)).map { "\($0) mi" }
  }
  
  var location: String? {
    switch (city, state) {
    case let (c?, s?): return "\(c), \(s)"
    case let (c?, nil): return c
    case let (nil, s?): return s
    default: return nil
    }
  }
}

struct CreateDealRequest: Encodable {
  let listingId: String
  let vehicle: CreateVehicleSnapshot
}

struct CreateVehicleSnapshot: Encodable {
  let year: Int
  let make: String
  let model: String
  let price: Int
  let trim: String?
  let msrp: Int?
  let miles: Int?
  let condition: String?
  let vin: String?
  let bodyType: String?
  let city: String?
  let state: String?
  let latitude: Double?
  let longitude: Double?
  let daysOnMarket: Int?
  let thumbnailUrl: String?
}
