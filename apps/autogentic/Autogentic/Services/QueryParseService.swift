import Foundation

enum QueryParseService {
  /// Parse query and return only the API-compatible filters (legacy method)
  static func parseQuery(_ query: String) async throws -> QueryParseResponse.APIFilters {
    let fullResponse = try await parseQueryFull(query)
    return fullResponse.apiCompatibleFilters
  }
  
  /// Parse query and return full response including location data
  static func parseQueryFull(_ query: String) async throws -> QueryParseResponse.QueryParseData {
    #if DEBUG
    debugLog("PARSE", "request query=\"\(query)\"")
    #endif
    
    guard let apiKey = Config.inventoryApiKey else {
      #if DEBUG
      debugLog("PARSE", "error: missing API key")
      #endif
      throw QueryParseError.missingAPIKey
    }
    
    let request = QueryParseRequest(query: query)
    
    guard let url = URL(string: Config.queryParseBaseURL) else {
      #if DEBUG
      debugLog("PARSE", "error: invalid URL")
      #endif
      throw QueryParseError.invalidURL
    }
    
    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
    
    do {
      urlRequest.httpBody = try JSONEncoder().encode(request)
    } catch {
      #if DEBUG
      debugLog("PARSE", "error: encoding failed - \(error.localizedDescription)")
      #endif
      throw QueryParseError.encodingError(error)
    }
    
    let (data, response) = try await URLSession.shared.data(for: urlRequest)
    
    guard let httpResponse = response as? HTTPURLResponse else {
      #if DEBUG
      debugLog("PARSE", "error: invalid response")
      #endif
      throw QueryParseError.invalidResponse
    }
    
    guard (200...299).contains(httpResponse.statusCode) else {
      // Try to decode error response
      if let errorResponse = try? JSONDecoder().decode(QueryParseResponse.self, from: data),
         let error = errorResponse.error {
        #if DEBUG
        debugLog("PARSE", "error code=\"\(error.code)\" message=\"\(error.message)\"")
        #endif
        throw QueryParseError.apiError(code: error.code, message: error.message)
      }
      #if DEBUG
      debugLog("PARSE", "error: HTTP \(httpResponse.statusCode)")
      #endif
      throw QueryParseError.httpError(statusCode: httpResponse.statusCode, message: "Unknown HTTP error")
    }
    
    do {
      let parseResponse = try JSONDecoder().decode(QueryParseResponse.self, from: data)
      
      guard parseResponse.success, let data = parseResponse.data else {
        if let error = parseResponse.error {
          #if DEBUG
          debugLog("PARSE", "error code=\"\(error.code)\" message=\"\(error.message)\"")
          #endif
          throw QueryParseError.apiError(code: error.code, message: error.message)
        }
        #if DEBUG
        debugLog("PARSE", "error: parse failed")
        #endif
        throw QueryParseError.parseFailed
      }
      
      return data
    } catch let error as QueryParseError {
      throw error
    } catch {
      #if DEBUG
      debugLog("PARSE", "error: decoding failed - \(error.localizedDescription)")
      #endif
      throw QueryParseError.decodingError(error)
    }
  }
}

enum QueryParseError: Error, LocalizedError {
  case missingAPIKey
  case invalidURL
  case encodingError(Error)
  case invalidResponse
  case httpError(statusCode: Int, message: String)
  case decodingError(Error)
  case apiError(code: String, message: String)
  case parseFailed
  
  var errorDescription: String? {
    switch self {
    case .missingAPIKey:
      return "API key not configured"
    case .invalidURL:
      return "Invalid query parse API URL"
    case .encodingError(let error):
      return "Encoding error: \(error.localizedDescription)"
    case .invalidResponse:
      return "Invalid response from server"
    case .httpError(let statusCode, let message):
      return "HTTP error \(statusCode): \(message)"
    case .decodingError(let error):
      return "Decoding error: \(error.localizedDescription)"
    case .apiError(let code, let message):
      return "API error [\(code)]: \(message)"
    case .parseFailed:
      return "Query parsing failed"
    }
  }
}

