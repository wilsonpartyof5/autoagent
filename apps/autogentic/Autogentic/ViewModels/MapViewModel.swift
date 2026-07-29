import Foundation
import MapKit
import SwiftUI
import Combine
import CoreLocation

@MainActor
final class MapViewModel: NSObject, ObservableObject {
  @Published var position: MapCameraPosition
  @Published var pins: [MapPin] = []
  @Published var vehicles: [Vehicle] = [] // For Step 1 embedded view
  @Published var allVehicles: [Vehicle] = [] // Master list
  @Published var visibleVehicles: [Vehicle] = [] // Filtered by viewport + query
  @Published var selectedVehicle: Vehicle?
  @Published var isLoading: Bool = false
  @Published var lastError: String?
  @Published var hasNoResults: Bool = false

  private var currentQueryFilter: String = ""
  var currentRegion: MKCoordinateRegion?
  private var fetchTask: Task<Void, Never>?
  private let debounceDelay: TimeInterval = 0.35 // 350ms debounce
  var isParsingQuery: Bool = false // Flag to prevent automatic fetches during query parsing
  /// Filters from the last explicit user search — preserved across map pans
  private var activeFilters: InventorySearchRequest.InventoryFilters? = nil
  /// Incremented each time a fetch fully completes (not cancelled). Used by ChatViewModel
  /// to wait for a real result rather than exiting on a mid-flight cancellation.
  @Published var fetchCompletionCount: Int = 0

  private let locationManager = CLLocationManager()
  private var didReceiveInitialLocation = false

  override init() {
    // Start with a neutral US-center view — will zoom to device location once granted
    let usCenter = CLLocationCoordinate2D(latitude: 39.5, longitude: -98.35)
    let initialRegion = MKCoordinateRegion(
      center: usCenter,
      span: MKCoordinateSpan(latitudeDelta: 20.0, longitudeDelta: 40.0)
    )
    self.position = .region(initialRegion)
    self.currentRegion = initialRegion

    super.init()

    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyKilometer

    // Request permission and start updating location
    switch locationManager.authorizationStatus {
    case .notDetermined:
      locationManager.requestWhenInUseAuthorization()
    case .authorizedWhenInUse, .authorizedAlways:
      locationManager.requestLocation()
    default:
      break
    }

    if !Config.hasApiKey {
      loadMockData()
    }
  }
  
  private func loadMockData() {
    // Mock vehicles for fallback
    let allVehiclesList = [
      Vehicle(id: "1", make: "Toyota", model: "Camry", year: 2021, price: 24900, mileage: 32000, latitude: 34.0622, longitude: -118.2437, dealerName: "Dealer A", color: "Black"),
      Vehicle(id: "2", make: "Honda", model: "Civic", year: 2020, price: 21900, mileage: 41000, latitude: 34.0422, longitude: -118.2637, dealerName: "Dealer B", color: "White"),
      Vehicle(id: "3", make: "Ford", model: "F-150", year: 2022, price: 41900, mileage: 18000, latitude: 34.0522, longitude: -118.2237, dealerName: "Dealer C", color: "Red"),
      Vehicle(id: "4", make: "Tesla", model: "Model 3", year: 2023, price: 35900, mileage: 12000, latitude: 34.0722, longitude: -118.2337, dealerName: "Dealer D", color: "Black"),
      Vehicle(id: "5", make: "Subaru", model: "Outback", year: 2019, price: 23900, mileage: 52000, latitude: 34.0322, longitude: -118.2437, dealerName: "Dealer E", color: "Blue"),
      Vehicle(id: "6", make: "BMW", model: "3 Series", year: 2022, price: 38900, mileage: 15000, latitude: 34.0622, longitude: -118.2537, dealerName: "Dealer A", color: "Black"),
      Vehicle(id: "7", make: "Mercedes", model: "C-Class", year: 2021, price: 42900, mileage: 22000, latitude: 34.0422, longitude: -118.2737, dealerName: "Dealer B", color: "White"),
      Vehicle(id: "8", make: "Audi", model: "A4", year: 2023, price: 39900, mileage: 8000, latitude: 34.0522, longitude: -118.2137, dealerName: "Dealer C", color: "Red")
    ]
    
    self.allVehicles = allVehiclesList
    self.vehicles = Array(allVehiclesList.prefix(5))
    updatePinsAndVisibleVehicles()
  }
  
