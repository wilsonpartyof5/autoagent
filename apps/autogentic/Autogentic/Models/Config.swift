import Foundation

enum Config {
  private static let defaultBaseHost = "https://autoagent-dealer-dashboard.vercel.app"
  
  private static var baseHost: String {
    if let override = Bundle.main.infoDictionary?["API_BASE_HOST"] as? String, !override.isEmpty {
      return override
    }
    if let override = ProcessInfo.processInfo.environment["API_BASE_HOST"], !override.isEmpty {
      return override
    }
    return defaultBaseHost
  }
  
  static var inventoryBaseURL: String { "\(baseHost)/api/inventory/search" }
  static var inventoryDetailBaseURL: String { "\(baseHost)/api/inventory/detail" }
  static var queryParseBaseURL: String { "\(baseHost)/api/query/parse" }
  static var chatSearchBaseURL: String { "\(baseHost)/api/query/chat-search" }
  
  // Consumer auth endpoints (PR #43: cursor/drevvy-shopper-siwa-17ff)
  // POST /api/consumer/auth/apple, POST /api/consumer/auth/refresh,
  // POST /api/consumer/auth/signout, GET /api/consumer/profile
  static var consumerAuthBaseURL: URL { URL(string: "\(baseHost)/api/consumer")! }
  
  static var inventoryApiKey: String? {
    // 1. Try Bundle.main.infoDictionary (includes generated Info.plist and build settings)
    if let apiKey = Bundle.main.infoDictionary?["INVENTORY_SEARCH_API_KEY"] as? String,
       !apiKey.isEmpty {
      return apiKey
    }
    
    // 2. Try Info.plist file (if custom file exists)
    if let path = Bundle.main.path(forResource: "Info", ofType: "plist"),
       let plist = NSDictionary(contentsOfFile: path),
       let apiKey = plist["INVENTORY_SEARCH_API_KEY"] as? String,
       !apiKey.isEmpty {
      return apiKey
    }
    
    // 3. Try LocalSecrets.plist (gitignored, for simulator development)
    if let path = Bundle.main.path(forResource: "LocalSecrets", ofType: "plist"),
       let plist = NSDictionary(contentsOfFile: path),
       let apiKey = plist["INVENTORY_SEARCH_API_KEY"] as? String,
       !apiKey.isEmpty {
      return apiKey
    }
    
    // 4. Fallback: Check environment variable (for development/debugging)
    if let apiKey = ProcessInfo.processInfo.environment["INVENTORY_SEARCH_API_KEY"],
       !apiKey.isEmpty {
      return apiKey
    }
    
    // Set INVENTORY_SEARCH_API_KEY in LocalSecrets.plist, Info.plist, Xcode build settings, or env.
    // Do not commit secrets to source control.
    print("⚠️ WARNING: INVENTORY_SEARCH_API_KEY not found. See LocalSecrets.plist.example.")
    return nil
  }
  
  static var hasApiKey: Bool {
    inventoryApiKey != nil
  }
}

