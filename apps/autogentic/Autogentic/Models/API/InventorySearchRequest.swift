import Foundation
import MapKit

struct InventorySearchRequest: Codable {
  let bounds: MapBounds
  let filters: InventoryFilters?
  let pagination: Pagination
  let userLocation: UserLocation?
  
  struct MapBounds: Codable {
    let north: Double
    let south: Double
    let east: Double
    let west: Double
    
    init(from region: MKCoordinateRegion) {
      let center = region.center
      let span = region.span
      
      north = center.latitude + span.latitudeDelta / 2
      south = center.latitude - span.latitudeDelta / 2
      east = center.longitude + span.longitudeDelta / 2
      west = center.longitude - span.longitudeDelta / 2
    }
  }
  
  struct InventoryFilters: Codable {
    var minPrice: Int?
    var maxPrice: Int?
    var make: String?
    var model: String?
    var year: Int?
    var minYear: Int?
    var maxYear: Int?
    var maxMiles: Int?
    var condition: String?
    var bodyType: String?
    var dealerId: String?
    
    var isEmpty: Bool {
      minPrice == nil && maxPrice == nil && make == nil && model == nil &&
      year == nil && minYear == nil && maxYear == nil && maxMiles == nil &&
      condition == nil && bodyType == nil && dealerId == nil
    }

    init(minPrice: Int? = nil, maxPrice: Int? = nil, make: String? = nil, model: String? = nil, year: Int? = nil, minYear: Int? = nil, maxYear: Int? = nil, maxMiles: Int? = nil, condition: String? = nil, bodyType: String? = nil, dealerId: String? = nil) {
      self.minPrice = minPrice
      self.maxPrice = maxPrice
      self.make = make
      self.model = model
      self.year = year
      self.minYear = minYear
      self.maxYear = maxYear
      self.maxMiles = maxMiles
      self.condition = condition
      self.bodyType = bodyType
      self.dealerId = dealerId
    }
  }
  
  struct Pagination: Codable {
    let page: Int
    let limit: Int
  }
  
  struct UserLocation: Codable {
    let latitude: Double
    let longitude: Double
  }
}