  func fetchInventory(bounds: MKCoordinateRegion, filters: InventorySearchRequest.InventoryFilters? = nil) {
    // Block unfiltered map-pan fetches while a query parse is in flight.
    // Without this guard, the map camera settling on the new location cancels the
    // correctly-filtered chat fetch and replaces results with unfiltered data.
    if isParsingQuery && filters == nil {
      #if DEBUG
      debugLog("MAP", "fetchInventory blocked — chat query parse in progress, refusing to override filtered fetch")
      #endif
      return
    }

    // Persist explicit filters; nil means "keep whatever was last set by a user search"
    if let filters {
      activeFilters = filters.isEmpty ? nil : filters
    }

    // Set loading state IMMEDIATELY (before debounce)
    isLoading = true

    // Cancel previous fetch task
    fetchTask?.cancel()
    
    #if DEBUG
    let north = bounds.center.latitude + bounds.span.latitudeDelta / 2
    let south = bounds.center.latitude - bounds.span.latitudeDelta / 2
    let east = bounds.center.longitude + bounds.span.longitudeDelta / 2
    let west = bounds.center.longitude - bounds.span.longitudeDelta / 2
    let filtersStr = filters != nil ? formatFiltersForLog(filters!) : "null"
    debugLog("MAP", "fetchInventory bounds=(north:\(north),south:\(south),east:\(east),west:\(west)) filters=\(filtersStr)")
    let source = isParsingQuery ? "chat" : "mapPan"
    FunnelLogger.shared.searchTriggered(source: source, filters: filters ?? activeFilters)
    #endif
    
    // Resolve effective filters synchronously before entering the async Task so that
    // a nil-filter map-pan always picks up the activeFilters that were set by the
    // most recent chat search instead of sending a completely unfiltered request.
    let effectiveFilters = filters ?? activeFilters

    // Create new debounced fetch task
    fetchTask = Task {
      // Debounce delay
      try? await Task.sleep(nanoseconds: UInt64(debounceDelay * 1_000_000_000))
      
      // Check if task was cancelled
      guard !Task.isCancelled else {
        await MainActor.run { isLoading = false }
        return
      }
      
      await performFetch(bounds: bounds, filters: effectiveFilters)
    }
  }
  
  private func performFetch(bounds: MKCoordinateRegion, filters: InventorySearchRequest.InventoryFilters?) async {
    guard Config.hasApiKey else {
      // Fallback to mock data if API key not available
      if allVehicles.isEmpty {
        loadMockData()
      } else {
        // Use existing mock data and filter by bounds
        updateVisibleVehicles(for: bounds)
      }
      return
    }
    
    isLoading = true
    lastError = nil
    
    do {
      print("🔵 DEBUG: Fetching inventory with limit=50")
      let response = try await InventoryAPIService.searchInventory(
        bounds: bounds,
        filters: filters,
        limit: 50
      )
      
      guard !Task.isCancelled else { return }
      
      if response.success, let data = response.data {
        // Convert API vehicles to app Vehicle model
        let vehicles = data.vehicles.map { $0.toVehicle() }
        
        #if DEBUG
        debugLog("INV", "response status=200 vehicles count=\(vehicles.count)")
        if let firstVehicle = vehicles.first {
          let photoInfo = firstVehicle.thumbnailUrl != nil ? "thumbnail=present" : "thumbnail=none"
          debugLog("INV", "sample vehicle id=\(firstVehicle.id) make=\(firstVehicle.make) model=\(firstVehicle.model) year=\(firstVehicle.year) price=\(firstVehicle.price) \(photoInfo)")
        }
        FunnelLogger.shared.searchCompleted(vehicleCount: vehicles.count)
        #endif
        
        self.allVehicles = vehicles
        self.vehicles = vehicles // Show all vehicles in embedded view
        self.visibleVehicles = vehicles
        self.currentRegion = bounds
        
        // Check for no results - only show if truly empty
        hasNoResults = vehicles.isEmpty
        
        print("🟢 DEBUG: Loaded \(vehicles.count) vehicles, hasNoResults=\(hasNoResults)")
        if let firstVehicle = vehicles.first {
          let hasThumbnail = firstVehicle.thumbnailUrl != nil ? "YES" : "NO"
          print("🟢 DEBUG: First vehicle has thumbnail: \(hasThumbnail)")
        }
        
        #if DEBUG
        debugLog("UI", "pins updated count=\(vehicles.count)")
        debugLog("UI", "cards updated count=\(self.vehicles.count)")
        debugLog("UI", "noResults=\(hasNoResults)")
        #endif
        
        updatePins()
        fetchCompletionCount += 1
      } else {
        let errorCode = response.error?.code ?? ""
        if errorCode == "MARKETCHECK_QUOTA_EXCEEDED" {
          lastError = "Monthly search limit reached. Inventory search is temporarily unavailable."
          #if DEBUG
          debugLog("INV", "quota exceeded — no fallback to mock data")
          FunnelLogger.shared.searchFailed(reason: "quota_exceeded")
          #endif
        } else if errorCode == "MARKETCHECK_RATE_LIMITED" {
          lastError = "Too many requests. Please wait a moment and try again."
          #if DEBUG
          debugLog("INV", "rate limited")
          FunnelLogger.shared.searchFailed(reason: "rate_limited")
          #endif
        } else {
          lastError = response.error?.message ?? "Unknown error from API"
          #if DEBUG
          debugLog("INV", "response error message=\"\(lastError ?? "Unknown")\"")
          FunnelLogger.shared.searchFailed(reason: errorCode.isEmpty ? "unknown" : errorCode)
          #endif
          // Fallback to mock data on generic errors only
          if allVehicles.isEmpty {
            loadMockData()
          }
        }
      }
    } catch {
      guard !Task.isCancelled else { return }
      
      lastError = error.localizedDescription
      #if DEBUG
      debugLog("INV", "error message=\"\(error.localizedDescription)\"")
      FunnelLogger.shared.searchFailed(reason: error.localizedDescription)
      #endif
      
      // Fallback to mock data on error
      if allVehicles.isEmpty {
        loadMockData()
      }
    }
    
    isLoading = false
  }
  
