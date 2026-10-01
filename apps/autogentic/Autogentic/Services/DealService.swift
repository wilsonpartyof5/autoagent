import Foundation

enum DealServiceError: Error, LocalizedError {
  case notAuthenticated
  case unauthorized
  case notFound
  case serverError(String)
  case networkError(String)
  
  var errorDescription: String? {
    switch self {
    case .notAuthenticated:
      return "Please sign in to start a deal."
    case .unauthorized:
      return "Your session has expired. Please sign in again."
    case .notFound:
      return "This deal could not be found."
    case .serverError(let msg):
      return msg
    case .networkError(let msg):
      return msg
    }
  }
}

enum DealService {
  
  private static var baseURL: URL {
    Config.consumerAuthBaseURL.appending(path: "deals")
  }
  
  // MARK: - Create Deal
  
  static func createDeal(
    listingId: String,
    vehicle: Vehicle,
    accessToken: String
  ) async throws -> Deal {
    let snapshot = CreateVehicleSnapshot(
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      price: vehicle.price,
      trim: vehicle.trim,
      msrp: vehicle.msrp,
      miles: vehicle.mileage,
      condition: vehicle.condition,
      vin: vehicle.vin,
      bodyType: vehicle.bodyType,
      city: vehicle.dealerCity,
      state: vehicle.dealerState,
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      daysOnMarket: nil,
      thumbnailUrl: vehicle.thumbnailUrl
    )
    
    let requestBody = CreateDealRequest(listingId: listingId, vehicle: snapshot)
    
    var request = URLRequest(url: baseURL)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(requestBody)
    
    let (data, response) = try await URLSession.shared.data(for: request)
    return try handleResponse(data: data, response: response)
  }
  
  // MARK: - List Deals
  
  static func listDeals(accessToken: String) async throws -> [Deal] {
    var request = URLRequest(url: baseURL)
    request.httpMethod = "GET"
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    
    let (data, response) = try await URLSession.shared.data(for: request)
    return try handleListResponse(data: data, response: response)
  }
  
  // MARK: - Get Deal
  
  static func getDeal(id: String, accessToken: String) async throws -> Deal {
    let url = baseURL.appending(path: id)
    
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    
    let (data, response) = try await URLSession.shared.data(for: request)
    return try handleResponse(data: data, response: response)
  }
  
  // MARK: - Response Handling
  
  private static func handleResponse(data: Data, response: URLResponse) throws -> Deal {
    guard let http = response as? HTTPURLResponse else {
      throw DealServiceError.networkError("Invalid response")
    }
    
    switch http.statusCode {
    case 200..<300:
      let envelope = try JSONDecoder().decode(DealEnvelope.self, from: data)
      return envelope.data
    case 401:
      throw DealServiceError.unauthorized
    case 404:
      throw DealServiceError.notFound
    default:
      let errorMsg = (try? JSONDecoder().decode(ErrorEnvelope.self, from: data))?.error.message
      throw DealServiceError.serverError(errorMsg ?? "Could not complete request.")
    }
  }
  
  private static func handleListResponse(data: Data, response: URLResponse) throws -> [Deal] {
    guard let http = response as? HTTPURLResponse else {
      throw DealServiceError.networkError("Invalid response")
    }
    
    switch http.statusCode {
    case 200..<300:
      let envelope = try JSONDecoder().decode(DealListEnvelope.self, from: data)
      return envelope.data
    case 401:
      throw DealServiceError.unauthorized
    default:
      let errorMsg = (try? JSONDecoder().decode(ErrorEnvelope.self, from: data))?.error.message
      throw DealServiceError.serverError(errorMsg ?? "Could not fetch deals.")
    }
  }
}

// MARK: - Response Envelopes

private struct DealEnvelope: Decodable {
  let success: Bool
  let data: Deal
}

private struct DealListEnvelope: Decodable {
  let success: Bool
  let data: [Deal]
}

private struct ErrorEnvelope: Decodable {
  struct Detail: Decodable { let message: String }
  let error: Detail
}
