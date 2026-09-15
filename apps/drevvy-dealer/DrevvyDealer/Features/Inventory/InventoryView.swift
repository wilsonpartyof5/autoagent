import SwiftUI

struct InventoryView: View {
    @EnvironmentObject private var store: AppStore
    @State private var searchText = ""

    private var vehicles: [InventoryVehicle] {
        guard !searchText.isEmpty else { return store.inventory }
        return store.inventory.filter {
            $0.title.localizedCaseInsensitiveContains(searchText)
                || ($0.vin?.localizedCaseInsensitiveContains(searchText) ?? false)
                || ($0.stockNumber?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if vehicles.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 14) {
                            HStack {
                                Text("\(vehicles.count) vehicles")
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Label("Read only", systemImage: "eye.fill")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            ForEach(vehicles) { vehicle in
                                VehicleCard(vehicle: vehicle)
                            }
                        }
                        .padding()
                    }
                    .background(DrevvyColor.canvas)
                    .refreshable { await store.refresh() }
                }
            }
            .navigationTitle("Inventory")
            .searchable(text: $searchText, prompt: "Vehicle, stock, or VIN")
        }
    }
}

private struct VehicleCard: View {
    let vehicle: InventoryVehicle

    var body: some View {
        DrevvyCard {
            HStack(alignment: .top, spacing: 14) {
                AsyncImage(url: vehicle.imageURL) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    ZStack {
                        LinearGradient(
                            colors: [DrevvyColor.brand.opacity(0.22), DrevvyColor.cyan.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        Image(systemName: "car.side.fill")
                            .font(.title)
                            .foregroundStyle(DrevvyColor.brand)
                    }
                }
                .frame(width: 104, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 5) {
                    Text(vehicle.title)
                        .font(.headline)
                        .lineLimit(2)
                    if let price = vehicle.priceCents {
                        Text(price.currencyFromCents)
                            .font(.title3.weight(.bold))
                    }
                    HStack(spacing: 8) {
                        if let mileage = vehicle.mileage {
                            Label("\(mileage.formatted()) mi", systemImage: "gauge.with.dots.needle.33percent")
                        }
                        if let days = vehicle.daysOnMarket {
                            Label("\(days)d", systemImage: "calendar")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }

            if vehicle.stockNumber != nil || vehicle.vin != nil {
                Divider().padding(.vertical, 8)
                HStack {
                    if let stock = vehicle.stockNumber {
                        Text("Stock \(stock)")
                    }
                    Spacer()
                    if let vin = vehicle.vin {
                        Text(String(vin.suffix(8)))
                            .monospaced()
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
    }
}

#Preview {
    InventoryView()
        .environmentObject(AppStore())
}
