import Foundation
import SwiftUI

@MainActor
final class DemoDataStore: ObservableObject {
  static let shared = DemoDataStore()
  
  @AppStorage("demo_firstRun") var isFirstRun: Bool = false
  @Published private(set) var searchProfile: SearchProfile
  @Published private(set) var starterCards: [StarterCard] = []
  @Published private(set) var chatThreads: [ChatThread] = []
  
  let demoUserName = "Dana"
  let demoUserId = "demo-user-dana"
  
  private init() {
    searchProfile = SearchProfile.empty
    loadDemoData()
  }
  
  var hasHistory: Bool {
    !isFirstRun && (!searchProfile.searches.isEmpty || !searchProfile.viewed.isEmpty || !searchProfile.items.isEmpty)
  }
  
  var greeting: String {
    hasHistory ? "Welcome back, \(demoUserName)" : "Hi \(demoUserName), what are you shopping for?"
  }
  
  var subheadline: String {
    hasHistory
      ? "Pick up where you left off, or ask anything."
      : "Ask anything about cars, or switch to Shop to see real listings near you."
  }
  
  func toggleFirstRun() {
    isFirstRun.toggle()
    loadStarterCards()
  }
  
  func setFirstRun(_ value: Bool) {
    isFirstRun = value
    loadStarterCards()
  }
  
  private func loadDemoData() {
    loadDemoSearchProfile()
    loadStarterCards()
    loadDemoChatThreads()
  }
  
  private func loadDemoSearchProfile() {
    let now = Date()
    let dayAgo = now.addingTimeInterval(-86400)
    let weekAgo = now.addingTimeInterval(-7 * 86400)
    
    let memoryItems: [MemoryItem] = [
      MemoryItem(
        id: "mem-1",
        kind: .budget,
        value: "$35,000",
        source: .inferred,
        updatedAt: dayAgo,
        lastUsedAt: now
      ),
      MemoryItem(
        id: "mem-2",
        kind: .bodyTypes,
        value: "SUV, Crossover",
        source: .inferred,
        updatedAt: weekAgo,
        lastUsedAt: dayAgo
      ),
      MemoryItem(
        id: "mem-3",
        kind: .makes,
        value: "Toyota, Honda",
        source: .explicit,
        updatedAt: weekAgo,
        lastUsedAt: now
      ),
      MemoryItem(
        id: "mem-4",
        kind: .fuel,
        value: "Hybrid",
        source: .inferred,
        updatedAt: dayAgo,
        lastUsedAt: now
      ),
      MemoryItem(
        id: "mem-5",
        kind: .location,
        value: "30301 · 30 mi",
        source: .explicit,
        updatedAt: weekAgo,
        lastUsedAt: now
      )
    ]
    
    let savedSearches: [SavedSearch] = [
      SavedSearch(
        id: "search-1",
        filters: SearchFilters(
          makes: ["Toyota"],
          models: ["RAV4"],
          priceMax: 35000,
          zip: "30301",
          radiusMi: 30,
          bodyTypes: ["SUV"],
          fuel: ["Hybrid"]
        ),
        lastRunAt: now.addingTimeInterval(-3600),
        runCount: 5,
        seenListingIds: ["vin-1", "vin-2", "vin-3"]
      ),
      SavedSearch(
        id: "search-2",
        filters: SearchFilters(
          makes: ["Honda"],
          models: ["CR-V"],
          priceMax: 38000,
          zip: "30301",
          radiusMi: 30,
          bodyTypes: ["SUV"],
          fuel: ["Hybrid"]
        ),
        lastRunAt: now.addingTimeInterval(-86400),
        runCount: 3,
        seenListingIds: ["vin-4", "vin-5"]
      )
    ]
    
    let viewedListings: [ViewedListing] = [
      ViewedListing(
        vin: "vin-1",
        listingId: "listing-1",
        make: "Toyota",
        model: "RAV4",
        year: 2024,
        priceAtView: 32995,
        viewedAt: now.addingTimeInterval(-7200)
      ),
      ViewedListing(
        vin: "vin-2",
        listingId: "listing-2",
        make: "Honda",
        model: "CR-V",
        year: 2023,
        priceAtView: 34500,
        viewedAt: now.addingTimeInterval(-86400)
      ),
      ViewedListing(
        vin: "vin-3",
        listingId: "listing-3",
        make: "Toyota",
        model: "Highlander",
        year: 2024,
        priceAtView: 42000,
        viewedAt: now.addingTimeInterval(-172800)
      )
    ]
    
    searchProfile = SearchProfile(
      userId: demoUserId,
      personalize: true,
      items: memoryItems,
      searches: savedSearches,
      viewed: viewedListings
    )
  }
  
