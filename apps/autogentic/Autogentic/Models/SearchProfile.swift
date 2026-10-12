import Foundation

struct SearchFilters: Codable, Equatable {
  var makes: [String]?
  var models: [String]?
  var trims: [String]?
  var yearMin: Int?
  var yearMax: Int?
  var priceMax: Int?
  var milesMax: Int?
  var zip: String?
  var radiusMi: Int?
  var bodyTypes: [String]?
  var fuel: [String]?
  var drivetrain: String?
  var condition: String?
}

struct SavedSearch: Identifiable, Codable, Equatable {
  let id: String
  var filters: SearchFilters
  var lastRunAt: Date
  var runCount: Int
  var seenListingIds: Set<String>
  
  var displayTitle: String {
    var parts: [String] = []
    if let makes = filters.makes, !makes.isEmpty {
      parts.append(makes.joined(separator: ", "))
    }
    if let models = filters.models, !models.isEmpty {
      parts.append(models.joined(separator: ", "))
    }
    if let bodyTypes = filters.bodyTypes, !bodyTypes.isEmpty {
      parts.append(bodyTypes.joined(separator: ", "))
    }
    if let priceMax = filters.priceMax {
      parts.append("under $\(priceMax / 1000)k")
    }
    if let zip = filters.zip {
      let radius = filters.radiusMi ?? 30
      parts.append("\(radius) mi of \(zip)")
    }
    return parts.isEmpty ? "Search" : parts.joined(separator: " · ")
  }
}

struct ViewedListing: Identifiable, Codable, Equatable {
  var id: String { vin }
  let vin: String
  let listingId: String
  let make: String
  let model: String
  let year: Int
  let priceAtView: Int
  let viewedAt: Date
  
  var displayTitle: String {
    "\(year) \(make) \(model)"
  }
}

enum MemoryItemKind: String, Codable, CaseIterable {
  case budget = "Budget"
  case bodyTypes = "Body types"
  case makes = "Makes"
  case fuel = "Fuel"
  case location = "Location"
  case mustHaves = "Must-haves"
}

enum MemoryItemSource: String, Codable {
  case explicit
  case inferred
  case onboarding
}

struct MemoryItem: Identifiable, Codable, Equatable {
  let id: String
  let kind: MemoryItemKind
  var value: String
  let source: MemoryItemSource
  var updatedAt: Date
  var lastUsedAt: Date?
}

struct SearchProfile: Codable {
  let userId: String
  var personalize: Bool
  var items: [MemoryItem]
  var searches: [SavedSearch]
  var viewed: [ViewedListing]
  
  static var empty: SearchProfile {
    SearchProfile(userId: "", personalize: true, items: [], searches: [], viewed: [])
  }
}

enum StarterCardKind: String, Codable {
  case backToSearch
  case priceDrops
  case newListings
  case fairPrice
  case generic
}

struct StarterCard: Identifiable, Codable {
  let id: String
  let kind: StarterCardKind
  let kicker: String
  let title: String
  let action: StarterCardAction
  let count: Int?
  
  enum StarterCardAction: Codable {
    case runSearch(searchId: String)
    case showPriceDrops
    case showNewListings
    case askFairPrice(vin: String, price: Int)
    case askGeneric(prompt: String)
  }
}

struct ChatThread: Identifiable, Codable {
  let id: String
  let userId: String
  var title: String
  var mode: ChatMode
  let createdAt: Date
  var updatedAt: Date
  var lastFilters: SearchFilters?
  var usedMemory: Bool
  
  enum ChatMode: String, Codable {
    case ask
    case shop
  }
}

struct ChatMessage: Identifiable, Codable {
  let id: String
  let chatId: String
  let role: MessageRole
  let text: String
  var memoryItemIds: [String]
  let at: Date
  
  enum MessageRole: String, Codable {
    case user
    case assistant
    case tool
  }
}
