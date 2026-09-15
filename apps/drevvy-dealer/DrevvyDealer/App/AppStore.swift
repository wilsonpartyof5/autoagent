import Foundation
import Combine

@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var dealerships: [Dealership] = []
    @Published var selectedDealership: Dealership?
    @Published private(set) var dashboard: DashboardSnapshot?
    @Published private(set) var leads: [DealerLead] = []
    @Published private(set) var inventory: [InventoryVehicle] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedLeadID: String?

    private let api: any DealerAPI

    init() {
        self.api = DemoDealerAPI()
    }

    init(api: any DealerAPI) {
        self.api = api
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let stores = try await api.dealerships()
            dealerships = stores
            if selectedDealership == nil {
                selectedDealership = stores.first
            }
            try await refreshSelectedDealership()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func select(_ dealership: Dealership) async {
        guard selectedDealership?.id != dealership.id else { return }
        selectedDealership = dealership
        await refresh()
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            try await refreshSelectedDealership()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateStatus(for leadID: String, to status: LeadStatus) async {
        guard let index = leads.firstIndex(where: { $0.id == leadID }) else { return }
        let oldStatus = leads[index].status
        leads[index].status = status

        do {
            try await api.updateLead(leadID, status: status)
        } catch {
            leads[index].status = oldStatus
            errorMessage = error.localizedDescription
        }
    }

    func resend(_ leadID: String) async {
        guard let index = leads.firstIndex(where: { $0.id == leadID }) else { return }
        let oldDelivery = leads[index].delivery
        leads[index].delivery = LeadDelivery(
            method: oldDelivery.method,
            state: .pending,
            attemptedAt: .now,
            message: "Queued for XML delivery"
        )

        do {
            try await api.resendLead(leadID)
        } catch {
            leads[index].delivery = oldDelivery
            errorMessage = error.localizedDescription
        }
    }

    func lead(id: String) -> DealerLead? {
        leads.first(where: { $0.id == id })
    }

    func registerDeviceToken(_ token: String) async {
        do {
            try await api.registerDeviceToken(token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshSelectedDealership() async throws {
        guard let dealershipID = selectedDealership?.id else { return }
        async let dashboard = api.dashboard(dealershipID: dealershipID)
        async let leads = api.leads(dealershipID: dealershipID)
        async let inventory = api.inventory(dealershipID: dealershipID)
        self.dashboard = try await dashboard
        self.leads = try await leads
        self.inventory = try await inventory
    }
}
