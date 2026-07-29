import Foundation

enum VehicleDetailError: Error, LocalizedError {
  case missingApiKey
  case quotaExceeded
  case notFound
  case networkError(String)

  var errorDescription: String? {
    switch self {
    case .missingApiKey:
      return "API key not configured."
    case .quotaExceeded:
      return "Monthly search limit reached. Please try again next month."
    case .notFound:
      return "This vehicle is no longer available."
    case .networkError(let msg):
      return msg
    }
  }
}

enum VehicleDetailService {
  static func fetchDetail(listingId: String, dealerId: String? = nil) async throws -> VehicleDetailData {
    guard let apiKey = Config.inventoryApiKey else {
      throw VehicleDetailError.missingApiKey
    }

    var urlString = "\(Config.inventoryDetailBaseURL)/\(listingId)"
    if let dealerId, !dealerId.isEmpty {
      urlString += "?dealerId=\(dealerId)"
    }

    guard let url = URL(string: urlString) else {
      throw VehicleDetailError.networkError("Invalid detail URL")
    }

    var request = URLRequest(url: url, timeoutInterval: 12)
    request.httpMethod = "GET"
    request.setValue(apiKey, forHTTPHeaderField: "x-api-key")

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let http = response as? HTTPURLResponse else {
      throw VehicleDetailError.networkError("Invalid response")
    }

    if http.statusCode == 404 {
      throw VehicleDetailError.notFound
    }

    if http.statusCode == 503 {
      throw VehicleDetailError.quotaExceeded
    }

        let decoded: VehicleDetailResponse
        do {
            decoded = try JSONDecoder().decode(VehicleDetailResponse.self, from: data)
        } catch {
            #if DEBUG
            let body = String(data: data, encoding: .utf8) ?? "(non-UTF8 body)"
            print("⚠️ VehicleDetailService decode error: \(error)")
            print("⚠️ Raw response body: \(body.prefix(500))")
            #endif
            throw error
        }

        if decoded.success, let detail = decoded.data {
            return detail
        }

    let errorCode = decoded.error?.code ?? ""
    if errorCode == "MARKETCHECK_QUOTA_EXCEEDED" {
      throw VehicleDetailError.quotaExceeded
    }
    if errorCode == "LISTING_NOT_FOUND" {
      throw VehicleDetailError.notFound
    }

    throw VehicleDetailError.networkError(decoded.error?.message ?? "Unknown error")
  }
}
