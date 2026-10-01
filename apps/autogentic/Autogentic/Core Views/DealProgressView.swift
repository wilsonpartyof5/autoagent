import SwiftUI

struct DealProgressView: View {
  @Environment(\.dismiss) private var dismiss
  let deal: Deal
  
  // Placeholder stats — will come from backend later
  private let askingPrice: Int? = nil
  private let negotiatedPrice: Int? = nil
  private let callsCount: Int = 0
  private let textsCount: Int = 0
  private let emailsCount: Int = 0
  private let progressSummary: String? = nil
  
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          // Vehicle header
          vehicleHeader
          
          // Status badge
          statusSection
          
          // Price comparison
          priceSection
          
          // Activity stats
          activitySection
          
          // Progress summary
          summarySection
        }
        .padding(16)
      }
      .background(Color.black.ignoresSafeArea())
      .navigationTitle("Deal Progress")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            dismiss()
          } label: {
            Image(systemName: "xmark")
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(.white)
          }
        }
      }
      .toolbarBackground(Color.black, for: .navigationBar)
      .toolbarBackground(.visible, for: .navigationBar)
    }
    .preferredColorScheme(.dark)
  }
  
  private var vehicleHeader: some View {
    HStack(spacing: 14) {
      // Thumbnail
      if let urlStr = deal.vehicle.thumbnailUrl, let url = URL(string: urlStr) {
        AsyncImage(url: url) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .aspectRatio(contentMode: .fill)
              .frame(width: 80, height: 80)
              .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          default:
            placeholderImage
          }
        }
        .frame(width: 80, height: 80)
      } else {
        placeholderImage
      }
      
      VStack(alignment: .leading, spacing: 6) {
        Text(deal.vehicle.fullTitle)
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(2)
        
        if let location = deal.vehicle.location {
          Text(location)
            .font(.system(size: 14))
            .foregroundStyle(Color.white.opacity(0.6))
        }
        
        if let milesText = deal.vehicle.formattedMiles {
          Text(milesText)
            .font(.system(size: 14))
            .foregroundStyle(Color.white.opacity(0.6))
        }
      }
      
      Spacer()
    }
    .padding(16)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(Color(white: 0.08))
    )
  }
  
  private var placeholderImage: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color(white: 0.15))
      Image(systemName: "car.fill")
        .font(.system(size: 28))
        .foregroundStyle(Color.white.opacity(0.3))
    }
    .frame(width: 80, height: 80)
  }
  
  private var statusSection: some View {
    HStack {
      Circle()
        .fill(statusColor)
        .frame(width: 10, height: 10)
      
      Text(deal.status.displayName)
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(.white)
      
      Spacer()
      
      Text("Started \(formattedDate)")
        .font(.system(size: 13))
        .foregroundStyle(Color.white.opacity(0.5))
    }
    .padding(16)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(Color(white: 0.08))
    )
  }
  
  private var priceSection: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Price")
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(.white)
      
      VStack(spacing: 12) {
        priceRow(label: "MSRP", value: deal.vehicle.msrp)
        priceRow(label: "Asking Price", value: askingPrice ?? deal.vehicle.price)
        
        Divider()
          .background(Color.white.opacity(0.1))
        
        HStack {
          Text("Negotiated Price")
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
          
          Spacer()
          
          if let price = negotiatedPrice {
            Text(formatPrice(price))
              .font(.system(size: 17, weight: .bold))
              .foregroundStyle(.green)
          } else {
            Text("In progress...")
              .font(.system(size: 15))
              .foregroundStyle(Color.white.opacity(0.5))
              .italic()
          }
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(Color(white: 0.06))
      )
    }
  }
  
  private func priceRow(label: String, value: Int?) -> some View {
    HStack {
      Text(label)
        .font(.system(size: 14))
        .foregroundStyle(Color.white.opacity(0.7))
      
      Spacer()
      
      Text(value.map { formatPrice($0) } ?? "—")
        .font(.system(size: 15, weight: .medium))
        .foregroundStyle(.white)
    }
  }
  
  private var activitySection: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Agent Activity")
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(.white)
      
      HStack(spacing: 16) {
        activityCard(icon: "phone.fill", count: callsCount, label: "Calls")
        activityCard(icon: "message.fill", count: textsCount, label: "Texts")
        activityCard(icon: "envelope.fill", count: emailsCount, label: "Emails")
      }
    }
  }
  
  private func activityCard(icon: String, count: Int, label: String) -> some View {
    VStack(spacing: 8) {
      Image(systemName: icon)
        .font(.system(size: 20))
        .foregroundStyle(.orange)
      
      Text("\(count)")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
      
      Text(label)
        .font(.system(size: 12))
        .foregroundStyle(Color.white.opacity(0.6))
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 16)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color(white: 0.08))
    )
  }
  
  private var summarySection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Progress Summary")
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(.white)
      
      Text(progressSummary ?? "Your agent is working on getting the best out-the-door price. Check back soon for updates.")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(white: 0.08))
        )
    }
  }
  
  private var statusColor: Color {
    switch deal.status {
    case .interested: return .orange
    case .negotiating: return .blue
    case .accepted: return .green
    case .closed: return .gray
    }
  }
  
  private var formattedDate: String {
    // Parse ISO date and format nicely
    let formatter = ISO8601DateFormatter()
    if let date = formatter.date(from: deal.createdAt) {
      let displayFormatter = DateFormatter()
      displayFormatter.dateStyle = .medium
      return displayFormatter.string(from: date)
    }
    return deal.createdAt
  }
  
  private func formatPrice(_ value: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencySymbol = "$"
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
  }
}
