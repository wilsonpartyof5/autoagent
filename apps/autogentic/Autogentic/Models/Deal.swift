import Foundation

struct Deal: Identifiable, Codable, Equatable {
  let id: String
  let listingId: String
  let status: DealStatus
  let vehicleSnapshot: DealVehicleSnapshot
  let createdAt: String
  let updatedAt: String
  
  enum DealStatus: String, Codable {
    case pending = "pending"
    case quoted = "quoted"
    case accepted = "accepted"
    case declined = "declined"
    case expired = "expired"
    case cancelled = "cancelled"
    
    var displayName: String {
      switch self {
      case .pending: return "Getting Price"
      case .quoted: return "Quote Ready"
      case .accepted: return "Accepted"
      case .declined: return "Declined"
      case .expired: return "Expired"
      case .cancelled: return "Cancelled"
      }
    }
    
    var isActive: Bool {
      switch self {
      case .pending, .quoted: return true
      default: return false
      }
    }
  }
}

struct DealVehicleSnapshot: Codable, Equatable {
  let year: Int
  let make: String
  let model: String
  let trim: String?
  let price: Int
  let mileage: Int
  let condition: String
  let color: String?
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
}

struct CreateDealRequest: Encodable {
  let listingId: String
  let vehicleSnapshot: DealVehicleSnapshot
}
