import SwiftUI
import Charts

struct DealDetailView: View {
  @Environment(\.dismiss) private var dismiss
  let deal: DemoDeal
  
  @State private var showFullTimeline = false
  @State private var showRemoveConfirmation = false
  
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 20) {
          // Vehicle header
          vehicleHeader
          
          // Price & Savings
          priceSummaryCard
          
          // Outreach Stats
          outreachStatsCard
          
          // Price History Chart
          if deal.priceHistory.count > 1 {
            priceHistoryCard
          }
          
          // OTD Breakdown
          if let breakdown = deal.otdBreakdown {
            otdBreakdownCard(breakdown)
          }
          
          // Communication Cadence
          cadenceCard
          
          // Agent's Next Step
          nextStepCard
          
          // Activity Timeline
          timelineCard
          
          // Actions
          actionsSection
        }
        .padding(16)
        .padding(.bottom, 24)
      }
      .background(Color.black)
      .navigationTitle("Deal Details")
      .navigationBarTitleDisplayMode(.inline)
      .toolbarBackground(Color.black, for: .navigationBar)
      .toolbarBackground(.visible, for: .navigationBar)
      .toolbarColorScheme(.dark, for: .navigationBar)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            dismiss()
          } label: {
            Image(systemName: "xmark.circle.fill")
              .font(.system(size: 24))
              .foregroundStyle(Color.white.opacity(0.6))
          }
        }
      }
      .alert("Remove this car?", isPresented: $showRemoveConfirmation) {
        Button("Cancel", role: .cancel) { }
        Button("Remove", role: .destructive) {
          dismiss()
        }
      } message: {
        Text("This will free up 1 of your 10 agent slots. Any negotiation progress will be lost.")
      }
    }
  }
  
  // MARK: - Vehicle Header
  
  private var vehicleHeader: some View {
    HStack(spacing: 14) {
      // Vehicle placeholder
      ZStack {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(
            LinearGradient(
              colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.1)],
              startPoint: .topLeading,
              endPoint: .bottomTrailing
            )
          )
        Image(systemName: vehicleIcon)
          .font(.system(size: 32))
          .foregroundStyle(Color.white.opacity(0.4))
      }
      .frame(width: 80, height: 80)
      
      VStack(alignment: .leading, spacing: 6) {
        Text(deal.vehicle.fullTitle)
          .font(.system(size: 17, weight: .bold))
          .foregroundStyle(.white)
        
        Text(deal.vehicle.location)
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.6))
        
        // Status chip
        HStack(spacing: 4) {
          Image(systemName: deal.status.icon)
            .font(.system(size: 11, weight: .semibold))
          Text(deal.status.displayName)
            .font(.system(size: 12, weight: .semibold))
        }
        .foregroundStyle(statusColor)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(
          Capsule()
            .fill(statusColor.opacity(0.15))
        )
      }
      
      Spacer()
    }
    .padding(16)
    .background(cardBackground)
  }
  
  // MARK: - Price Summary
  
  private var priceSummaryCard: some View {
    VStack(spacing: 16) {
      sectionHeader("Price Summary", icon: "dollarsign.circle.fill")
      
      HStack(alignment: .top) {
        // Starting price
        VStack(alignment: .leading, spacing: 4) {
          Text("Listed Price")
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.5))
          Text(deal.vehicle.formattedPrice)
            .font(.system(size: 20, weight: .bold))
            .foregroundStyle(.white)
        }
        
        Spacer()
        
        // Best offer
        if let bestOffer = deal.negotiation.bestOffer {
          VStack(alignment: .trailing, spacing: 4) {
            Text("Best OTD Offer")
              .font(.system(size: 12))
              .foregroundStyle(Color.green.opacity(0.8))
            Text(formatCurrency(bestOffer))
              .font(.system(size: 20, weight: .bold))
              .foregroundStyle(.green)
          }
        }
      }
      
      if let savings = deal.savings, let percentage = deal.savingsPercentage {
        HStack {
          Image(systemName: "arrow.down.circle.fill")
            .foregroundStyle(.green)
          Text("You're saving \(formatCurrency(savings)) (\(String(format: "%.1f", percentage))%)")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(.green)
          Spacer()
        }
        .padding(12)
        .background(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color.green.opacity(0.1))
        )
      }
    }
    .padding(16)
    .background(cardBackground)
  }
  
  // MARK: - Outreach Stats
  
  private var outreachStatsCard: some View {
    VStack(spacing: 16) {
      sectionHeader("Outreach Progress", icon: "paperplane.fill")
      
      // Dealerships
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("Dealerships Contacted")
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.5))
          HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("\(deal.negotiation.dealershipsContacted)")
              .font(.system(size: 24, weight: .bold))
              .foregroundStyle(.white)
            Text("dealerships")
              .font(.system(size: 14))
              .foregroundStyle(Color.white.opacity(0.5))
          }
        }
        
        Spacer()
        
        VStack(alignment: .trailing, spacing: 4) {
          Text("Responded")
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.5))
          Text("\(deal.negotiation.dealershipsResponded)")
            .font(.system(size: 24, weight: .bold))
            .foregroundStyle(.blue)
        }
      }
      
      Divider()
        .background(Color.white.opacity(0.1))
      
      // Communication breakdown
      Text("Communication Breakdown")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.7))
        .frame(maxWidth: .infinity, alignment: .leading)
      
      HStack(spacing: 12) {
        commStatPill(count: deal.outreach.smsCount, icon: "message.fill", label: "SMS", color: .green)
        commStatPill(count: deal.outreach.emailCount, icon: "envelope.fill", label: "Email", color: .blue)
        commStatPill(count: deal.outreach.voiceCallCount, icon: "phone.fill", label: "Calls", color: .purple)
      }
      
      HStack {
        Text("Total messages sent")
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.5))
        Spacer()
        Text("\(deal.outreach.totalMessages)")
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(.white)
      }
    }
    .padding(16)
    .background(cardBackground)
  }
  
  private func commStatPill(count: Int, icon: String, label: String, color: Color) -> some View {
    HStack(spacing: 6) {
      Image(systemName: icon)
        .font(.system(size: 12))
        .foregroundStyle(color)
      Text("\(count)")
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(.white)
      Text(label)
        .font(.system(size: 12))
        .foregroundStyle(Color.white.opacity(0.5))
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .frame(maxWidth: .infinity)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(color.opacity(0.1))
    )
  }
  
  // MARK: - Price History Chart
  
  private var priceHistoryCard: some View {
    VStack(spacing: 16) {
      sectionHeader("Price Trend", icon: "chart.line.downtrend.xyaxis")
      
      Chart(deal.priceHistory) { point in
        LineMark(
          x: .value("Date", point.date),
          y: .value("Price", point.price)
        )
        .foregroundStyle(Color.green)
        .interpolationMethod(.catmullRom)
        
        PointMark(
          x: .value("Date", point.date),
          y: .value("Price", point.price)
        )
        .foregroundStyle(point.label != nil ? Color.green : Color.green.opacity(0.5))
        .symbolSize(point.label != nil ? 60 : 30)
        
        if let label = point.label {
          PointMark(
            x: .value("Date", point.date),
            y: .value("Price", point.price)
          )
          .annotation(position: .top, spacing: 4) {
            Text(label)
              .font(.system(size: 10, weight: .medium))
              .foregroundStyle(Color.white.opacity(0.7))
          }
        }
      }
      .chartYScale(domain: .automatic(includesZero: false))
      .chartXAxis {
        AxisMarks(values: .automatic(desiredCount: 4)) { _ in
          AxisValueLabel()
            .foregroundStyle(Color.white.opacity(0.5))
        }
      }
      .chartYAxis {
        AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
          AxisValueLabel {
            if let intValue = value.as(Int.self) {
              Text("$\(intValue / 1000)k")
                .font(.system(size: 10))
                .foregroundStyle(Color.white.opacity(0.5))
            }
          }
        }
      }
      .frame(height: 150)
    }
    .padding(16)
    .background(cardBackground)
  }
  
  // MARK: - OTD Breakdown
  
  private func otdBreakdownCard(_ breakdown: OTDBreakdown) -> some View {
    VStack(spacing: 16) {
      sectionHeader("OTD Breakdown", icon: "list.bullet.rectangle.fill")
      
      VStack(spacing: 10) {
        breakdownRow("Vehicle Price", breakdown.vehiclePrice)
        breakdownRow("Dealer Fees", breakdown.dealerFees)
        breakdownRow("Doc Fee", breakdown.docFee)
        breakdownRow("Est. Taxes", breakdown.estimatedTaxes)
        breakdownRow("Registration", breakdown.registration)
        
        if breakdown.addOnsRemoved > 0 {
          HStack {
            Text("Add-ons Removed")
              .font(.system(size: 14))
              .foregroundStyle(.green)
            Spacer()
            Text("-\(formatCurrency(breakdown.addOnsRemoved))")
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(.green)
          }
        }
        
        Divider()
          .background(Color.white.opacity(0.2))
        
        HStack {
          Text("Total Out-the-Door")
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(.white)
          Spacer()
          Text(formatCurrency(breakdown.totalOTD))
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(.white)
        }
      }
    }
    .padding(16)
    .background(cardBackground)
  }
  
  private func breakdownRow(_ label: String, _ value: Int) -> some View {
    HStack {
      Text(label)
        .font(.system(size: 14))
        .foregroundStyle(Color.white.opacity(0.7))
      Spacer()
      Text(formatCurrency(value))
        .font(.system(size: 14))
        .foregroundStyle(Color.white.opacity(0.9))
    }
  }
  
  // MARK: - Cadence
  
  private var cadenceCard: some View {
    VStack(spacing: 12) {
      sectionHeader("Communication Cadence", icon: "clock.fill")
      
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(deal.cadence.description)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(.white)
          
          if let nextTouch = deal.cadence.nextTouchAt {
            HStack(spacing: 4) {
              Image(systemName: "bell.fill")
                .font(.system(size: 11))
                .foregroundStyle(.orange)
              Text("Next touch: \(nextTouch.formatted(date: .abbreviated, time: .shortened))")
                .font(.system(size: 12))
                .foregroundStyle(Color.white.opacity(0.6))
            }
          }
        }
        Spacer()
      }
    }
    .padding(16)
    .background(cardBackground)
  }
  
  // MARK: - Next Step
  
  private var nextStepCard: some View {
    VStack(spacing: 12) {
      sectionHeader("Agent's Next Step", icon: "sparkles")
      
      if let nextStep = deal.negotiation.agentNextStep {
        Text(nextStep)
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.9))
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(16)
    .background(cardBackground)
  }
  
  // MARK: - Timeline
  
  private var timelineCard: some View {
    VStack(spacing: 12) {
      HStack {
        sectionHeader("Activity Timeline", icon: "list.bullet")
        Spacer()
        if deal.timeline.count > 3 {
          Button {
            showFullTimeline.toggle()
          } label: {
            Text(showFullTimeline ? "Show Less" : "Show All")
              .font(.system(size: 13, weight: .medium))
              .foregroundStyle(.blue)
          }
        }
      }
      
      let visibleEvents = showFullTimeline ? deal.timeline : Array(deal.timeline.prefix(3))
      
      ForEach(visibleEvents) { event in
        timelineEventRow(event)
      }
    }
    .padding(16)
    .background(cardBackground)
  }
  
  private func timelineEventRow(_ event: ActivityEvent) -> some View {
    HStack(alignment: .top, spacing: 12) {
      // Icon
      ZStack {
        Circle()
          .fill(eventColor(event).opacity(0.15))
          .frame(width: 32, height: 32)
        Image(systemName: eventIcon(event))
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(eventColor(event))
      }
      
      VStack(alignment: .leading, spacing: 4) {
        HStack {
          if let label = event.dealerLabel {
            Text(label)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(Color.white.opacity(0.7))
          }
          Spacer()
          Text(formatRelativeTime(event.timestamp))
            .font(.system(size: 11))
            .foregroundStyle(Color.white.opacity(0.4))
        }
        
        Text(event.summary)
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.8))
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(.vertical, 8)
  }
  
  private func eventIcon(_ event: ActivityEvent) -> String {
    switch event.type {
    case .outboundMessage:
      switch event.channel {
      case .sms: return "message.fill"
      case .email: return "envelope.fill"
      case .voice: return "phone.fill"
      case .none: return "paperplane.fill"
      }
    case .inboundReply: return "arrowshape.turn.up.left.fill"
    case .offerReceived: return "tag.fill"
    case .statusChange: return "arrow.triangle.2.circlepath"
    case .agentNote: return "note.text"
    }
  }
  
  private func eventColor(_ event: ActivityEvent) -> Color {
    switch event.type {
    case .outboundMessage: return .blue
    case .inboundReply: return .green
    case .offerReceived: return .purple
    case .statusChange: return .orange
    case .agentNote: return .gray
    }
  }
  
  // MARK: - Actions
  
  private var actionsSection: some View {
    VStack(spacing: 12) {
      if deal.status == .bestPriceReady || deal.status == .offerReceived {
        Button {
          // TODO: Implement ready to buy flow
        } label: {
          HStack {
            Image(systemName: "checkmark.circle.fill")
            Text("Ready to Buy")
          }
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(.black)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 14)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(.green)
          )
        }
      }
      
      HStack(spacing: 12) {
        Button {
          // TODO: Navigate to chat with context
        } label: {
          HStack {
            Image(systemName: "bubble.left.fill")
            Text("Ask Agent")
          }
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.white)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 12)
          .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
              .fill(Color.white.opacity(0.1))
          )
        }
        
        Button {
          // TODO: Toggle pause state
        } label: {
          HStack {
            Image(systemName: deal.status == .paused ? "play.fill" : "pause.fill")
            Text(deal.status == .paused ? "Resume" : "Pause")
          }
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.white)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 12)
          .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
              .fill(Color.white.opacity(0.1))
          )
        }
      }
      
      Button {
        showRemoveConfirmation = true
      } label: {
        HStack {
          Image(systemName: "trash")
          Text("Remove Car")
        }
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(.red)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .stroke(Color.red.opacity(0.3), lineWidth: 1)
        )
      }
    }
    .padding(.top, 8)
  }
  
  // MARK: - Helpers
  
  private var cardBackground: some View {
    RoundedRectangle(cornerRadius: 16, style: .continuous)
      .fill(Color.white.opacity(0.05))
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(Color.white.opacity(0.08), lineWidth: 1)
      )
  }
  
  private func sectionHeader(_ title: String, icon: String) -> some View {
    HStack(spacing: 8) {
      Image(systemName: icon)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.blue)
      Text(title)
        .font(.system(size: 15, weight: .bold))
        .foregroundStyle(.white)
      Spacer()
    }
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

