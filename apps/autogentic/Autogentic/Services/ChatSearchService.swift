import Foundation
import CoreLocation

// Codable request body for POST /api/query/chat-search
private struct ChatSearchRequestBody: Codable {
  let query: String
  let userLocation: UserLocationPayload?
  let previousFilters: ChatSearchApiFilters?
  let previousLocation: PreviousLocationPayload?

  struct UserLocationPayload: Codable {
    let latitude: Double
    let longitude: Double
  }

  struct PreviousLocationPayload: Codable {
    let latitude: Double
    let longitude: Double
    let raw: String?
  }
}

enum ChatSearchService {
  /// Submit a natural-language query and receive AI-grounded search results
  /// plus an assistant message in a single roundtrip.
  ///
  /// - Parameters:
  ///   - query:           The user's natural-language query.
  ///   - userLocation:    Device GPS / map-center fallback.
  ///   - previousFilters: Canonical filters from the last successful search (enables follow-up refinement).
  ///   - previousLocation: Location from the last successful search.
  static func chatSearch(
    query: String,
    userLocation: CLLocationCoordinate2D?,
    previousFilters: ChatSearchApiFilters? = nil,
    previousLocation: (latitude: Double, longitude: Double, raw: String?)? = nil
  ) async throws -> ChatSearchData {
    guard let apiKey = Config.inventoryApiKey else {
      throw ChatSearchServiceError.missingAPIKey
    }

    guard let url = URL(string: Config.chatSearchBaseURL) else {
      throw ChatSearchServiceError.invalidURL
    }

    let prevLocPayload = previousLocation.map {
      ChatSearchRequestBody.PreviousLocationPayload(latitude: $0.latitude, longitude: $0.longitude, raw: $0.raw)
    }

    let payload = ChatSearchRequestBody(
      query: query,
      userLocation: userLocation.map { .init(latitude: $0.latitude, longitude: $0.longitude) },
      previousFilters: previousFilters,
      previousLocation: prevLocPayload
    )

    var urlRequest = URLRequest(url: url, timeoutInterval: 25)
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
    urlRequest.httpBody = try JSONEncoder().encode(payload)

    let (data, response) = try await URLSession.shared.data(for: urlRequest)

    guard let http = response as? HTTPURLResponse else {
      throw ChatSearchServiceError.invalidResponse
    }

    #if DEBUG
    debugLog("CHAT-SEARCH", "status=\(http.statusCode) bodyBytes=\(data.count)")
    #endif

    if http.statusCode == 503 {
      throw ChatSearchServiceError.quotaExceeded
    }

    if http.statusCode == 429 {
      throw ChatSearchServiceError.rateLimited
    }

    if http.statusCode == 400 {
      // Try to decode the error for better messaging
      if let decoded = try? JSONDecoder().decode(ChatSearchResponse.self, from: data),
         let err = decoded.error {
        if err.code == "LOCATION_REQUIRED" {
          throw ChatSearchServiceError.locationRequired
        }
        throw ChatSearchServiceError.apiError(code: err.code, message: err.message)
      }
      throw ChatSearchServiceError.apiError(code: "BAD_REQUEST", message: "Bad request")
    }

    guard (200...299).contains(http.statusCode) else {
      throw ChatSearchServiceError.httpError(statusCode: http.statusCode)
    }

    let decoded: ChatSearchResponse
    do {
      decoded = try JSONDecoder().decode(ChatSearchResponse.self, from: data)
    } catch {
      #if DEBUG
      let body = String(data: data, encoding: .utf8) ?? "(non-UTF8)"
      debugLog("CHAT-SEARCH", "decode error: \(error) body=\(body.prefix(300))")
      #endif
      throw ChatSearchServiceError.decodingError(error)
    }

    guard decoded.success, let chatData = decoded.data else {
      let code = decoded.error?.code ?? "UNKNOWN"
      if code == "MARKETCHECK_QUOTA_EXCEEDED" { throw ChatSearchServiceError.quotaExceeded }
      if code == "LOCATION_REQUIRED" { throw ChatSearchServiceError.locationRequired }
      throw ChatSearchServiceError.apiError(code: code, message: decoded.error?.message ?? "Unknown error")
    }

    return chatData
  }
}

enum ChatSearchServiceError: Error, LocalizedError {
  case missingAPIKey
  case invalidURL
  case invalidResponse
  case quotaExceeded
  case rateLimited
  case locationRequired
  case httpError(statusCode: Int)
  case apiError(code: String, message: String)
  case decodingError(Error)

  var errorDescription: String? {
    switch self {
    case .missingAPIKey:        return "API key not configured."
    case .invalidURL:           return "Invalid chat search URL."
    case .invalidResponse:      return "Invalid response from server."
    case .quotaExceeded:        return "Monthly search limit reached. Please try again next month."
    case .rateLimited:          return "Too many requests. Please wait a moment and try again."
    case .locationRequired:     return "Please mention a city or ZIP code, or enable location services."
    case .httpError(let code):  return "HTTP error \(code)."
    case .apiError(_, let msg): return msg
    case .decodingError(let e): return "Response decode error: \(e.localizedDescription)"
    }
  }
}
