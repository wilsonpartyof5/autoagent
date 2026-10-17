import Foundation
import Combine

@MainActor
final class SubscriptionStore: ObservableObject {
  // Mock subscription state for development
  // In production: wire to Superwall/RevenueCat
  @Published var hasActiveAgentSubscription: Bool = false
  
  // Agent capacity: $97/mo = 1 agent = up to 10 deals
  static let dealsPerAgent = 10
  static let pricePerMonth = 97
  
  // For dev/testing: toggle subscription state
  func toggleSubscription() {
    hasActiveAgentSubscription.toggle()
  }
  
  // Stub for future onboarding SDK
  func restorePurchases() async {
    // TODO: Wire to RevenueCat/Superwall when ready
  }
  
  func purchase() async -> Bool {
    // TODO: Wire to payment provider
    // For now, just toggle on for testing
    hasActiveAgentSubscription = true
    return true
  }
}
