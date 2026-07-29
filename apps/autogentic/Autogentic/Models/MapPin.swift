import Foundation
import CoreLocation

struct MapPin: Identifiable, Equatable {
  let id: String
  let title: String
  let coordinate: CLLocationCoordinate2D

  init(id: String = UUID().uuidString, title: String, coordinate: CLLocationCoordinate2D) {
    self.id = id
    self.title = title
    self.coordinate = coordinate
  }
  
  static func == (lhs: MapPin, rhs: MapPin) -> Bool {
    lhs.id == rhs.id &&
    lhs.title == rhs.title &&
    lhs.coordinate.latitude == rhs.coordinate.latitude &&
    lhs.coordinate.longitude == rhs.coordinate.longitude
  }
}

