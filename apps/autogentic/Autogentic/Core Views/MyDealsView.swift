import SwiftUI

struct MyDealsView: View {
  @EnvironmentObject private var deals: DealsStore
  
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text("My Deals")
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(.white)
        
        Spacer()
        
        if deals.isLoading {
          ProgressView()
            .tint(.white)
            .scaleEffect(0.8)
        }
      }
      
      if deals.deals.isEmpty && !deals.isLoading {
        emptyState
      } else {
        dealsList
      }
    }
    .task {
      await deals.loadDeals()
    }
  }
  
  private var emptyState: some View {
    VStack(spacing: 12) {
      Image(systemName: "car.circle")
        .font(.system(size: 40))
        .foregroundStyle(Color.white.opacity(0.3))
      
      Text("No deals yet")
        .font(.system(size: 15, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.6))
      
      Text("Tap \"Get Best Price\" on any vehicle to start a deal.")
        .font(.system(size: 13))
        .foregroundStyle(Color.white.opacity(0.5))
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 24)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color(white: 0.08))
    )
  }
  
  private var dealsList: some View {
    VStack(spacing: 12) {
      ForEach(deals.deals) { deal in
        DealRow(deal: deal)
      }
    }
  }
}

private struct DealRow: View {
  let deal: Deal
  
  var body: some View {
    HStack(spacing: 12) {
      // Thumbnail
      if let urlStr = deal.vehicle.thumbnailUrl, let url = URL(string: urlStr) {
        AsyncImage(url: url) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .aspectRatio(contentMode: .fill)
              .frame(width: 60, height: 60)
              .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
          default:
            placeholderImage
          }
        }
        .frame(width: 60, height: 60)
      } else {
        placeholderImage
      }
      
      // Vehicle info
      VStack(alignment: .leading, spacing: 4) {
        Text(deal.vehicle.fullTitle)
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
        
        Text(deal.vehicle.formattedPrice)
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.7))
      }
      
      Spacer()
      
      // Status badge
      statusBadge
    }
    .padding(12)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color(white: 0.08))
    )
  }
  
  private var placeholderImage: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(Color(white: 0.15))
      Image(systemName: "car.fill")
        .font(.system(size: 20))
        .foregroundStyle(Color.white.opacity(0.3))
    }
    .frame(width: 60, height: 60)
  }
  
  private var statusBadge: some View {
    HStack(spacing: 4) {
      Circle()
        .fill(statusColor)
        .frame(width: 6, height: 6)
      
      Text(deal.status.displayName)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.8))
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .background(
      Capsule()
        .fill(Color.white.opacity(0.1))
    )
  }
  
  private var statusColor: Color {
    switch deal.status {
    case .interested:
      return .orange
    case .negotiating:
      return .blue
    case .accepted:
      return .green
    case .closed:
      return .gray
    }
  }
}
