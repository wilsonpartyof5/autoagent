import Foundation

struct Dealership: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let city: String
    let state: String

    var location: String { "\(city), \(state)" }
}

enum LeadStatus: String, Codable, CaseIterable, Identifiable {
    case new
    case contacted
    case qualified
    case testDriveBooked = "test_drive_booked"
    case closed

    var id: String { rawValue }

    var title: String {
        switch self {
        case .new: "New"
        case .contacted: "Contacted"
        case .qualified: "Qualified"
        case .testDriveBooked: "Test Drive"
        case .closed: "Closed"
        }
    }

    var symbol: String {
        switch self {
        case .new: "sparkles"
        case .contacted: "phone.fill"
        case .qualified: "checkmark.seal.fill"
        case .testDriveBooked: "calendar.badge.checkmark"
        case .closed: "flag.checkered"
        }
    }
}

struct LeadCustomer: Codable, Hashable {
    let name: String
    let email: String
    let phone: String?
    let preferredTime: String?
}

struct LeadVehicle: Codable, Hashable {
    let year: Int
    let make: String
    let model: String
    let trim: String?
    let vin: String?

    var title: String {
        [String(year), make, model, trim]
            .compactMap { $0 }
            .joined(separator: " ")
    }
}

enum DeliveryState: String, Codable {
    case pending
    case delivered
    case failed

    var title: String {
        switch self {
        case .pending: "Sending"
        case .delivered: "Delivered"
        case .failed: "Needs attention"
        }
    }
}

struct LeadDelivery: Codable, Hashable {
    let method: String
    let state: DeliveryState
    let attemptedAt: Date?
    let message: String?
}

struct DealerLead: Identifiable, Codable, Hashable {
    let id: String
    let createdAt: Date
    var status: LeadStatus
    let source: String
    let customer: LeadCustomer
    let vehicle: LeadVehicle
    var delivery: LeadDelivery

    var ageText: String {
        createdAt.formatted(.relative(presentation: .named))
    }
}

struct BalanceSummary: Codable, Hashable {
    let cashBalanceCents: Int
    let includedLeadsRemaining: Int
    let leadPriceCents: Int
    let autoReplenishEnabled: Bool

    var cashBalance: Decimal {
        Decimal(cashBalanceCents) / 100
    }

    var paidLeadsAvailable: Int {
        guard leadPriceCents > 0 else { return 0 }
        return cashBalanceCents / leadPriceCents
    }

    var totalLeadsAvailable: Int {
        includedLeadsRemaining + paidLeadsAvailable
    }

    var isLow: Bool {
        totalLeadsAvailable <= 2
    }
}

struct DashboardMetric: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let value: String
    let detail: String
    let symbol: String
}

struct TrendPoint: Identifiable, Codable, Hashable {
    let id: String
    let date: Date
    let leads: Int
    let searches: Int
}

struct DashboardSnapshot: Codable {
    let balance: BalanceSummary
    let metrics: [DashboardMetric]
    let trends: [TrendPoint]
}

struct InventoryVehicle: Identifiable, Codable, Hashable {
    let id: String
    let year: Int
    let make: String
    let model: String
    let trim: String?
    let priceCents: Int?
    let mileage: Int?
    let stockNumber: String?
    let vin: String?
    let imageURL: URL?
    let daysOnMarket: Int?

    var title: String {
        [String(year), make, model, trim]
            .compactMap { $0 }
            .joined(separator: " ")
    }
}
