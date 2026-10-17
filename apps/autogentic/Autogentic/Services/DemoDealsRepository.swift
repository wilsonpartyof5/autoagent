import Foundation

// MARK: - Protocol for swapping demo → real backend later

protocol DealsRepositoryProtocol {
  func getAllDeals() async -> [DemoDeal]
  func getDeal(id: String) async -> DemoDeal?
}

// MARK: - Demo Implementation with mock data

final class DemoDealsRepository: DealsRepositoryProtocol {
  static let shared = DemoDealsRepository()
  
  private let mockDeals: [DemoDeal]
  
  private init() {
    self.mockDeals = Self.generateMockDeals()
  }
  
  func getAllDeals() async -> [DemoDeal] {
    mockDeals
  }
  
  func getDeal(id: String) async -> DemoDeal? {
    mockDeals.first { $0.id == id }
  }
  
  // MARK: - Mock Data Generation
  
  private static func generateMockDeals() -> [DemoDeal] {
    let now = Date()
    let calendar = Calendar.current
    
    return [
      // Deal 1: Just started - Reaching out
      DemoDeal(
        id: "deal-001",
        vehicle: DemoVehicle(
          vin: "1FTFW5L50SFB00399",
          year: 2025,
          make: "Ford",
          model: "F-150",
          trim: "Lariat",
          condition: "used",
          listedPrice: 59992,
          bodyType: "Pickup",
          drivetrain: "4wd",
          city: "Rock Hill",
          state: "SC",
          thumbnailUrl: nil
        ),
        status: .reachingOut,
        negotiation: NegotiationProgress(
          dealershipsContacted: 4,
          dealershipsResponded: 0,
          bestOffer: nil,
          initialAsk: 59992,
          agentNextStep: "Waiting for initial responses from 4 dealerships"
        ),
        outreach: OutreachStats(
          totalMessages: 8,
          smsCount: 4,
          emailCount: 4,
          voiceCallCount: 0
        ),
        cadence: CommunicationCadence(
          intervalHours: 24,
          nextTouchAt: calendar.date(byAdding: .hour, value: 18, to: now),
          description: "Initial outreach, follow-up in 24 hours"
        ),
        timeline: [
          ActivityEvent(
            id: "ev-001-1",
            timestamp: calendar.date(byAdding: .hour, value: -6, to: now)!,
            type: .outboundMessage,
            channel: .email,
            summary: "Sent initial inquiry about the 2025 F-150 Lariat, requesting best OTD price for a serious buyer.",
            isInbound: false,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-001-2",
            timestamp: calendar.date(byAdding: .hour, value: -6, to: now)!,
            type: .outboundMessage,
            channel: .sms,
            summary: "Texted asking about availability and willingness to negotiate on price.",
            isInbound: false,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-001-3",
            timestamp: calendar.date(byAdding: .hour, value: -5, to: now)!,
            type: .outboundMessage,
            channel: .email,
            summary: "Sent inquiry to second dealership with similar F-150 inventory.",
            isInbound: false,
            dealerLabel: "Dealer B"
          )
        ],
        otdBreakdown: nil,
        priceHistory: [
          PricePoint(id: "pp-001-1", date: calendar.date(byAdding: .hour, value: -6, to: now)!, price: 59992, label: "Listed")
        ],
        createdAt: calendar.date(byAdding: .hour, value: -6, to: now)!,
        lastActivityAt: calendar.date(byAdding: .hour, value: -5, to: now)!
      ),
      
      // Deal 2: Mid-negotiation - Active back and forth
      DemoDeal(
        id: "deal-002",
        vehicle: DemoVehicle(
          vin: "5UX23EM08R9T45128",
          year: 2024,
          make: "BMW",
          model: "X7",
          trim: "40i",
          condition: "used",
          listedPrice: 63289,
          bodyType: "SUV",
          drivetrain: "4wd",
          city: "Rock Hill",
          state: "SC",
          thumbnailUrl: nil
        ),
        status: .negotiating,
        negotiation: NegotiationProgress(
          dealershipsContacted: 3,
          dealershipsResponded: 2,
          bestOffer: 59500,
          initialAsk: 63289,
          agentNextStep: "Pushing back on dealer fees with Dealer B, awaiting Dealer C response"
        ),
        outreach: OutreachStats(
          totalMessages: 24,
          smsCount: 12,
          emailCount: 9,
          voiceCallCount: 3
        ),
        cadence: CommunicationCadence(
          intervalHours: 48,
          nextTouchAt: calendar.date(byAdding: .hour, value: 36, to: now),
          description: "Follow-up every 48 hours, next touch Thu 10am"
        ),
        timeline: [
          ActivityEvent(
            id: "ev-002-1",
            timestamp: calendar.date(byAdding: .day, value: -3, to: now)!,
            type: .outboundMessage,
            channel: .email,
            summary: "Initial inquiry sent requesting best OTD price.",
            isInbound: false,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-002-2",
            timestamp: calendar.date(byAdding: .day, value: -2, to: now)!,
            type: .inboundReply,
            channel: .email,
            summary: "The dealership responded with an initial offer of $62,100 OTD including all fees.",
            isInbound: true,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-002-3",
            timestamp: calendar.date(byAdding: .day, value: -2, to: now)!,
            type: .outboundMessage,
            channel: .sms,
            summary: "Countered at $58,000 OTD, mentioning competing offers.",
            isInbound: false,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-002-4",
            timestamp: calendar.date(byAdding: .day, value: -1, to: now)!,
            type: .inboundReply,
            channel: .sms,
            summary: "The dealership came back at $59,500 OTD, their 'best price' for a quick deal.",
            isInbound: true,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-002-5",
            timestamp: calendar.date(byAdding: .hour, value: -8, to: now)!,
            type: .outboundMessage,
            channel: .voice,
            summary: "Called Dealer B to discuss their X7 inventory and negotiate directly. Left voicemail.",
            isInbound: false,
            dealerLabel: "Dealer B"
          ),
          ActivityEvent(
            id: "ev-002-6",
            timestamp: calendar.date(byAdding: .hour, value: -4, to: now)!,
            type: .agentNote,
            channel: nil,
            summary: "Dealer A's $59,500 is currently the best offer. Waiting on Dealer B callback and Dealer C's response to push lower.",
            isInbound: false,
            dealerLabel: nil
          )
        ],
        otdBreakdown: OTDBreakdown(
          vehiclePrice: 57000,
          dealerFees: 799,
          docFee: 299,
          estimatedTaxes: 1200,
          registration: 202,
          addOnsRemoved: 0,
          totalOTD: 59500
        ),
        priceHistory: [
          PricePoint(id: "pp-002-1", date: calendar.date(byAdding: .day, value: -3, to: now)!, price: 63289, label: "Listed"),
          PricePoint(id: "pp-002-2", date: calendar.date(byAdding: .day, value: -2, to: now)!, price: 62100, label: "First offer"),
          PricePoint(id: "pp-002-3", date: calendar.date(byAdding: .day, value: -1, to: now)!, price: 59500, label: "Current best")
        ],
        createdAt: calendar.date(byAdding: .day, value: -3, to: now)!,
        lastActivityAt: calendar.date(byAdding: .hour, value: -4, to: now)!
      ),
      
      // Deal 3: Offer received - Good deal ready
      DemoDeal(
        id: "deal-003",
        vehicle: DemoVehicle(
          vin: "1GNSKFKD3PR373598",
          year: 2023,
          make: "Chevrolet",
          model: "Suburban",
          trim: "Premier",
          condition: "used",
          listedPrice: 42990,
          bodyType: "SUV",
          drivetrain: "4wd",
          city: "Rock Hill",
          state: "SC",
          thumbnailUrl: nil
        ),
        status: .offerReceived,
        negotiation: NegotiationProgress(
          dealershipsContacted: 5,
          dealershipsResponded: 4,
          bestOffer: 38750,
          initialAsk: 42990,
          agentNextStep: "Review the $38,750 OTD offer — this is $4,240 below asking"
        ),
        outreach: OutreachStats(
          totalMessages: 31,
          smsCount: 14,
          emailCount: 12,
          voiceCallCount: 5
        ),
        cadence: CommunicationCadence(
          intervalHours: 72,
          nextTouchAt: nil,
          description: "Awaiting your decision on current offer"
        ),
        timeline: [
          ActivityEvent(
            id: "ev-003-1",
            timestamp: calendar.date(byAdding: .day, value: -5, to: now)!,
            type: .outboundMessage,
            channel: .email,
            summary: "Contacted 5 dealerships with Suburban Premier inventory.",
            isInbound: false,
            dealerLabel: nil
          ),
          ActivityEvent(
            id: "ev-003-2",
            timestamp: calendar.date(byAdding: .day, value: -4, to: now)!,
            type: .inboundReply,
            channel: .email,
            summary: "First response at $41,500 OTD.",
            isInbound: true,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-003-3",
            timestamp: calendar.date(byAdding: .day, value: -3, to: now)!,
            type: .offerReceived,
            channel: .sms,
            summary: "Dealer C offered $39,800 OTD, lowest so far.",
            isInbound: true,
            dealerLabel: "Dealer C"
          ),
          ActivityEvent(
            id: "ev-003-4",
            timestamp: calendar.date(byAdding: .day, value: -2, to: now)!,
            type: .outboundMessage,
            channel: .voice,
            summary: "Called Dealer D to leverage Dealer C's offer.",
            isInbound: false,
            dealerLabel: "Dealer D"
          ),
          ActivityEvent(
            id: "ev-003-5",
            timestamp: calendar.date(byAdding: .day, value: -1, to: now)!,
            type: .offerReceived,
            channel: .email,
            summary: "Dealer D countered with $38,750 OTD — new best offer!",
            isInbound: true,
            dealerLabel: "Dealer D"
          ),
          ActivityEvent(
            id: "ev-003-6",
            timestamp: calendar.date(byAdding: .hour, value: -2, to: now)!,
            type: .agentNote,
            channel: nil,
            summary: "This is an excellent price — 10% below asking. The dealership has agreed to hold it for 48 hours.",
            isInbound: false,
            dealerLabel: nil
          )
        ],
        otdBreakdown: OTDBreakdown(
          vehiclePrice: 36200,
          dealerFees: 499,
          docFee: 199,
          estimatedTaxes: 1650,
          registration: 202,
          addOnsRemoved: 895,
          totalOTD: 38750
        ),
        priceHistory: [
          PricePoint(id: "pp-003-1", date: calendar.date(byAdding: .day, value: -5, to: now)!, price: 42990, label: "Listed"),
          PricePoint(id: "pp-003-2", date: calendar.date(byAdding: .day, value: -4, to: now)!, price: 41500, label: nil),
          PricePoint(id: "pp-003-3", date: calendar.date(byAdding: .day, value: -3, to: now)!, price: 39800, label: nil),
          PricePoint(id: "pp-003-4", date: calendar.date(byAdding: .day, value: -1, to: now)!, price: 38750, label: "Best offer")
        ],
        createdAt: calendar.date(byAdding: .day, value: -5, to: now)!,
        lastActivityAt: calendar.date(byAdding: .hour, value: -2, to: now)!
      ),
      
      // Deal 4: Best price ready - Complete
      DemoDeal(
        id: "deal-004",
        vehicle: DemoVehicle(
          vin: "KMTGE4S13PU005498",
          year: 2023,
          make: "Genesis",
          model: "Electrified G80",
          trim: "Base",
          condition: "used",
          listedPrice: 38169,
          bodyType: "Sedan",
          drivetrain: "4wd",
          city: "Rock Hill",
          state: "SC",
          thumbnailUrl: nil
        ),
        status: .bestPriceReady,
        negotiation: NegotiationProgress(
          dealershipsContacted: 6,
          dealershipsResponded: 5,
          bestOffer: 33500,
          initialAsk: 38169,
          agentNextStep: "Ready to purchase! This is the best price we could negotiate."
        ),
        outreach: OutreachStats(
          totalMessages: 42,
          smsCount: 18,
          emailCount: 16,
          voiceCallCount: 8
        ),
        cadence: CommunicationCadence(
          intervalHours: 0,
          nextTouchAt: nil,
          description: "Negotiation complete — awaiting your decision"
        ),
        timeline: [
          ActivityEvent(
            id: "ev-004-1",
            timestamp: calendar.date(byAdding: .day, value: -7, to: now)!,
            type: .statusChange,
            channel: nil,
            summary: "Started negotiation on Genesis Electrified G80",
            isInbound: false,
            dealerLabel: nil
          ),
          ActivityEvent(
            id: "ev-004-2",
            timestamp: calendar.date(byAdding: .day, value: -5, to: now)!,
            type: .offerReceived,
            channel: .email,
            summary: "First competitive offer at $36,000 OTD from Dealer B.",
            isInbound: true,
            dealerLabel: "Dealer B"
          ),
          ActivityEvent(
            id: "ev-004-3",
            timestamp: calendar.date(byAdding: .day, value: -3, to: now)!,
            type: .outboundMessage,
            channel: .voice,
            summary: "Called Dealer E directly to discuss a deal, mentioned federal EV tax credit eligibility.",
            isInbound: false,
            dealerLabel: "Dealer E"
          ),
          ActivityEvent(
            id: "ev-004-4",
            timestamp: calendar.date(byAdding: .day, value: -2, to: now)!,
            type: .offerReceived,
            channel: .sms,
            summary: "Dealer E offered $33,500 OTD — best price achieved!",
            isInbound: true,
            dealerLabel: "Dealer E"
          ),
          ActivityEvent(
            id: "ev-004-5",
            timestamp: calendar.date(byAdding: .hour, value: -12, to: now)!,
            type: .agentNote,
            channel: nil,
            summary: "Locked in $33,500 OTD — 12% below asking. This includes waived dealer fees. The dealership is holding for 72 hours.",
            isInbound: false,
            dealerLabel: nil
          )
        ],
        otdBreakdown: OTDBreakdown(
          vehiclePrice: 31000,
          dealerFees: 0,
          docFee: 199,
          estimatedTaxes: 2100,
          registration: 201,
          addOnsRemoved: 1299,
          totalOTD: 33500
        ),
        priceHistory: [
          PricePoint(id: "pp-004-1", date: calendar.date(byAdding: .day, value: -7, to: now)!, price: 38169, label: "Listed"),
          PricePoint(id: "pp-004-2", date: calendar.date(byAdding: .day, value: -5, to: now)!, price: 36000, label: nil),
          PricePoint(id: "pp-004-3", date: calendar.date(byAdding: .day, value: -3, to: now)!, price: 34200, label: nil),
          PricePoint(id: "pp-004-4", date: calendar.date(byAdding: .day, value: -2, to: now)!, price: 33500, label: "Final")
        ],
        createdAt: calendar.date(byAdding: .day, value: -7, to: now)!,
        lastActivityAt: calendar.date(byAdding: .hour, value: -12, to: now)!
      ),
      
      // Deal 5: Paused
      DemoDeal(
        id: "deal-005",
        vehicle: DemoVehicle(
          vin: "3FTTW8A35RRB31800",
          year: 2024,
          make: "Ford",
          model: "Maverick",
          trim: "XL",
          condition: "used",
          listedPrice: 23955,
          bodyType: "Pickup",
          drivetrain: "fwd",
          city: "Rock Hill",
          state: "SC",
          thumbnailUrl: nil
        ),
        status: .paused,
        negotiation: NegotiationProgress(
          dealershipsContacted: 2,
          dealershipsResponded: 1,
          bestOffer: 22800,
          initialAsk: 23955,
          agentNextStep: "Paused — resume when ready"
        ),
        outreach: OutreachStats(
          totalMessages: 9,
          smsCount: 4,
          emailCount: 5,
          voiceCallCount: 0
        ),
        cadence: CommunicationCadence(
          intervalHours: 0,
          nextTouchAt: nil,
          description: "Paused by you on Oct 3"
        ),
        timeline: [
          ActivityEvent(
            id: "ev-005-1",
            timestamp: calendar.date(byAdding: .day, value: -4, to: now)!,
            type: .outboundMessage,
            channel: .email,
            summary: "Sent initial inquiry about Maverick XL pricing.",
            isInbound: false,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-005-2",
            timestamp: calendar.date(byAdding: .day, value: -3, to: now)!,
            type: .inboundReply,
            channel: .email,
            summary: "The dealership offered $22,800 OTD.",
            isInbound: true,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-005-3",
            timestamp: calendar.date(byAdding: .day, value: -2, to: now)!,
            type: .statusChange,
            channel: nil,
            summary: "You paused this deal.",
            isInbound: false,
            dealerLabel: nil
          )
        ],
        otdBreakdown: OTDBreakdown(
          vehiclePrice: 21500,
          dealerFees: 399,
          docFee: 199,
          estimatedTaxes: 500,
          registration: 202,
          addOnsRemoved: 0,
          totalOTD: 22800
        ),
        priceHistory: [
          PricePoint(id: "pp-005-1", date: calendar.date(byAdding: .day, value: -4, to: now)!, price: 23955, label: "Listed"),
          PricePoint(id: "pp-005-2", date: calendar.date(byAdding: .day, value: -3, to: now)!, price: 22800, label: "Offer")
        ],
        createdAt: calendar.date(byAdding: .day, value: -4, to: now)!,
        lastActivityAt: calendar.date(byAdding: .day, value: -2, to: now)!
      ),
      
      // Deal 6: Negotiating - Another active one
      DemoDeal(
        id: "deal-006",
        vehicle: DemoVehicle(
          vin: "1FM5K8GC1NGA14367",
          year: 2022,
          make: "Ford",
          model: "Explorer",
          trim: "ST",
          condition: "used",
          listedPrice: 36615,
          bodyType: "SUV",
          drivetrain: "4wd",
          city: "Rock Hill",
          state: "SC",
          thumbnailUrl: nil
        ),
        status: .negotiating,
        negotiation: NegotiationProgress(
          dealershipsContacted: 4,
          dealershipsResponded: 3,
          bestOffer: 34200,
          initialAsk: 36615,
          agentNextStep: "Awaiting callback from Dealer C with their final number"
        ),
        outreach: OutreachStats(
          totalMessages: 18,
          smsCount: 8,
          emailCount: 7,
          voiceCallCount: 3
        ),
        cadence: CommunicationCadence(
          intervalHours: 24,
          nextTouchAt: calendar.date(byAdding: .hour, value: 8, to: now),
          description: "Daily follow-ups, next touch tomorrow 9am"
        ),
        timeline: [
          ActivityEvent(
            id: "ev-006-1",
            timestamp: calendar.date(byAdding: .day, value: -2, to: now)!,
            type: .outboundMessage,
            channel: .email,
            summary: "Reached out to 4 dealers with Explorer ST inventory.",
            isInbound: false,
            dealerLabel: nil
          ),
          ActivityEvent(
            id: "ev-006-2",
            timestamp: calendar.date(byAdding: .day, value: -1, to: now)!,
            type: .inboundReply,
            channel: .sms,
            summary: "Dealer A offered $35,500 OTD.",
            isInbound: true,
            dealerLabel: "Dealer A"
          ),
          ActivityEvent(
            id: "ev-006-3",
            timestamp: calendar.date(byAdding: .hour, value: -6, to: now)!,
            type: .offerReceived,
            channel: .email,
            summary: "Dealer B came in at $34,200 OTD after mentioning competing offers.",
            isInbound: true,
            dealerLabel: "Dealer B"
          ),
          ActivityEvent(
            id: "ev-006-4",
            timestamp: calendar.date(byAdding: .hour, value: -2, to: now)!,
            type: .outboundMessage,
            channel: .voice,
            summary: "Called Dealer C to see if they can beat $34,200.",
            isInbound: false,
            dealerLabel: "Dealer C"
          )
        ],
        otdBreakdown: OTDBreakdown(
          vehiclePrice: 32000,
          dealerFees: 599,
          docFee: 199,
          estimatedTaxes: 1200,
          registration: 202,
          addOnsRemoved: 0,
          totalOTD: 34200
        ),
        priceHistory: [
          PricePoint(id: "pp-006-1", date: calendar.date(byAdding: .day, value: -2, to: now)!, price: 36615, label: "Listed"),
          PricePoint(id: "pp-006-2", date: calendar.date(byAdding: .day, value: -1, to: now)!, price: 35500, label: nil),
          PricePoint(id: "pp-006-3", date: calendar.date(byAdding: .hour, value: -6, to: now)!, price: 34200, label: "Current best")
        ],
        createdAt: calendar.date(byAdding: .day, value: -2, to: now)!,
        lastActivityAt: calendar.date(byAdding: .hour, value: -2, to: now)!
      )
    ]
  }
}

// MARK: - Aggregate Stats

struct DealsStats {
  let activeCount: Int
  let maxSlots: Int
  let totalPotentialSavings: Int
  let offersReceived: Int
  
  static func calculate(from deals: [DemoDeal]) -> DealsStats {
    let active = deals.filter { $0.status != .paused }
    let savings = deals.compactMap { $0.savings }.reduce(0, +)
    let offers = deals.filter { $0.negotiation.bestOffer != nil }.count
    
    return DealsStats(
      activeCount: active.count,
      maxSlots: 10,
      totalPotentialSavings: savings,
      offersReceived: offers
    )
  }
}
