import Foundation
import CoreLocation

struct Vehicle: Identifiable, Equatable {
  let id: String
  let make: String
  let model: String
  let year: Int
  let price: Int
  let mileage: Int
  let latitude: Double
  let longitude: Double
  let dealerName: String
  let color: String
  let distanceMiles: Double?
  let trim: String?
  let condition: String
  let msrp: Int?
  let thumbnailUrl: String?
  let primaryPhotoUrl: String?
  let photoUrls: [String]?
  let vin: String?
  let bodyType: String?
  let dealerCity: String?
  let dealerState: String?
  
  init(id: String, make: String, model: String, year: Int, price: Int, mileage: Int, latitude: Double, longitude: Double, dealerName: String, color: String, distanceMiles: Double? = nil, trim: String? = nil, condition: String = "used", msrp: Int? = nil, thumbnailUrl: String? = nil, primaryPhotoUrl: String? = nil, photoUrls: [String]? = nil, vin: String? = nil, bodyType: String? = nil, dealerCity: String? = nil, dealerState: String? = nil) {
    self.id = id
    self.make = make
    self.model = model
    self.year = year
    self.price = price
    self.mileage = mileage
    self.latitude = latitude
    self.longitude = longitude
    self.dealerName = dealerName
    self.color = color
    self.distanceMiles = distanceMiles
    self.trim = trim
    self.condition = condition
    self.msrp = msrp
    self.thumbnailUrl = thumbnailUrl
    self.primaryPhotoUrl = primaryPhotoUrl
    self.photoUrls = photoUrls
    self.vin = vin
    self.bodyType = bodyType
    self.dealerCity = dealerCity
    self.dealerState = dealerState
  }
  
  var coordinate: CLLocationCoordinate2D {
    CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
  }
  
  var makeAndModel: String {
    "\(make) \(model)"
  }
  
  var formattedPrice: String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencySymbol = "$"
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: price)) ?? "$\(price)"
  }
  
  var conditionBadge: String {
    switch condition.lowercased() {
    case "new":
      return "New"
    case "certified":
      return "Certified Pre-Owned"
    default:
      return "Used"
    }
  }
  
  var fullTitle: String {
    if let trim = trim, !trim.isEmpty {
      return "\(year) \(make) \(model) \(trim)"
    }
    return "\(year) \(make) \(model)"
  }
  
  var dealerLocation: String {
    if let city = dealerCity, let state = dealerState {
      return "\(dealerName), \(city), \(state)"
    } else if let city = dealerCity {
      return "\(dealerName), \(city)"
    } else if let state = dealerState {
      return "\(dealerName), \(state)"
    }
    return dealerName
  }
}