  func updateVisibleVehicles(for region: MKCoordinateRegion) {
    currentRegion = region
    
    // If API is available and not parsing a query, fetch new data for the region,
    // preserving any active filters from the last explicit user search
    if Config.hasApiKey && !isParsingQuery {
      #if DEBUG
      FunnelLogger.shared.mapPanned()
      #endif
      fetchInventory(bounds: region, filters: activeFilters)
      return
    }
    
    // If parsing is in progress, don't trigger automatic fetches
    if isParsingQuery {
      #if DEBUG
      debugLog("MAP", "skipping automatic fetch - query parsing in progress")
      #endif
      return
    }
    
    // Otherwise, filter existing vehicles by region bounds (mock mode)
    let minLat = region.center.latitude - region.span.latitudeDelta / 2
    let maxLat = region.center.latitude + region.span.latitudeDelta / 2
    let minLon = region.center.longitude - region.span.longitudeDelta / 2
    let maxLon = region.center.longitude + region.span.longitudeDelta / 2
    
    var filtered = allVehicles.filter { vehicle in
      vehicle.latitude >= minLat && vehicle.latitude <= maxLat &&
      vehicle.longitude >= minLon && vehicle.longitude <= maxLon
    }
    
    // Apply query filter if present
    if !currentQueryFilter.isEmpty {
      filtered = applyQueryFilter(to: filtered)
    }
    
    visibleVehicles = filtered
    
    // Check for no results (only show if there's an active query filter)
    hasNoResults = visibleVehicles.isEmpty && !currentQueryFilter.isEmpty
    if hasNoResults {
      print("⚠️ No vehicles match query: \(currentQueryFilter)")
    }
    
    updatePins()
  }
  
  func applyQuery(_ text: String) {
    currentQueryFilter = text.lowercased()
    
    // If we have a current region, re-filter
    if let region = currentRegion {
      updateVisibleVehicles(for: region)
    } else {
      // Otherwise, just apply query to all vehicles
      visibleVehicles = applyQueryFilter(to: allVehicles)
      updatePins()
    }
  }
  
  private func applyQueryFilter(to vehicles: [Vehicle]) -> [Vehicle] {
    guard !currentQueryFilter.isEmpty else { return vehicles }
    
    let query = currentQueryFilter.lowercased()
    
    // Simple keyword matching for color and price
    return vehicles.filter { vehicle in
      // Color filter
      if query.contains("black") && vehicle.color.lowercased() != "black" { return false }
      if query.contains("white") && vehicle.color.lowercased() != "white" { return false }
      if query.contains("red") && vehicle.color.lowercased() != "red" { return false }
      if query.contains("blue") && vehicle.color.lowercased() != "blue" { return false }
      
      // Price filter (simple keyword matching)
      if query.contains("under") || query.contains("below") {
        if let priceMatch = query.range(of: #"\$?(\d+)k?"#, options: .regularExpression) {
          let priceStr = String(query[priceMatch])
          let priceValue = Int(priceStr.replacingOccurrences(of: "$", with: "").replacingOccurrences(of: "k", with: "")) ?? 0
          let maxPrice = priceValue * 1000
          if vehicle.price > maxPrice { return false }
        }
      }
      
      return true
    }
  }
  
  func restoreEmbeddedState(region: MKCoordinateRegion, vehicles: [Vehicle]) {
    position = .region(region)
    currentRegion = region
    self.vehicles = vehicles
    self.visibleVehicles = vehicles
    self.selectedVehicle = nil
    updatePins()
  }

