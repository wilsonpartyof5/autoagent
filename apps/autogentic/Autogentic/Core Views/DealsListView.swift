import SwiftUI

struct DealsListView: View {
  @State private var deals: [DemoDeal] = []
  @State private var stats: DealsStats = DealsStats(activeCount: 0, maxSlots: 10, totalPotentialSavings: 0, offersReceived: 0)
  @State private var selectedDeal: DemoDeal?
  
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 0) {
          // Header stats
          statsHeader
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 16)
          
          // Deal cards
          LazyVStack(spacing: 12) {
            ForEach(deals) { deal in
              DealCardView(deal: deal)
                .onTapGesture {
                  selectedDeal = deal
                }
            }
          }
          .padding(.horizontal, 16)
          .padding(.bottom, 24)
        }
      }
      .background(Color.black)
      .navigationTitle("My Deals")
      .navigationBarTitleDisplayMode(.large)
      .toolbarBackground(Color.black, for: .navigationBar)
      .toolbarBackground(.visible, for: .navigationBar)
      .toolbarColorScheme(.dark, for: .navigationBar)
      .sheet(item: $selectedDeal) { deal in
        DealDetailView(deal: deal)
      }
    }
    .task {
      deals = await DemoDealsRepository.shared.getAllDeals()
      stats = DealsStats.calculate(from: deals)
    }
  }
  
  private var statsHeader: some View {
    HStack(spacing: 12) {
      statCard(
        value: "\(stats.activeCount)/\(stats.maxSlots)",
        label: "Active",
        icon: "car.fill",
        color: .blue
      )
      
      statCard(
        value: stats.totalPotentialSavings > 0 ? formatCurrency(stats.totalPotentialSavings) : "—",
        label: "Savings",
        icon: "arrow.down.circle.fill",
        color: .green
      )
      
      statCard(
        value: "\(stats.offersReceived)",
        label: "Offers",
        icon: "tag.fill",
        color: .purple
      )
    }
  }
  
  private func statCard(value: String, label: String, icon: String, color: Color) -> some View {
    VStack(spacing: 6) {
      HStack(spacing: 4) {
        Image(systemName: icon)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(color)
        Text(value)
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(.white)
      }
      Text(label)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.5))
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 12)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.white.opacity(0.06))
    )
  }
}

// MARK: - Deal Card

struct DealCardView: View {
  let deal: DemoDeal
  
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      // Top row: image + vehicle info
      HStack(spacing: 12) {
        // Vehicle image placeholder
        ZStack {
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(
              LinearGradient(
                colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
              )
            )
          Image(systemName: vehicleIcon)
            .font(.system(size: 24))
            .foregroundStyle(Color.white.opacity(0.4))
        }
        .frame(width: 72, height: 72)
        
        VStack(alignment: .leading, spacing: 4) {
          Text(deal.vehicle.fullTitle)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .lineLimit(2)
          
          Text(deal.vehicle.location)
            .font(.system(size: 13))
            .foregroundStyle(Color.white.opacity(0.5))
          
          // Status chip
          HStack(spacing: 4) {
            Image(systemName: deal.status.icon)
              .font(.system(size: 10, weight: .semibold))
            Text(deal.status.displayName)
              .font(.system(size: 11, weight: .semibold))
          }
          .foregroundStyle(statusColor)
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(
            Capsule()
              .fill(statusColor.opacity(0.15))
          )
        }
        
        Spacer()
      }
      
      Divider()
        .background(Color.white.opacity(0.1))
      
      // Price row
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text("Listed")
            .font(.system(size: 11))
            .foregroundStyle(Color.white.opacity(0.5))
          Text(deal.vehicle.formattedPrice)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.7))
        }
        
        if let bestOffer = deal.negotiation.bestOffer {
          Image(systemName: "arrow.right")
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.3))
            .padding(.horizontal, 8)
          
          VStack(alignment: .leading, spacing: 2) {
            Text("Best Offer")
              .font(.system(size: 11))
              .foregroundStyle(Color.green.opacity(0.8))
            Text(formatCurrency(bestOffer))
              .font(.system(size: 14, weight: .bold))
              .foregroundStyle(.green)
          }
          
          Spacer()
          
          if let savings = deal.savings {
            VStack(alignment: .trailing, spacing: 2) {
              Text("Savings")
                .font(.system(size: 11))
                .foregroundStyle(Color.white.opacity(0.5))
              Text("-\(formatCurrency(savings))")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.green)
            }
          }
        } else {
          Spacer()
          
          Text("Awaiting offers")
            .font(.system(size: 13))
            .foregroundStyle(Color.white.opacity(0.4))
            .italic()
        }
      }
      
      // Activity footer
      HStack {
        Image(systemName: "clock")
          .font(.system(size: 11))
        Text(formatRelativeTime(deal.lastActivityAt))
          .font(.system(size: 12))
        
        Spacer()
        
        HStack(spacing: 8) {
          if deal.outreach.smsCount > 0 {
            Label("\(deal.outreach.smsCount)", systemImage: "message.fill")
              .font(.system(size: 11))
          }
          if deal.outreach.emailCount > 0 {
            Label("\(deal.outreach.emailCount)", systemImage: "envelope.fill")
              .font(.system(size: 11))
          }
          if deal.outreach.voiceCallCount > 0 {
            Label("\(deal.outreach.voiceCallCount)", systemImage: "phone.fill")
              .font(.system(size: 11))
          }
        }
      }
      .foregroundStyle(Color.white.opacity(0.4))
    }
    .padding(14)
    .background(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.white.opacity(0.05))
    )
    .overlay(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
  
  private var statusColor: Color {
    switch deal.status {
    case .reachingOut: return .blue
    case .negotiating: return .orange
    case .offerReceived: return .purple
    case .bestPriceReady: return .green
    case .paused: return .gray
    }
  }
  
  private var vehicleIcon: String {
    switch deal.vehicle.bodyType.lowercased() {
    case "pickup": return "truck.box.fill"
    case "suv": return "suv.side.fill"
    case "sedan": return "car.side.fill"
    case "convertible": return "car.top.door.front.left.and.front.right.and.rear.right.open.fill"
    default: return "car.fill"
    }
  }
}

// MARK: - Previews

#Preview("Deals List") {
  DealsListView()
    .preferredColorScheme(.dark)
}

#Preview("Deal Card - Negotiating") {
  let deal = DemoDeal(
    id: "preview-1",
    vehicle: DemoVehicle(
      vin: "TEST123",
      year: 2024,
      make: "BMW",
      model: "X7",
      trim: "40i",
      condition: "used",
      listedPrice: 63289,
      bodyType: "SUV",
      drivetrain: "4wd",
      city: "Rock Hill",
      state: "SC",
      thumbnailUrl: nil
    ),
    status: .negotiating,
    negotiation: NegotiationProgress(
      dealershipsContacted: 3,
      dealershipsResponded: 2,
      bestOffer: 59500,
      initialAsk: 63289,
      agentNextStep: "Pushing for lower"
    ),
    outreach: OutreachStats(totalMessages: 24, smsCount: 12, emailCount: 9, voiceCallCount: 3),
    cadence: CommunicationCadence(intervalHours: 48, nextTouchAt: Date().addingTimeInterval(36*3600), description: "Follow-up every 48h"),
    timeline: [],
    otdBreakdown: nil,
    priceHistory: [],
    createdAt: Date().addingTimeInterval(-3*24*3600),
    lastActivityAt: Date().addingTimeInterval(-4*3600)
  )
  
  DealCardView(deal: deal)
    .padding()
    .background(Color.black)
    .preferredColorScheme(.dark)
}