// MARK: - Preview

#Preview("Deal Detail - Best Price Ready") {
  let deal = DemoDeal(
    id: "preview-detail",
    vehicle: DemoVehicle(
      vin: "TEST123",
      year: 2023,
      make: "Genesis",
      model: "Electrified G80",
      trim: "Base",
      condition: "used",
      listedPrice: 38169,
      bodyType: "Sedan",
      drivetrain: "4wd",
      city: "Rock Hill",
      state: "SC",
      thumbnailUrl: nil
    ),
    status: .bestPriceReady,
    negotiation: NegotiationProgress(
      dealershipsContacted: 6,
      dealershipsResponded: 5,
      bestOffer: 33500,
      initialAsk: 38169,
      agentNextStep: "Ready to purchase! This is the best price we could negotiate."
    ),
    outreach: OutreachStats(totalMessages: 42, smsCount: 18, emailCount: 16, voiceCallCount: 8),
    cadence: CommunicationCadence(intervalHours: 0, nextTouchAt: nil, description: "Negotiation complete"),
    timeline: [
      ActivityEvent(id: "1", timestamp: Date().addingTimeInterval(-7*24*3600), type: .statusChange, channel: nil, summary: "Started negotiation", isInbound: false, dealerLabel: nil),
      ActivityEvent(id: "2", timestamp: Date().addingTimeInterval(-5*24*3600), type: .offerReceived, channel: .email, summary: "First offer at $36,000 OTD", isInbound: true, dealerLabel: "Dealer B"),
      ActivityEvent(id: "3", timestamp: Date().addingTimeInterval(-2*24*3600), type: .offerReceived, channel: .sms, summary: "Best offer $33,500 OTD", isInbound: true, dealerLabel: "Dealer E")
    ],
    otdBreakdown: OTDBreakdown(vehiclePrice: 31000, dealerFees: 0, docFee: 199, estimatedTaxes: 2100, registration: 201, addOnsRemoved: 1299, totalOTD: 33500),
    priceHistory: [
      PricePoint(id: "1", date: Date().addingTimeInterval(-7*24*3600), price: 38169, label: "Listed"),
      PricePoint(id: "2", date: Date().addingTimeInterval(-5*24*3600), price: 36000, label: nil),
      PricePoint(id: "3", date: Date().addingTimeInterval(-2*24*3600), price: 33500, label: "Final")
    ],
    createdAt: Date().addingTimeInterval(-7*24*3600),
    lastActivityAt: Date().addingTimeInterval(-12*3600)
  )
  
  DealDetailView(deal: deal)
    .preferredColorScheme(.dark)
}
