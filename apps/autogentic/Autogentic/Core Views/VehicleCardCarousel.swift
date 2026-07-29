import SwiftUI

struct VehicleCardCarousel: View {
  let vehicles: [Vehicle]
  let selectedVehicleId: String?
  let onTap: (Vehicle) -> Void
  
  init(vehicles: [Vehicle], selectedVehicleId: String? = nil, onTap: @escaping (Vehicle) -> Void) {
    self.vehicles = vehicles
    self.selectedVehicleId = selectedVehicleId
    self.onTap = onTap
  }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal, showsIndicators: false) {
        LazyHStack(spacing: 12) {
          ForEach(vehicles) { v in
            Button {
              onTap(v)
            } label: {
              VehicleCard(vehicle: v, isSelected: selectedVehicleId == v.id)
            }
            .buttonStyle(.plain)
            .id(v.id)
          }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
      }
      .onChange(of: selectedVehicleId) { _, newId in
        if let id = newId {
          withAnimation {
            proxy.scrollTo(id, anchor: .center)
          }
        }
      }
    }
  }
}

private struct VehicleCard: View {
  let vehicle: Vehicle
  let isSelected: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      if let thumbnailUrl = vehicle.thumbnailUrl, let url = URL(string: thumbnailUrl) {
        AsyncImage(url: url) { phase in
          switch phase {
          case .empty:
            placeholderImage
          case .success(let image):
            image
              .resizable()
              .aspectRatio(contentMode: .fill)
              .frame(width: 80, height: 80)
              .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          case .failure:
            placeholderImage
          @unknown default:
            placeholderImage
          }
        }
        .frame(width: 80, height: 80)
      } else {
        placeholderImage
      }
      
      VStack(alignment: .leading, spacing: 6) {
        Text("\(vehicle.year) \(vehicle.make) \(vehicle.model)")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)

        HStack(spacing: 4) {
          Text("$\(vehicle.price)")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.75))
          
          if let distance = vehicle.distanceMiles {
            Text("•")
              .foregroundStyle(Color.white.opacity(0.5))
            Text("\(String(format: "%.1f", distance)) mi")
              .font(.system(size: 13, weight: .medium))
              .foregroundStyle(Color.white.opacity(0.75))
          } else {
            Text("• \(vehicle.mileage) mi")
              .font(.system(size: 13, weight: .medium))
              .foregroundStyle(Color.white.opacity(0.75))
          }
        }

        Text(vehicle.dealerName)
          .font(.system(size: 12))
          .foregroundStyle(Color.white.opacity(0.55))
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(12)
    .frame(width: 220, alignment: .leading)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(isSelected ? Color(white: 0.15) : Color(white: 0.10))
    )
    .overlay(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .stroke(isSelected ? Color.blue.opacity(0.6) : Color.white.opacity(0.06), lineWidth: isSelected ? 2 : 1)
    )
  }
  
  private var placeholderImage: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color(white: 0.15))
      Image(systemName: "car.fill")
        .font(.system(size: 24))
        .foregroundStyle(Color.white.opacity(0.3))
    }
    .frame(width: 80, height: 80)
  }
}

