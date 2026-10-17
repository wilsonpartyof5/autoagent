import Foundation

enum ChatMode: String, CaseIterable, Identifiable {
    case ask = "Ask"
    case shop = "Shop"
    
    var id: String { rawValue }
    
    var description: String {
        switch self {
        case .ask:
            return "Research & guidance"
        case .shop:
            return "Search real inventory"
        }
    }
    
    var icon: String {
        switch self {
        case .ask:
            return "lightbulb.fill"
        case .shop:
            return "magnifyingglass"
        }
    }
    
    var placeholder: String {
        switch self {
        case .ask:
            return "Ask me which car fits your needs..."
        case .shop:
            return "Find 2025 F-150s near me..."
        }
    }
}
