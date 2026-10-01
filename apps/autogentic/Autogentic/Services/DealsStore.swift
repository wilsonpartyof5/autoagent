import Foundation
import Combine

@MainActor
final class DealsStore: ObservableObject {
  @Published private(set) var deals: [Deal] = []
  @Published private(set) var isLoading = false
  @Published private(set) var lastCreatedDeal: Deal?
  @Published var errorMessage: String?
  
  private let authStore: ConsumerAuthStore
  
  init(authStore: ConsumerAuthStore) {
    self.authStore = authStore
  }
  
  var hasDeals: Bool { !deals.isEmpty }
  var activeDeals: [Deal] { deals.filter { $0.status.isActive } }
  
  // MARK: - Create Deal
  
  func createDeal(listingId: String, vehicle: Vehicle) async -> Bool {
    guard let token = authStore.session?.accessToken else {
      errorMessage = "Please sign in to get the best price."
      return false
    }
    
    isLoading = true
    errorMessage = nil
    lastCreatedDeal = nil
    defer { isLoading = false }
    
    do {
      let deal = try await DealService.createDeal(
        listingId: listingId,
        vehicle: vehicle,
        accessToken: token
      )
      lastCreatedDeal = deal
      deals.insert(deal, at: 0)
      return true
    } catch DealServiceError.unauthorized {
      errorMessage = "Your session has expired. Please sign in again."
      return false
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }
  
  // MARK: - Load Deals
  
  func loadDeals() async {
    guard let token = authStore.session?.accessToken else {
      deals = []
      return
    }
    
    isLoading = true
    errorMessage = nil
    defer { isLoading = false }
    
    do {
      deals = try await DealService.listDeals(accessToken: token)
    } catch DealServiceError.unauthorized {
      errorMessage = "Your session has expired. Please sign in again."
      deals = []
    } catch {
      errorMessage = error.localizedDescription
    }
  }
  
  // MARK: - Refresh Deal
  
  func refreshDeal(id: String) async {
    guard let token = authStore.session?.accessToken else { return }
    
    do {
      let updated = try await DealService.getDeal(id: id, accessToken: token)
      if let index = deals.firstIndex(where: { $0.id == id }) {
        deals[index] = updated
      }
    } catch {
      // Silently fail refresh — deal list still valid
    }
  }
  
  func clearLastCreatedDeal() {
    lastCreatedDeal = nil
  }
}
