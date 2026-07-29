import SwiftUI
import MapKit

struct ExpandedMapView: View {
  @Environment(\.dismiss) private var dismiss
  @ObservedObject var mapVM: MapViewModel
  var chatVM: ChatViewModel?
  var onDismiss: (() -> Void)? = nil
  @State private var detailVehicle: Vehicle? = nil
  @State private var searchText: String = ""
  @State private var keyboardHeight: CGFloat = 0

  var body: some View {
    ZStack(alignment: .top) {
      // Full-screen map — ignores safe area so it bleeds edge-to-edge
      Map(position: $mapVM.position) {
        ForEach(mapVM.visibleVehicles) { vehicle in
          Annotation(
            "\(vehicle.year) \(vehicle.make) \(vehicle.model)",
            coordinate: CLLocationCoordinate2D(latitude: vehicle.latitude, longitude: vehicle.longitude)
          ) {
            Button {
              mapVM.selectVehicle(vehicle)
              detailVehicle = vehicle
            } label: {
              Text(vehicle.formattedPrice)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(
                  Capsule().fill(
                    mapVM.selectedVehicle?.id == vehicle.id ? Color.blue : Color.black.opacity(0.85)
                  )
                )
            }
            .buttonStyle(.plain)
          }
        }
      }
      .mapStyle(.standard)
      .ignoresSafeArea()
      .onMapCameraChange(frequency: .onEnd) { context in
        if !mapVM.isParsingQuery {
          mapVM.fetchInventory(bounds: context.region)
        }
      }
      .onAppear {
        if let region = mapVM.currentRegion {
          mapVM.updateVisibleVehicles(for: region)
        }
      }

      // Top bar — header label + close button
      HStack {
        HStack(spacing: 4) {
          Text("AutoAgent")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
          Text("•")
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.5))
          Text("Inventory Map")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.7))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Capsule().fill(.ultraThinMaterial))

        Spacer()

        Button {
          onDismiss?()
          dismiss()
        } label: {
          Image(systemName: "xmark")
            .font(.system(size: 15, weight: .bold))
            .frame(width: 36, height: 36)
            .background(Circle().fill(Color.black.opacity(0.65)))
            .overlay(Circle().stroke(Color.white.opacity(0.12), lineWidth: 1))
            .foregroundStyle(.white)
        }
      }
      .padding(.top, 14)
      .padding(.horizontal, 14)
    }
    // safeAreaInset keeps carousel + input bar BELOW map content, never overlapping.
    // SwiftUI / MapKit automatically inset the map's visible region so pins aren't
    // hidden behind the bottom tray.
    .safeAreaInset(edge: .bottom, spacing: 0) {
      bottomTray
    }
    .onReceive(Keyboard.heightPublisher) { height in
      keyboardHeight = height
    }
    .fullScreenCover(item: $detailVehicle) { vehicle in
      VehicleDetailView(vehicle: vehicle, chatVM: chatVM)
    }
  }

  // MARK: - Bottom tray (carousel + input bar)

  @ViewBuilder
  private var bottomTray: some View {
    VStack(spacing: 0) {
      // Vehicle carousel — only shown when results exist
      if !mapVM.visibleVehicles.isEmpty {
        ScrollView(.horizontal, showsIndicators: false) {
          LazyHStack(spacing: 12) {
            ForEach(mapVM.visibleVehicles) { vehicle in
              Button {
                withAnimation(.easeInOut(duration: 0.35)) {
                  mapVM.selectVehicle(vehicle)
                }
              } label: {
                ExpandedVehicleCard(
                  vehicle: vehicle,
                  isSelected: mapVM.selectedVehicle?.id == vehicle.id
                )
              }
              .buttonStyle(.plain)
              .simultaneousGesture(
                TapGesture(count: 2).onEnded { detailVehicle = vehicle }
              )
            }
          }
          .padding(.horizontal, 14)
          .padding(.top, 12)
          .padding(.bottom, 8)
        }
        .frame(height: 208)
        .background(
          LinearGradient(
            colors: [Color.black.opacity(0.0), Color.black.opacity(0.85)],
            startPoint: .top,
            endPoint: .bottom
          )
        )
      }

      // Input bar — always shown
      InputBarView(
        text: $searchText,
        placeholder: "Refine search or try a new one...",
        onSend: {
          let query = searchText
          searchText = ""
          UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil
          )
          if let chatVM {
            chatVM.send(text: query)
          } else {
            dismiss()
          }
        }
      )
      .padding(.horizontal, 12)
      .padding(.top, 8)
      .padding(.bottom, 12)
      .background(Color.black.opacity(0.9))
    }
    // Shift the entire tray up when the keyboard is visible
    .offset(y: keyboardHeight > 0 ? -keyboardHeight : 0)
    .animation(.easeOut(duration: 0.22), value: keyboardHeight)
  }
}

// MARK: - Vehicle card

private struct ExpandedVehicleCard: View {
  let vehicle: Vehicle
  let isSelected: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      // Hero image — no individual clip; the outer clipShape handles corners
      Group {
        if let urlStr = vehicle.thumbnailUrl, let url = URL(string: urlStr) {
          AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
              image
                .resizable()
                .aspectRatio(contentMode: .fill)
            default:
              placeholderImage
            }
          }
        } else {
          placeholderImage
        }
      }
      .frame(width: 260, height: 130)
      .clipped()

      // Info section — no individual clipShape; inherits container corners
      VStack(alignment: .leading, spacing: 4) {
        Text(vehicle.formattedPrice)
          .font(.system(size: 17, weight: .bold))
          .foregroundStyle(.white)

        Text("\(vehicle.year) \(vehicle.make) \(vehicle.model)")
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(Color.white.opacity(0.9))
          .lineLimit(1)

        HStack(spacing: 4) {
          if let distance = vehicle.distanceMiles {
            Text(String(format: "%.1f mi", distance))
              .font(.system(size: 12))
              .foregroundStyle(Color.white.opacity(0.6))
            Text("·")
              .foregroundStyle(Color.white.opacity(0.4))
          }
          Text(vehicle.dealerName)
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.6))
            .lineLimit(1)
        }
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
      .frame(width: 260, alignment: .leading)
      .background(Color(white: 0.10))
    }
    .frame(width: 260)
    // Single clip for the whole card — image gets rounded top corners,
    // info section gets rounded bottom corners automatically.
    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .stroke(isSelected ? Color.blue : Color.white.opacity(0.12),
                lineWidth: isSelected ? 2 : 1)
    )
    .shadow(color: Color.black.opacity(0.35), radius: 10, x: 0, y: 4)
    .scaleEffect(isSelected ? 1.03 : 1.0)
    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
  }

  private var placeholderImage: some View {
    ZStack {
      Color(white: 0.15)
      Image(systemName: "car.fill")
        .font(.system(size: 36))
        .foregroundStyle(Color.white.opacity(0.2))
    }
  }
}
