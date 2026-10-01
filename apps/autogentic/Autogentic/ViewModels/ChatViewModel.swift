import Foundation
import Combine
import MapKit
import CoreLocation

@MainActor
final class ChatViewModel: ObservableObject {
  @Published var messages: [Message]
  @Published var isSearching: Bool = false
  
  // Reference to MapViewModel for triggering API fetches
  var mapViewModel: MapViewModel?
  
  // Reference to LocationManager for device GPS
  var locationManager: LocationManager?

  // Continuity context — stored after every successful search and sent with the next query
  private var lastCanonicalFilters: ChatSearchApiFilters?
  private var lastLocation: (latitude: Double, longitude: Double, raw: String?)?

  init(preload: Bool = true) {
    if preload {
      self.messages = []
    } else {
      self.messages = []
    }
  }
  
  func setMapViewModel(_ viewModel: MapViewModel) {
    self.mapViewModel = viewModel
  }
  
  func setLocationManager(_ manager: LocationManager) {
    self.locationManager = manager
    manager.requestPermissionIfNeeded()
  }

  func send(text: String, mode: ChatMode = .shop) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }

    #if DEBUG
    debugLog("CHAT", "userQuery=\"\(trimmed)\" mode=\(mode.rawValue)")
    FunnelLogger.shared.querySubmitted(trimmed)
    #endif

    messages.append(.user(trimmed))

    if mode == .ask {
      handleAskMode(query: trimmed)
    } else {
      handleShopMode(query: trimmed)
    }
  }

  private func handleAskMode(query: String) {
    let lowered = query.lowercased()
    
    // Check if user is ready to transition to Shop mode
    let shopTriggers = ["shop", "search", "find", "show me", "look for", "buy", "purchase", "near me", "nearby"]
    let hasSpecificVehicle = lowered.contains("f-150") || lowered.contains("f150") ||
                             lowered.contains("camry") || lowered.contains("civic") ||
                             lowered.contains("mustang") || lowered.contains("corvette") ||
                             lowered.contains("rav4") || lowered.contains("accord") ||
                             lowered.contains("model") || lowered.contains("tahoe") ||
                             lowered.contains("tacoma") || lowered.contains("highlander")
    
    let isShopIntent = shopTriggers.contains { lowered.contains($0) } && hasSpecificVehicle
    
    if isShopIntent {
      messages.append(.assistant("Sounds like you're ready to search! Switch to **Shop** mode (tap the toggle above) and I'll find real listings nearby."))
    } else {
      let response = generateAskResponse(for: query)
      messages.append(.assistant(response))
    }
  }
  
  private func generateAskResponse(for query: String) -> String {
    let lowered = query.lowercased()
    
    if lowered.contains("suv") || lowered.contains("crossover") {
      return "SUVs and crossovers are great for versatility. Compact options like the RAV4 or CR-V are fuel-efficient and easy to park. Mid-size like the Highlander or Pilot offer more space. Full-size like the Tahoe or Expedition are best for towing and big families.\n\nWhat's your budget range, and do you need third-row seating?"
    }
    
    if lowered.contains("truck") || lowered.contains("pickup") {
      return "Trucks range widely:\n\n• **Light-duty** (Maverick, Santa Cruz) — great for occasional hauling, better fuel economy\n• **Mid-size** (Tacoma, Ranger, Colorado) — balanced capability and daily drivability\n• **Full-size** (F-150, Silverado, RAM 1500) — towing power, work-ready\n• **Heavy-duty** (F-250+, 2500+) — serious towing over 10,000 lbs\n\nWhat will you mainly use it for?"
    }
    
    if lowered.contains("electric") || lowered.contains("ev") || lowered.contains("hybrid") {
      return "Great question! Here's the breakdown:\n\n• **Hybrid** — uses gas + battery, no plugging in needed, best for long trips\n• **Plug-in Hybrid (PHEV)** — 20-50 miles electric, then switches to gas\n• **Full Electric (BEV)** — 200-350+ mile range, requires charging\n\nDo you have home charging available? That's the biggest factor for going full electric."
    }
    
    if lowered.contains("family") || lowered.contains("kids") || lowered.contains("safe") {
      return "For families, safety ratings and space matter most. Top picks:\n\n• **Minivans** (Pacifica, Sienna, Odyssey) — most practical, sliding doors\n• **3-row SUVs** (Highlander, Pilot, Palisade) — popular balance\n• **Large SUVs** (Tahoe, Expedition) — max space + towing\n\nHow many passengers do you typically carry, and what's your budget?"
    }
    
    if lowered.contains("budget") || lowered.contains("cheap") || lowered.contains("affordable") || lowered.contains("under") {
      return "I can definitely help with value options. A few questions:\n\n1. What type — sedan, SUV, truck?\n2. New or used? (Used 1-3 years old often has the best value)\n3. What's your target price range?\n\nWith that info, I can point you to the best bets."
    }
    
    if lowered.contains("luxury") || lowered.contains("premium") {
      return "Luxury vehicles offer refined comfort and tech. The main camps:\n\n• **German** (BMW, Mercedes, Audi) — performance-focused, tech-forward\n• **Japanese** (Lexus, Acura, Genesis) — reliability + value\n• **American** (Lincoln, Cadillac) — comfort-focused, competitive pricing\n\nAre you leaning toward sedan or SUV? And new or certified pre-owned?"
    }
    
    if lowered.contains("sporty") || lowered.contains("fast") || lowered.contains("performance") {
      return "For performance, it depends on your style:\n\n• **Hot hatches** (Golf R, Civic Type R) — practical + fun\n• **Sports sedans** (BMW M, Audi S) — daily-driver comfort + power\n• **Muscle cars** (Mustang, Camaro, Challenger) — V8 thrills, American heritage\n• **Sports cars** (Corvette, Supra, 911) — pure driving focus\n\nIs this a daily driver or a weekend toy? That shapes the best choice."
    }
    
    if lowered.contains("first car") || lowered.contains("new driver") || lowered.contains("teenager") {
      return "For a first car, I'd focus on:\n\n• **Reliability** — Toyota, Honda, Mazda are top picks\n• **Safety** — look for vehicles with good crash ratings and standard safety tech\n• **Insurance costs** — avoid sports cars, they're expensive to insure\n• **Budget** — used Civics, Corollas, and Mazda3s are excellent value\n\nWhat's your budget range?"
    }
    
    if lowered.contains("tow") || lowered.contains("trailer") || lowered.contains("boat") || lowered.contains("rv") {
      return "Towing capacity depends on what you're hauling:\n\n• **Under 3,500 lbs** (small trailer) — most SUVs work\n• **3,500-7,000 lbs** — mid-size trucks or large SUVs\n• **7,000-10,000 lbs** — full-size trucks (F-150, Silverado)\n• **Over 10,000 lbs** — heavy-duty trucks required\n\nWhat are you planning to tow?"
    }
    
    // General/unknown query
    return "Happy to help you figure this out! Tell me more about:\n\n• What you'll mainly use the car for (commuting, family, hauling, fun?)\n• Your budget range\n• Any must-haves (fuel efficiency, space, features?)\n\nOnce I understand your needs, I can point you in the right direction — then you can switch to **Shop** mode to see real listings."
  }

  private func handleShopMode(query: String) {
    // Block unfiltered map-pan fetches while the chat search is in flight
    mapViewModel?.isParsingQuery = true

    messages.append(.assistant("Searching nearby inventory..."))
    messages.append(.tool(.map))

    #if DEBUG
    debugLog("CHAT", "toolMessageAdded")
    #endif

    Task { @MainActor in
      await fetchWithChatSearch(query: query)
    }
  }

  // ---------------------------------------------------------------------------
  // MCP-backed single-call flow
  // ---------------------------------------------------------------------------

  private func fetchWithChatSearch(query: String) async {
    guard let mapVM = mapViewModel else {
      mapViewModel?.isParsingQuery = false
      return
    }

    isSearching = true

    // Priority: device GPS → map center fallback
    let userLocation: CLLocationCoordinate2D?
    if let locMgr = locationManager, locMgr.hasLocationPermission {
      userLocation = await locMgr.getLocationOrNil()
        ?? locMgr.currentLocation
        ?? mapVM.currentRegion.map { CLLocationCoordinate2D(latitude: $0.center.latitude, longitude: $0.center.longitude) }
    } else {
      userLocation = mapVM.currentRegion.map {
        CLLocationCoordinate2D(latitude: $0.center.latitude, longitude: $0.center.longitude)
      }
    }

    #if DEBUG
    FunnelLogger.shared.searchTriggered(source: "chat", filters: nil)
    #endif

    do {
      let result = try await ChatSearchService.chatSearch(
        query: query,
        userLocation: userLocation,
        previousFilters: lastCanonicalFilters,
        previousLocation: lastLocation
      )

      // Convert API vehicles → app Vehicle model
      let vehicles = result.vehicles.map { $0.toVehicle() }

      // Push vehicles into the map VM (updates pins, region, activeFilters)
      let filters = result.canonicalFilters?.toInventoryFilters() ?? result.apiCompatibleFilters?.toInventoryFilters()
      mapVM.setVehiclesFromChatSearch(vehicles: vehicles, location: result.location, filters: filters)

      // Store context for follow-up continuity — prefer canonical (MCP-validated) filters
      lastCanonicalFilters = result.canonicalFilters ?? result.apiCompatibleFilters
      if let loc = result.location {
        lastLocation = (latitude: loc.lat, longitude: loc.lng, raw: loc.raw)
      } else if let center = userLocation {
        lastLocation = (latitude: center.latitude, longitude: center.longitude, raw: nil)
      }

      #if DEBUG
      let locDisplay = result.location.map { loc in
        loc.raw.lowercased().hasPrefix("near ") ? String(loc.raw.dropFirst(5)) : loc.raw
      }
      FunnelLogger.shared.parseCompleted(filters: filters, location: locDisplay, explicitFields: [])
      FunnelLogger.shared.searchCompleted(vehicleCount: vehicles.count)
      FunnelLogger.shared.resultsDisplayed(count: vehicles.count, locationName: locDisplay)
      debugLog("CHAT-SEARCH", "vehicles=\(vehicles.count) total=\(result.pagination.total) msg=\"\(result.assistantMessage.prefix(80))\"")
      if let cf = lastCanonicalFilters {
        debugLog("CHAT-SEARCH", "stored context: bodyType=\(cf.bodyType ?? "nil") make=\(cf.make ?? "nil") color=\(cf.exteriorColor ?? "nil")")
      }
      #endif

      // Replace the placeholder ack with the AI-generated message
      replaceLastAssistantMessage(result.assistantMessage)

      // Mark the chat flow done so the input bar re-enables immediately.
      isSearching = false

      // Hold isParsingQuery a bit longer than the camera animation so that the
      // map-settle event (onMapCameraChange) is still blocked and does not fire
      // a redundant unfiltered pan-fetch right after we've set the correct results.
      try? await Task.sleep(nanoseconds: 600_000_000) // 0.6 s

    } catch ChatSearchServiceError.locationRequired {
      #if DEBUG
      FunnelLogger.shared.searchFailed(reason: "LOCATION_REQUIRED")
      #endif
      replaceLastAssistantMessage("Please mention a city or ZIP code in your search, or enable location services so I know where to look.")
      mapVM.isParsingQuery = false
      isSearching = false
      return

    } catch ChatSearchServiceError.quotaExceeded {
      #if DEBUG
      FunnelLogger.shared.searchFailed(reason: "QUOTA_EXCEEDED — MarketCheck free tier exhausted, upgrade plan")
      debugLog("CHAT-SEARCH", "🚫 QUOTA EXCEEDED — all MCP calls blocked until quota resets")
      #endif
      replaceLastAssistantMessage("Monthly search limit reached. Inventory search is temporarily unavailable.")
      mapVM.isParsingQuery = false
      isSearching = false
      return

    } catch ChatSearchServiceError.rateLimited {
      #if DEBUG
      FunnelLogger.shared.searchFailed(reason: "RATE_LIMITED — too many requests, back off")
      #endif
      replaceLastAssistantMessage("Too many requests right now. Please wait a moment and try again.")
      mapVM.isParsingQuery = false
      isSearching = false
      return

    } catch {
      #if DEBUG
      debugLog("CHAT-SEARCH", "error: \(error.localizedDescription) — falling back to legacy parse+search")
      FunnelLogger.shared.searchFailed(reason: error.localizedDescription)
      #endif
      // Network / decode failures: fall back to the old parse+search path
      await fetchWithLegacyFlow(query: query)
      return
    }

    // isSearching was already cleared in the success branch above;
    // this covers the case where the catch blocks fell through without returning.
    isSearching = false
    mapVM.isParsingQuery = false
  }

  /// Replace the last assistant message in the thread (used to swap the
  /// "Searching nearby inventory..." placeholder with the real AI reply).
  private func replaceLastAssistantMessage(_ newText: String) {
    if let idx = messages.indices.last(where: { messages[$0].role == .assistant }) {
      messages[idx] = .assistant(newText)
    } else {
      messages.append(.assistant(newText))
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy parse + inventory-search fallback (used when chat-search fails)
  // ---------------------------------------------------------------------------

  private func fetchWithLegacyFlow(query: String) async {
    guard let mapVM = mapViewModel else {
      mapViewModel?.isParsingQuery = false
      isSearching = false
      return
    }

    var filters: InventorySearchRequest.InventoryFilters?
    var targetRegion: MKCoordinateRegion? = mapVM.currentRegion
    var locationName: String?

    if Config.hasApiKey {
      do {
        let parseResponse = try await QueryParseService.parseQueryFull(query)
        filters = parseResponse.apiCompatibleFilters.toInventoryFilters()

        if let location = parseResponse.location {
          mapVM.updateRegionToLocation(latitude: location.lat, longitude: location.lng)
          targetRegion = mapVM.currentRegion
          let raw = location.raw
          locationName = raw.lowercased().hasPrefix("near ") ? String(raw.dropFirst(5)) : raw
        }
      } catch {
        mapVM.applyQuery(query)
        targetRegion = mapVM.currentRegion
      }
    } else {
      mapVM.applyQuery(query)
    }

    if let region = targetRegion {
      let completionBefore = mapVM.fetchCompletionCount
      mapVM.fetchInventory(bounds: region, filters: filters)
      var attempts = 0
      while mapVM.fetchCompletionCount == completionBefore && attempts < 80 {
        try? await Task.sleep(nanoseconds: 100_000_000)
        attempts += 1
      }
    }

    let count = mapVM.vehicles.count
    let summary: String
    if count == 0 {
      summary = "No vehicles found matching your criteria. Try adjusting your search."
    } else if let loc = locationName {
      summary = "Found \(count) vehicle\(count == 1 ? "" : "s") near \(loc). Tap the map to explore or scroll the cards below."
    } else {
      summary = "Found \(count) vehicle\(count == 1 ? "" : "s") near you. Tap the map to explore or scroll the cards below."
    }
    replaceLastAssistantMessage(summary)

    isSearching = false
    mapVM.isParsingQuery = false
  }
  
}

