import Foundation

@MainActor
final class DemoDealerAPI: DealerAPI {
    private var demoLeads = DemoData.leads

    func dealerships() async throws -> [Dealership] {
        await pause()
        return DemoData.dealerships
    }

    func dashboard(dealershipID: String) async throws -> DashboardSnapshot {
        await pause()
        return DemoData.dashboard
    }

    func leads(dealershipID: String) async throws -> [DealerLead] {
        await pause()
        return demoLeads
    }

    func inventory(dealershipID: String) async throws -> [InventoryVehicle] {
        await pause()
        return DemoData.inventory
    }

    func updateLead(_ leadID: String, status: LeadStatus) async throws {
        await pause()
        guard let index = demoLeads.firstIndex(where: { $0.id == leadID }) else { return }
        demoLeads[index].status = status
    }

    func resendLead(_ leadID: String) async throws {
        await pause()
        guard let index = demoLeads.firstIndex(where: { $0.id == leadID }) else { return }
        demoLeads[index].delivery = LeadDelivery(
            method: demoLeads[index].delivery.method,
            state: .pending,
            attemptedAt: .now,
            message: "Queued for XML delivery"
        )
    }

    func registerDeviceToken(_ token: String) async throws {}

    private func pause() async {
        try? await Task.sleep(for: .milliseconds(180))
    }
}

enum DemoData {
    static let dealerships = [
        Dealership(id: "rock-hill", name: "Drevvy Motors Rock Hill", city: "Rock Hill", state: "SC"),
        Dealership(id: "charlotte", name: "Drevvy Motors Charlotte", city: "Charlotte", state: "NC")
    ]

    static let balance = BalanceSummary(
        cashBalanceCents: 16000,
        includedLeadsRemaining: 6,
        leadPriceCents: 2000,
        autoReplenishEnabled: true
    )

    static let dashboard = DashboardSnapshot(
        balance: balance,
        metrics: [
            DashboardMetric(id: "total", title: "Total Leads", value: "128", detail: "+14 this week", symbol: "person.2.fill"),
            DashboardMetric(id: "new", title: "New", value: "7", detail: "Waiting for contact", symbol: "sparkles"),
            DashboardMetric(id: "close", title: "Close Rate", value: "18%", detail: "+3% this month", symbol: "chart.line.uptrend.xyaxis"),
            DashboardMetric(id: "response", title: "Avg. Response", value: "24m", detail: "12m faster", symbol: "clock.fill")
        ],
        trends: (0..<7).map { offset in
            TrendPoint(
                id: "day-\(offset)",
                date: Calendar.current.date(byAdding: .day, value: offset - 6, to: .now) ?? .now,
                leads: [5, 8, 6, 12, 9, 15, 11][offset],
                searches: [34, 42, 38, 55, 48, 64, 59][offset]
            )
        }
    )

    static let leads: [DealerLead] = [
        DealerLead(
            id: "lead-1001",
            createdAt: .now.addingTimeInterval(-420),
            status: .new,
            source: "Drevvy",
            customer: LeadCustomer(name: "Jordan Ellis", email: "jordan@example.com", phone: "(704) 555-0182", preferredTime: "Today after 5 PM"),
            vehicle: LeadVehicle(year: 2025, make: "Honda", model: "CR-V", trim: "EX-L", vin: "2HKRS4H78SH100482"),
            delivery: LeadDelivery(method: "CRM · ADF/XML", state: .delivered, attemptedAt: .now.addingTimeInterval(-390), message: nil)
        ),
        DealerLead(
            id: "lead-1002",
            createdAt: .now.addingTimeInterval(-2_700),
            status: .contacted,
            source: "ChatGPT",
            customer: LeadCustomer(name: "Avery Morgan", email: "avery@example.com", phone: "(803) 555-0149", preferredTime: "Weekday mornings"),
            vehicle: LeadVehicle(year: 2024, make: "Honda", model: "Accord", trim: "Sport Hybrid", vin: "1HGCY2F58RA008241"),
            delivery: LeadDelivery(method: "Email · ADF/XML", state: .delivered, attemptedAt: .now.addingTimeInterval(-2_640), message: nil)
        ),
        DealerLead(
            id: "lead-1003",
            createdAt: .now.addingTimeInterval(-8_400),
            status: .qualified,
            source: "Drevvy",
            customer: LeadCustomer(name: "Taylor Brooks", email: "taylor@example.com", phone: nil, preferredTime: "Saturday"),
            vehicle: LeadVehicle(year: 2025, make: "Honda", model: "Pilot", trim: "Touring", vin: "5FNYG1H71SB014337"),
            delivery: LeadDelivery(method: "CRM · ADF/XML", state: .failed, attemptedAt: .now.addingTimeInterval(-8_300), message: "The CRM did not answer.")
        ),
        DealerLead(
            id: "lead-1004",
            createdAt: .now.addingTimeInterval(-86_400),
            status: .testDriveBooked,
            source: "ChatGPT",
            customer: LeadCustomer(name: "Casey Rivera", email: "casey@example.com", phone: "(980) 555-0116", preferredTime: "Friday at 3 PM"),
            vehicle: LeadVehicle(year: 2024, make: "Honda", model: "Civic", trim: "Touring", vin: "2HGFE1F93RH301901"),
            delivery: LeadDelivery(method: "Email · ADF/XML", state: .delivered, attemptedAt: .now.addingTimeInterval(-86_000), message: nil)
        )
    ]

    static let inventory: [InventoryVehicle] = [
        InventoryVehicle(id: "car-1", year: 2025, make: "Honda", model: "CR-V", trim: "EX-L", priceCents: 3685000, mileage: 12, stockNumber: "H25182", vin: "2HKRS4H78SH100482", imageURL: nil, daysOnMarket: 4),
        InventoryVehicle(id: "car-2", year: 2024, make: "Honda", model: "Accord", trim: "Sport Hybrid", priceCents: 3349000, mileage: 21, stockNumber: "H24811", vin: "1HGCY2F58RA008241", imageURL: nil, daysOnMarket: 16),
        InventoryVehicle(id: "car-3", year: 2025, make: "Honda", model: "Pilot", trim: "Touring", priceCents: 4925000, mileage: 8, stockNumber: "H25204", vin: "5FNYG1H71SB014337", imageURL: nil, daysOnMarket: 2),
        InventoryVehicle(id: "car-4", year: 2024, make: "Honda", model: "Civic", trim: "Touring", priceCents: 3210000, mileage: 150, stockNumber: "H24703", vin: "2HGFE1F93RH301901", imageURL: nil, daysOnMarket: 31),
        InventoryVehicle(id: "car-5", year: 2025, make: "Honda", model: "HR-V", trim: "Sport", priceCents: 2899500, mileage: 6, stockNumber: "H25218", vin: "3CZRZ2H59SM701822", imageURL: nil, daysOnMarket: 1)
    ]
}