  /// Called by ChatViewModel after a successful chat-search response.
  /// Bypasses the network layer — vehicles come pre-fetched from the server.
  func setVehiclesFromChatSearch(
    vehicles: [Vehicle],
    location: ChatSearchLocation?,
    filters: InventorySearchRequest.InventoryFilters?
  ) {
    if let filters {
      activeFilters = filters.isEmpty ? nil : filters
    }

    self.allVehicles = vehicles
    self.vehicles = vehicles
    self.visibleVehicles = vehicles
    self.hasNoResults = vehicles.isEmpty
    self.lastError = nil
    self.isLoading = false

    if let loc = location {
      updateRegionToLocation(latitude: loc.lat, longitude: loc.lng)
    }

    updatePins()
    fetchCompletionCount += 1

    #if DEBUG
    debugLog("MAP", "setVehiclesFromChatSearch count=\(vehicles.count) hasLocation=\(location != nil)")
    #endif
  }

  func selectVehicle(_ vehicle: Vehicle) {
    selectedVehicle = vehicle
    
    // Center map on selected vehicle
    let newRegion = MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: vehicle.latitude, longitude: vehicle.longitude),
      span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
    )
    position = .region(newRegion)
    currentRegion = newRegion
  }
  
  /// Update map region to a specific location (used when user query includes location)
  func updateRegionToLocation(latitude: Double, longitude: Double) {
    let newRegion = MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
      span: MKCoordinateSpan(latitudeDelta: 0.18, longitudeDelta: 0.18) // Default span
    )
    position = .region(newRegion)
    currentRegion = newRegion
    
    #if DEBUG
    debugLog("MAP", "region set lat=\(latitude) lng=\(longitude) span=(latDelta:\(newRegion.span.latitudeDelta),lngDelta:\(newRegion.span.longitudeDelta))")
    #endif
  }
  
  private func updatePinsAndVisibleVehicles() {
    // For initial load, show all vehicles in the initial region
    if let region = currentRegion {
      updateVisibleVehicles(for: region)
    } else {
      visibleVehicles = allVehicles
      updatePins()
    }
  }
  
  private func updatePins() {
    // Create one pin per visible vehicle
    pins = visibleVehicles.map { vehicle in
      MapPin(
        title: "\(vehicle.year) \(vehicle.make) \(vehicle.model)",
        coordinate: CLLocationCoordinate2D(latitude: vehicle.latitude, longitude: vehicle.longitude)
      )
    }
    
    #if DEBUG
    // Debug: Count unique locations
    let uniqueCoordinates = Set(visibleVehicles.map { "\($0.latitude),\($0.longitude)" })
    debugLog("UI", "pins updated count=\(pins.count) uniqueLocations=\(uniqueCoordinates.count)")
    #endif
  }
  
  #if DEBUG
  private func formatFiltersForLog(_ filters: InventorySearchRequest.InventoryFilters) -> String {
    var parts: [String] = []
    if let minPrice = filters.minPrice { parts.append("\"minPrice\":\(minPrice)") }
    if let maxPrice = filters.maxPrice { parts.append("\"maxPrice\":\(maxPrice)") }
    if let make = filters.make { parts.append("\"make\":\"\(make)\"") }
    if let model = filters.model { parts.append("\"model\":\"\(model)\"") }
    if let year = filters.year { parts.append("\"year\":\(year)") }
    if let minYear = filters.minYear { parts.append("\"minYear\":\(minYear)") }
    if let maxYear = filters.maxYear { parts.append("\"maxYear\":\(maxYear)") }
    if let maxMiles = filters.maxMiles { parts.append("\"maxMiles\":\(maxMiles)") }
    if let condition = filters.condition { parts.append("\"condition\":\"\(condition)\"") }
    if let bodyType = filters.bodyType { parts.append("\"bodyType\":\"\(bodyType)\"") }
    return "{\(parts.joined(separator: ","))}"
  }
  #endif
}

// MARK: - CLLocationManagerDelegate
extension MapViewModel: CLLocationManagerDelegate {
  nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    Task { @MainActor in
      switch manager.authorizationStatus {
      case .authorizedWhenInUse, .authorizedAlways:
        manager.requestLocation()
      default:
        break
      }
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let coordinate = locations.first?.coordinate else { return }
    Task { @MainActor in
      guard !didReceiveInitialLocation else { return }
      didReceiveInitialLocation = true
      let region = MKCoordinateRegion(
        center: coordinate,
        span: MKCoordinateSpan(latitudeDelta: 0.18, longitudeDelta: 0.18)
      )
      withAnimation(.easeInOut(duration: 0.5)) {
        position = .region(region)
      }
      currentRegion = region
      #if DEBUG
      debugLog("MAP", "initial location from device lat=\(coordinate.latitude) lng=\(coordinate.longitude)")
      #endif
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    // Location unavailable — stay on the default US-center view
    #if DEBUG
    Task { @MainActor in debugLog("MAP", "location error: \(error.localizedDescription)") }
    #endif
  }
}
