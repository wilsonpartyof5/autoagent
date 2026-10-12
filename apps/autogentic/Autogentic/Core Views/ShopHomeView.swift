import SwiftUI

struct ShopHomeView: View {
  @ObservedObject var demoStore: DemoDataStore
  @ObservedObject var chatVM: ChatViewModel
  var onStarterCardTapped: (StarterCard) -> Void
  
  var body: some View {
    ScrollView {
      VStack(spacing: 0) {
        headerSection
        starterCardsGrid
        if demoStore.hasHistory {
          manageLink
        } else {
          privacyNote
        }
        Spacer(minLength: 160)
      }
      .padding(.horizontal, 16)
    }
  }
  
  private var headerSection: some View {
    VStack(spacing: 16) {
      Spacer().frame(height: 40)
      
      ZStack {
        Circle()
          .fill(
            LinearGradient(
              colors: [Color(red: 0.55, green: 0.55, blue: 1.0), Color(red: 0.70, green: 0.70, blue: 1.0)],
              startPoint: .topLeading,
              endPoint: .bottomTrailing
            )
          )
          .frame(width: 80, height: 80)
        
        Image(systemName: "sparkle")
          .font(.system(size: 28, weight: .semibold))
          .foregroundStyle(.white)
      }
      .shadow(color: Color(red: 0.55, green: 0.55, blue: 1.0).opacity(0.4), radius: 20, y: 8)
      
      Text(demoStore.greeting)
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(.white)
        .multilineTextAlignment(.center)
      
      Text(demoStore.subheadline)
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))
        .multilineTextAlignment(.center)
        .padding(.horizontal, 20)
      
      Spacer().frame(height: 24)
    }
  }
  
  private var starterCardsGrid: some View {
    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
      ForEach(demoStore.starterCards) { card in
        StarterCardView(card: card, isGeneric: card.kind == .generic)
          .onTapGesture {
            onStarterCardTapped(card)
          }
      }
    }
  }
  
  private var manageLink: some View {
    HStack(spacing: 6) {
      Image(systemName: "clock.arrow.circlepath")
        .font(.system(size: 13))
        .foregroundStyle(Color(red: 0.4, green: 0.45, blue: 0.95))
      
      Text("Based on your past searches")
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(Color(red: 0.4, green: 0.45, blue: 0.95))
      
      Text("·")
        .foregroundStyle(Color(red: 0.4, green: 0.45, blue: 0.95))
      
      Text("Manage")
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(Color(red: 0.4, green: 0.45, blue: 0.95))
    }
    .padding(.top, 20)
    .onTapGesture {
      // Navigate to Profile > Search Profile
    }
  }
  
  private var privacyNote: some View {
    HStack(spacing: 6) {
      Image(systemName: "checkmark.shield")
        .font(.system(size: 13))
        .foregroundStyle(Color.white.opacity(0.5))
      
      Text("Dealers never see your contact info.")
        .font(.system(size: 14))
        .foregroundStyle(Color.white.opacity(0.5))
    }
    .padding(.top, 20)
  }
}

struct StarterCardView: View {
  let card: StarterCard
  let isGeneric: Bool
  
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      iconView
      
      if !card.kicker.isEmpty {
        Text(card.kicker)
          .font(.system(size: 11, weight: .heavy))
          .foregroundStyle(Color.white.opacity(0.5))
          .kerning(0.5)
      }
      
      Text(card.title)
        .font(.system(size: 15, weight: .medium))
        .foregroundStyle(.white)
        .lineLimit(3)
        .multilineTextAlignment(.leading)
      
      Spacer(minLength: 0)
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .frame(minHeight: 140)
    .background(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color(white: 0.12))
    )
    .overlay(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .stroke(Color.white.opacity(0.06), lineWidth: 1)
    )
  }
  
  @ViewBuilder
  private var iconView: some View {
    let (iconName, iconColor) = iconConfig
    
    ZStack {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(iconColor.opacity(0.15))
        .frame(width: 36, height: 36)
      
      Image(systemName: iconName)
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(iconColor)
    }
  }
  
  private var iconConfig: (String, Color) {
    switch card.kind {
    case .backToSearch:
      return ("clock.arrow.circlepath", Color(red: 0.3, green: 0.35, blue: 0.75))
    case .priceDrops:
      return ("arrow.down", Color(red: 0.3, green: 0.35, blue: 0.75))
    case .newListings:
      return ("text.bubble", Color(red: 0.3, green: 0.35, blue: 0.75))
    case .fairPrice:
      return ("chart.line.uptrend.xyaxis", Color(red: 0.85, green: 0.65, blue: 0.2))
    case .generic:
      return genericIconConfig
    }
  }
  
  private var genericIconConfig: (String, Color) {
    if card.title.lowercased().contains("hybrid") || card.title.lowercased().contains("suv") {
      return ("plus", Color(red: 0.3, green: 0.35, blue: 0.75))
    } else if card.title.lowercased().contains("fair") || card.title.lowercased().contains("$") {
      return ("chart.line.uptrend.xyaxis", Color(red: 0.85, green: 0.65, blue: 0.2))
    } else if card.title.lowercased().contains("fee") {
      return ("checkmark.shield", Color(red: 0.85, green: 0.65, blue: 0.2))
    } else if card.title.lowercased().contains("ev") || card.title.lowercased().contains("find") {
      return ("text.bubble", Color(red: 0.3, green: 0.35, blue: 0.75))
    }
    return ("sparkle", Color(red: 0.3, green: 0.35, blue: 0.75))
  }
}
