import Foundation

enum Config {
  static let inventoryBaseURL = "https://autoagent-dealer-dashboard.vercel.app/api/inventory/search"
  static let inventoryDetailBaseURL = "https://autoagent-dealer-dashboard.vercel.app/api/inventory/detail"
  static let queryParseBaseURL = "https://autoagent-dealer-dashboard.vercel.app/api/query/parse"
  static let chatSearchBaseURL = "https://autoagent-dealer-dashboard.vercel.app/api/query/chat-search"
  
  static var inventoryApiKey: String? {
    // Try Bundle.main.infoDictionary first (includes generated Info.plist and build settings)
    if let apiKey = Bundle.main.infoDictionary?["INVENTORY_SEARCH_API_KEY"] as? String,
       !apiKey.isEmpty {
      return apiKey
    }
    
    // Try Info.plist file (if custom file exists)
    if let path = Bundle.main.path(forResource: "Info", ofType: "plist"),
       let plist = NSDictionary(contentsOfFile: path),
       let apiKey = plist["INVENTORY_SEARCH_API_KEY"] as? String,
       !apiKey.isEmpty {
      return apiKey
    }
    
    // Fallback: Check environment variable (for development/debugging)
    if let apiKey = ProcessInfo.processInfo.environment["INVENTORY_SEARCH_API_KEY"],
       !apiKey.isEmpty {
      return apiKey
    }
    
    // Set INVENTORY_SEARCH_API_KEY in Info.plist / Xcode build settings / env.
    // Do not hardcode secrets in source control.
    print("⚠️ WARNING: INVENTORY_SEARCH_API_KEY not found in Info.plist, build settings, or environment.")
    return nil
  }
  
  static var hasApiKey: Bool {
    inventoryApiKey != nil
  }
}

