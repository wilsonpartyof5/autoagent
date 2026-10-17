import Foundation

// MARK: - Demo Deal Model (Rich negotiation data for UI development)

struct DemoDeal: Identifiable, Equatable {
  let id: String
  let vehicle: DemoVehicle
  let status: DemoDealStatus
  let negotiation: NegotiationProgress
  let outreach: OutreachStats
  let cadence: CommunicationCadence
  let timeline: [ActivityEvent]
  let otdBreakdown: OTDBreakdown?
  let priceHistory: [PricePoint]
  let createdAt: Date
  let lastActivityAt: Date
  
  var savings: Int? {
    guard let bestOffer = negotiation.bestOffer else { return nil }
    return vehicle.listedPrice - bestOffer
  }
  
  var savingsPercentage: Double? {
    guard let savings = savings else { return nil }
    return Double(savings) / Double(vehicle.listedPrice) * 100
  }
}

struct DemoVehicle: Equatable {
  let vin: String
  let year: Int
  let make: String
  let model: String
  let trim: String?
  let condition: String
  let listedPrice: Int
  let bodyType: String
  let drivetrain: String?
  let city: String
  let state: String
  let thumbnailUrl: String?
  
  var fullTitle: String {
    if let trim = trim, !trim.isEmpty {
      return "\(year) \(make) \(model) \(trim)"
    }
    return "\(year) \(make) \(model)"
  }
  
  var shortTitle: String {
    "\(year) \(make) \(model)"
  }
  
  var location: String {
    "\(city), \(state)"
  }
  
  var formattedPrice: String {
    formatCurrency(listedPrice)
  }
}

enum DemoDealStatus: String, CaseIterable {
  case reachingOut = "reaching_out"
  case negotiating = "negotiating"
  case offerReceived = "offer_received"
  case bestPriceReady = "best_price_ready"
  case paused = "paused"
  
  var displayName: String {
    switch self {
    case .reachingOut: return "Reaching out"
    case .negotiating: return "Negotiating"
    case .offerReceived: return "Offer received"
    case .bestPriceReady: return "Best price ready"
    case .paused: return "Paused"
    }
  }
  
  var color: String {
    switch self {
    case .reachingOut: return "blue"
    case .negotiating: return "orange"
    case .offerReceived: return "purple"
    case .bestPriceReady: return "green"
    case .paused: return "gray"
    }
  }
  
  var icon: String {
    switch self {
    case .reachingOut: return "paperplane.fill"
    case .negotiating: return "message.fill"
    case .offerReceived: return "tag.fill"
    case .bestPriceReady: return "checkmark.circle.fill"
    case .paused: return "pause.circle.fill"
    }
  }
}

struct NegotiationProgress: Equatable {
  let dealershipsContacted: Int
  let dealershipsResponded: Int
  let bestOffer: Int?
  let initialAsk: Int?
  let agentNextStep: String?
}

struct OutreachStats: Equatable {
  let totalMessages: Int
  let smsCount: Int
  let emailCount: Int
  let voiceCallCount: Int
}

struct CommunicationCadence: Equatable {
  let intervalHours: Int
  let nextTouchAt: Date?
  let description: String
}

struct ActivityEvent: Identifiable, Equatable {
  let id: String
  let timestamp: Date
  let type: ActivityType
  let channel: CommunicationChannel?
  let summary: String
  let isInbound: Bool
  let dealerLabel: String?
  
  enum ActivityType: String {
    case outboundMessage = "outbound"
    case inboundReply = "inbound"
    case offerReceived = "offer"
    case statusChange = "status"
    case agentNote = "note"
  }
  
  enum CommunicationChannel: String {
    case sms = "sms"
    case email = "email"
    case voice = "voice"
  }
}

struct OTDBreakdown: Equatable {
  let vehiclePrice: Int
  let dealerFees: Int
  let docFee: Int
  let estimatedTaxes: Int
  let registration: Int
  let addOnsRemoved: Int
  let totalOTD: Int
  
  var feesSaved: Int {
    addOnsRemoved
  }
}

struct PricePoint: Identifiable, Equatable {
  let id: String
  let date: Date
  let price: Int
  let label: String?
}

// MARK: - Helpers

func formatCurrency(_ value: Int) -> String {
  let formatter = NumberFormatter()
  formatter.numberStyle = .currency
  formatter.currencySymbol = "$"
  formatter.maximumFractionDigits = 0
  return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
}

func formatRelativeTime(_ date: Date) -> String {
  let formatter = RelativeDateTimeFormatter()
  formatter.unitsStyle = .abbreviated
  return formatter.localizedString(for: date, relativeTo: Date())
}
