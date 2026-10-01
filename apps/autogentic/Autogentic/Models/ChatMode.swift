import Foundation

enum ChatMode: String, CaseIterable, Identifiable {
    case ask = "Ask"
    case shop = "Shop"
    
    var id: String { rawValue }
    
    var description: String {
        switch self {
        case .ask:
            return "Help me figure out what I want"
        case .shop:
            return "Search inventory for a specific car"
        }
    }
    
    var icon: String {
        switch self {
        case .ask:
            return "questionmark.bubble.fill"
        case .shop:
            return "magnifyingglass"
        }
    }
    
    var placeholder: String {
        switch self {
        case .ask:
            return "What kind of car are you looking for?"
        case .shop:
            return "Search for any vehicle..."
        }
    }
}
