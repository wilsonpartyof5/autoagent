import SwiftUI
import MapKit

struct MapToolView: View {
  @ObservedObject var mapVM: MapViewModel
  var chatVM: ChatViewModel?
  var onExpand: () -> Void = {}
  @State private var isExpanded: Bool = false
  @State private var savedRegion: MKCoordinateRegion? = nil
  @State private var savedVehicles: [Vehicle] = []
  @State private var selectedVehicleForDetail: Vehicle? = nil

  private func openExpanded() {
    savedRegion = mapVM.currentRegion
    savedVehicles = mapVM.vehicles
    isExpanded = true
    onExpand()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      // Header label (mimicking Zillow branding)
      HStack(spacing: 4) {
        Text("AutoAgent")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white)
        Text("•")
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.5))
        Text("Inventory Map")
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(Color.white.opacity(0.7))
      }
      .padding(.bottom, 4)

      ZStack {
        Map(position: $mapVM.position) {
          ForEach(mapVM.pins) { pin in
            Annotation(pin.title, coordinate: pin.coordinate) {
              if let vehicle = mapVM.vehicles.first(where: { "\($0.year) \($0.make) \($0.model)" == pin.title }) {
                Button {
                  selectedVehicleForDetail = vehicle
                  #if DEBUG
                  FunnelLogger.shared.vehicleTapped(vehicle)
                  #endif
                } label: {
                  Text(vehicle.formattedPrice)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.black.opacity(0.85)))
                }
                .buttonStyle(.plain)
              } else {
                ZStack {
                  Circle()
                    .fill(Color.white)
                    .frame(width: 10, height: 10)
                  Circle()
                    .stroke(Color.black.opacity(0.6), lineWidth: 2)
                    .frame(width: 16, height: 16)
                }
              }
            }
          }
        }
        .mapStyle(.standard)
        .mapControlVisibility(.hidden) // Hide default controls
        .onMapCameraChange(frequency: .onEnd) { context in
          // Only fetch when user stops panning/zooming
          print("🗺️ DEBUG: Map camera stopped, fetching for new region")
          mapVM.fetchInventory(bounds: context.region)
        }
        .onAppear {
          print("🗺️ DEBUG: Map appeared with \(mapVM.pins.count) pins and \(mapVM.vehicles.count) vehicles")
        }
        
        // Top-right expand button
        VStack {
          HStack {
            Spacer()
            Button {
              openExpanded()
            } label: {
              Image(systemName: "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color.black.opacity(0.7)))
            }
            .padding(.top, 8)
            .padding(.trailing, 8)
          }
          Spacer()
        }
        
        // Loading overlay
        if mapVM.isLoading {
          VStack {
            ProgressView()
              .progressViewStyle(CircularProgressViewStyle(tint: .white))
            Text("Searching...")
              .font(.system(size: 14, weight: .medium))
              .foregroundStyle(.white)
              .padding(.top, 8)
          }
          .padding(16)
          .background(
            RoundedRectangle(cornerRadius: 12)
              .fill(Color.black.opacity(0.7))
          )
        }
        
        // No results overlay - only show if we have no vehicles AND fetch is complete
        if mapVM.vehicles.isEmpty && !mapVM.isLoading && mapVM.hasNoResults {
          VStack(spacing: 8) {
            Text("No matches found")
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(.white)
            Text("Try broadening your filters")
              .font(.system(size: 12))
              .foregroundStyle(Color.white.opacity(0.7))
          }
          .padding(12)
          .background(
            RoundedRectangle(cornerRadius: 12)
              .fill(Color.black.opacity(0.7))
          )
          .onAppear {
            print("🔴 DEBUG: Showing 'No results' overlay - vehicles.isEmpty=\(mapVM.vehicles.isEmpty), isLoading=\(mapVM.isLoading), hasNoResults=\(mapVM.hasNoResults)")
          }
        }
      }
      .frame(height: 220)
      .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(Color.white.opacity(0.08), lineWidth: 1)
      )

      VehicleCardCarousel(vehicles: mapVM.vehicles, onTap: { vehicle in
        selectedVehicleForDetail = vehicle
        #if DEBUG
        let pos = mapVM.vehicles.firstIndex(where: { $0.id == vehicle.id }).map { $0 + 1 }
        FunnelLogger.shared.vehicleTapped(vehicle, listPosition: pos)
        #endif
      })
      .frame(height: 120)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(Color(white: 0.07))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(Color.white.opacity(0.06), lineWidth: 1)
      )
      .onAppear {
        print("🎠 DEBUG: Carousel appeared with \(mapVM.vehicles.count) vehicles")
      }
    }
    .padding(12)
    .background(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(Color(white: 0.06))
    )
    .overlay(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
    .fullScreenCover(isPresented: $isExpanded) {
      ExpandedMapView(
        mapVM: mapVM,
        chatVM: chatVM,
        onDismiss: {
          // Callback handled by parent
        }
      )
        .preferredColorScheme(.dark)
    }
    .fullScreenCover(item: $selectedVehicleForDetail) { vehicle in
      VehicleDetailView(vehicle: vehicle, chatVM: chatVM)
    }
    .onChange(of: isExpanded) { _, newValue in
      if !newValue, let region = savedRegion {
        mapVM.restoreEmbeddedState(region: region, vehicles: savedVehicles)
      }
    }
    .onAppear {
      // Trigger initial API fetch when map tool appears (only if not parsing a query)
      if !mapVM.isParsingQuery, let region = mapVM.currentRegion {
        mapVM.fetchInventory(bounds: region)
      }
    }
  }
}

