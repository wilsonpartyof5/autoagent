import CoreLocation
import Combine

@MainActor
final class LocationManager: NSObject, ObservableObject {
  
  enum LocationStatus: Equatable {
    case notDetermined
    case denied
    case restricted
    case authorized
  }
  
  enum LocationError: Error, LocalizedError {
    case denied
    case restricted
    case unavailable
    case timeout
    
    var errorDescription: String? {
      switch self {
      case .denied: return "Location access denied. Enable in Settings to search nearby."
      case .restricted: return "Location access restricted on this device."
      case .unavailable: return "Location temporarily unavailable."
      case .timeout: return "Location request timed out."
      }
    }
  }
  
  @Published private(set) var status: LocationStatus = .notDetermined
  @Published private(set) var currentLocation: CLLocationCoordinate2D?
  @Published private(set) var isLocating = false
  
  private let manager = CLLocationManager()
  private var locationContinuation: CheckedContinuation<CLLocationCoordinate2D, Error>?
  
  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyKilometer
    updateStatus()
  }
  
  private func updateStatus() {
    switch manager.authorizationStatus {
    case .notDetermined:
      status = .notDetermined
    case .denied:
      status = .denied
    case .restricted:
      status = .restricted
    case .authorizedWhenInUse, .authorizedAlways:
      status = .authorized
    @unknown default:
      status = .notDetermined
    }
  }
  
  var hasLocationPermission: Bool {
    status == .authorized
  }
  
  var canRequestPermission: Bool {
    status == .notDetermined
  }
  
  func requestPermissionIfNeeded() {
    guard status == .notDetermined else { return }
    manager.requestWhenInUseAuthorization()
  }
  
  func requestLocation() async throws -> CLLocationCoordinate2D {
    switch status {
    case .denied:
      throw LocationError.denied
    case .restricted:
      throw LocationError.restricted
    case .notDetermined:
      manager.requestWhenInUseAuthorization()
      try await Task.sleep(nanoseconds: 500_000_000)
      if status != .authorized {
        throw LocationError.denied
      }
    case .authorized:
      break
    }
    
    isLocating = true
    defer { isLocating = false }
    
    return try await withCheckedThrowingContinuation { continuation in
      locationContinuation = continuation
      manager.requestLocation()
      
      Task {
        try? await Task.sleep(nanoseconds: 10_000_000_000)
        if let cont = locationContinuation {
          locationContinuation = nil
          cont.resume(throwing: LocationError.timeout)
        }
      }
    }
  }
  
  func getLocationOrNil() async -> CLLocationCoordinate2D? {
    guard status == .authorized else { return currentLocation }
    return try? await requestLocation()
  }
}

extension LocationManager: CLLocationManagerDelegate {
  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    let coordinate = location.coordinate
    
    Task { @MainActor in
      self.currentLocation = coordinate
      if let continuation = self.locationContinuation {
        self.locationContinuation = nil
        continuation.resume(returning: coordinate)
      }
    }
  }
  
  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    Task { @MainActor in
      if let continuation = self.locationContinuation {
        self.locationContinuation = nil
        continuation.resume(throwing: LocationError.unavailable)
      }
    }
  }
  
  nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    Task { @MainActor in
      self.updateStatus()
    }
  }
}
