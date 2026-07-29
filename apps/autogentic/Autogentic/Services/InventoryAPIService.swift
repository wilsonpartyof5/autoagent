import Foundation
import MapKit
import CoreLocation

enum InventoryAPIService {
  static func searchInventory(
    bounds: MKCoordinateRegion,
    filters: InventorySearchRequest.InventoryFilters? = nil,
    limit: Int = 8,
    userLocation: CLLocationCoordinate2D? = nil
  ) async throws -> InventorySearchResponse {
    guard let apiKey = Config.inventoryApiKey else {
      #if DEBUG
      debugLog("INV", "error: missing API key")
      #endif
      throw InventoryAPIError.missingAPIKey
    }
    
    let request = InventorySearchRequest(
      bounds: InventorySearchRequest.MapBounds(from: bounds),
      filters: filters,
      pagination: InventorySearchRequest.Pagination(page: 1, limit: limit),
      userLocation: userLocation.map { InventorySearchRequest.UserLocation(latitude: $0.latitude, longitude: $0.longitude) }
    )
    
    guard let url = URL(string: Config.inventoryBaseURL) else {
      #if DEBUG
      debugLog("INV", "error: invalid URL")
      #endif
      throw InventoryAPIError.invalidURL
    }
    
    #if DEBUG
    debugLog("INV", "request url=\(url.absoluteString)")
    #endif
    
    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
    
    do {
      urlRequest.httpBody = try JSONEncoder().encode(request)
    } catch {
      #if DEBUG
      debugLog("INV", "error: encoding failed - \(error.localizedDescription)")
      #endif
      throw InventoryAPIError.encodingError(error)
    }
    
    let (data, response) = try await URLSession.shared.data(for: urlRequest)
    
    guard let httpResponse = response as? HTTPURLResponse else {
      #if DEBUG
      debugLog("INV", "error: invalid response")
      #endif
      throw InventoryAPIError.invalidResponse
    }
    
    #if DEBUG
    debugLog("INV", "response status=\(httpResponse.statusCode)")
    #endif
    
    guard (200...299).contains(httpResponse.statusCode) else {
      #if DEBUG
      debugLog("INV", "error: HTTP \(httpResponse.statusCode)")
      #endif
      throw InventoryAPIError.httpError(statusCode: httpResponse.statusCode)
    }
    
    do {
      let searchResponse = try JSONDecoder().decode(InventorySearchResponse.self, from: data)
      
      #if DEBUG
      if let data = searchResponse.data {
        debugLog("INV", "response vehicles count=\(data.vehicles.count)")
        if let firstVehicle = data.vehicles.first {
          let photoInfo = firstVehicle.thumbnailUrl != nil ? "thumbnail=present" : (firstVehicle.photoUrls?.isEmpty == false ? "photoUrls=\(firstVehicle.photoUrls!.count)" : "photos=none")
          debugLog("INV", "sample vehicle id=\(firstVehicle.id) make=\(firstVehicle.make) model=\(firstVehicle.model) \(photoInfo)")
        }
      }
      #endif
      
      return searchResponse
    } catch {
      #if DEBUG
      debugLog("INV", "error: decoding failed - \(error.localizedDescription)")
      #endif
      throw InventoryAPIError.decodingError(error)
    }
  }
}

enum InventoryAPIError: Error, LocalizedError {
  case missingAPIKey
  case invalidURL
  case encodingError(Error)
  case invalidResponse
  case httpError(statusCode: Int)
  case decodingError(Error)
  
  var errorDescription: String? {
    switch self {
    case .missingAPIKey:
      return "API key not configured"
    case .invalidURL:
      return "Invalid API URL"
    case .encodingError(let error):
      return "Encoding error: \(error.localizedDescription)"
    case .invalidResponse:
      return "Invalid response from server"
    case .httpError(let statusCode):
      return "HTTP error: \(statusCode)"
    case .decodingError(let error):
      return "Decoding error: \(error.localizedDescription)"
    }
  }
}