  private func loadStarterCards() {
    if isFirstRun {
      starterCards = genericStarterCards
    } else {
      starterCards = personalizedStarterCards
    }
  }
  
  private var personalizedStarterCards: [StarterCard] {
    [
      StarterCard(
        id: "starter-back",
        kind: .backToSearch,
        kicker: "BACK TO YOUR SEARCH",
        title: "RAV4 Hybrid · under $35k · 30 mi of 30301",
        action: .runSearch(searchId: "search-1"),
        count: nil
      ),
      StarterCard(
        id: "starter-drops",
        kind: .priceDrops,
        kicker: "PRICE DROPS",
        title: "3 price drops on cars like ones you viewed",
        action: .showPriceDrops,
        count: 3
      ),
      StarterCard(
        id: "starter-new",
        kind: .newListings,
        kicker: "NEW LISTINGS",
        title: "5 new CR-V Hybrids within 30 mi",
        action: .showNewListings,
        count: 5
      ),
      StarterCard(
        id: "starter-fair",
        kind: .fairPrice,
        kicker: "FAIR PRICE",
        title: "Is $32,995 fair for the RAV4 you viewed?",
        action: .askFairPrice(vin: "vin-1", price: 32995),
        count: nil
      )
    ]
  }
  
  private var genericStarterCards: [StarterCard] {
    [
      StarterCard(
        id: "generic-1",
        kind: .generic,
        kicker: "",
        title: "Which hybrid SUV fits for a family of four?",
        action: .askGeneric(prompt: "Which hybrid SUV fits for a family of four?"),
        count: nil
      ),
      StarterCard(
        id: "generic-2",
        kind: .generic,
        kicker: "",
        title: "Is $33k fair for a 2024 RAV4 Hybrid?",
        action: .askGeneric(prompt: "Is $33k fair for a 2024 RAV4 Hybrid?"),
        count: nil
      ),
      StarterCard(
        id: "generic-3",
        kind: .generic,
        kicker: "",
        title: "Which dealer fees should I never pay?",
        action: .askGeneric(prompt: "Which dealer fees should I never pay?"),
        count: nil
      ),
      StarterCard(
        id: "generic-4",
        kind: .generic,
        kicker: "",
        title: "Find EVs under $35k near me",
        action: .askGeneric(prompt: "Find EVs under $35k near me"),
        count: nil
      )
    ]
  }
  
  private func loadDemoChatThreads() {
    let now = Date()
    chatThreads = [
      ChatThread(
        id: "chat-1",
        userId: demoUserId,
        title: "RAV4 Hybrid under $35k",
        mode: .shop,
        createdAt: now.addingTimeInterval(-3600),
        updatedAt: now.addingTimeInterval(-3600),
        lastFilters: SearchFilters(
          makes: ["Toyota"],
          models: ["RAV4"],
          priceMax: 35000,
          fuel: ["Hybrid"]
        ),
        usedMemory: true
      ),
      ChatThread(
        id: "chat-2",
        userId: demoUserId,
        title: "Best hybrid SUVs for families",
        mode: .ask,
        createdAt: now.addingTimeInterval(-86400),
        updatedAt: now.addingTimeInterval(-86400),
        lastFilters: nil,
        usedMemory: false
      ),
      ChatThread(
        id: "chat-3",
        userId: demoUserId,
        title: "CR-V vs RAV4 comparison",
        mode: .ask,
        createdAt: now.addingTimeInterval(-172800),
        updatedAt: now.addingTimeInterval(-172800),
        lastFilters: nil,
        usedMemory: true
      )
    ]
  }
  
  func memoryItemsUsedInChat(_ chatId: String) -> [MemoryItem] {
    searchProfile.items.filter { item in
      item.kind == .makes || item.kind == .fuel || item.kind == .budget
    }
  }
}
