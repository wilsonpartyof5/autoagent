import Foundation
import Combine
import MapKit

@MainActor
final class ChatViewModel: ObservableObject {
  @Published var messages: [Message]
  @Published var isSearching: Bool = false
  
  // Reference to MapViewModel for triggering API fetches
  var mapViewModel: MapViewModel?

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

  func send(text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }

    #if DEBUG
    debugLog("CHAT", "userQuery=\"\(trimmed)\"")
    FunnelLogger.shared.querySubmitted(trimmed)
    #endif

    // Block unfiltered map-pan fetches while the chat search is in flight
    mapViewModel?.isParsingQuery = true

    messages.append(.user(trimmed))
    messages.append(.assistant("Searching nearby inventory..."))
    messages.append(.tool(.map))

    #if DEBUG
    debugLog("CHAT", "toolMessageAdded")
    #endif

    Task { @MainActor in
      await fetchWithChatSearch(query: trimmed)
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

    // Use map center as device-location fallback for the backend
    let userLocation = mapVM.currentRegion.map {
      CLLocationCoordinate2D(latitude: $0.center.latitude, longitude: $0.center.longitude)
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

