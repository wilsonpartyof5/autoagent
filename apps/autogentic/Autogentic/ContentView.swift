import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var deals: DealsStore
  @EnvironmentObject private var subscription: SubscriptionStore
  @EnvironmentObject private var locationManager: LocationManager

  @StateObject private var chatVM = ChatViewModel(preload: true)
  @StateObject private var mapVM = MapViewModel()
  @StateObject private var inventoryVM = InventoryViewModel()

  @State private var isSidebarOpen: Bool = false
  @State private var isMapExpanded: Bool = false
  @State private var chatMode: ChatMode = .ask
  @State private var draftText: String = ""
  @State private var selectedDealForProgress: Deal? = nil

  var body: some View {
    NavigationStack {
      ZStack(alignment: .bottom) {
        // Non-negotiable base: ChatView is always present (chat-first shell)
        ChatView(
          messages: $chatVM.messages,
          mapVM: mapVM,
          chatVM: chatVM,
          chatMode: $chatMode,
          onMapExpand: {
            isMapExpanded = true
          }
        )
        .onAppear {
          chatVM.setMapViewModel(mapVM)
          chatVM.setLocationManager(locationManager)
        }

        if isSidebarOpen {
          Color.black.opacity(0.45)
            .ignoresSafeArea()
            .onTapGesture { withAnimation(.easeOut(duration: 0.2)) { isSidebarOpen = false } }
            .transition(.opacity)

          sidebar
            .transition(.move(edge: .leading))
        }
      }
      // safeAreaInset pins the bar at the bottom and lets iOS move it above the
      // keyboard automatically — same system animation, no manual tracking needed.
      .safeAreaInset(edge: .bottom, spacing: 0) {
        VStack(spacing: 0) {
          // Ask/Shop mode toggle
          ChatModeToggle(selectedMode: $chatMode)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
          
          InputBarView(
            text: $draftText,
            placeholder: chatMode.placeholder,
            onSend: {
              let query = draftText
              chatVM.send(text: query, mode: chatMode)

              if chatMode == .shop {
                if query.lowercased().contains("black") ||
                  query.lowercased().contains("white") || query.lowercased().contains("red") ||
                  query.lowercased().contains("blue") || query.lowercased().contains("under") ||
                  query.lowercased().contains("below") || query.lowercased().contains("$") {
                  mapVM.applyQuery(query)
                }
              }

              draftText = ""
            }
          )
          .padding(.horizontal, 12)
          .padding(.bottom, 12)
        }
        .background(Color.black)
      }
      .background(Color.black.ignoresSafeArea())
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button {
            withAnimation(.easeOut(duration: 0.2)) { isSidebarOpen.toggle() }
          } label: {
            Image(systemName: "line.3.horizontal")
              .font(.system(size: 17, weight: .semibold))
          }
          .tint(.white)
        }

        ToolbarItem(placement: .principal) {
          Text("Drevvy")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
        }
      }
      .sheet(item: $selectedDealForProgress) { deal in
        DealProgressView(deal: deal)
      }
    }
  }

  private var sidebar: some View {
    SidebarView(
      deals: deals.deals,
      onDealTap: { deal in
        withAnimation(.easeOut(duration: 0.2)) { isSidebarOpen = false }
        selectedDealForProgress = deal
      },
      onClose: {
        withAnimation(.easeOut(duration: 0.2)) { isSidebarOpen = false }
      }
    )
  }
}

// MARK: - Sidebar View

private struct SidebarView: View {
  @EnvironmentObject private var auth: ConsumerAuthStore
  @EnvironmentObject private var subscription: SubscriptionStore
  @EnvironmentObject private var locationManager: LocationManager
  
  let deals: [Deal]
  let onDealTap: (Deal) -> Void
  let onClose: () -> Void
  
  @State private var showProfile: Bool = false
  
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      // Header
      HStack {
        Text("Drevvy")
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(.white)
        Spacer()
        
        // Dev toggle for subscription (remove in production)
        #if DEBUG
        Button {
          subscription.toggleSubscription()
        } label: {
          Image(systemName: subscription.hasActiveAgentSubscription ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 14))
            .foregroundStyle(subscription.hasActiveAgentSubscription ? .green : Color.white.opacity(0.5))
        }
        #endif
      }
      .padding(.bottom, 16)
      
      // Deals in Progress section
      VStack(alignment: .leading, spacing: 12) {
        HStack {
          Image(systemName: "briefcase.fill")
            .font(.system(size: 14))
            .foregroundStyle(Color.white.opacity(0.6))
          Text("Deals in Progress")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.white.opacity(0.6))
          
          Spacer()
          
          if subscription.hasActiveAgentSubscription {
            Text("\(deals.count)/\(SubscriptionStore.dealsPerAgent)")
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(Color.white.opacity(0.5))
          }
        }
        
        if deals.isEmpty {
          Text("No active deals")
            .font(.system(size: 14))
            .foregroundStyle(Color.white.opacity(0.4))
            .padding(.vertical, 8)
        } else {
          ForEach(deals.prefix(10)) { deal in
            Button {
              onDealTap(deal)
            } label: {
              SidebarDealRow(deal: deal)
            }
            .buttonStyle(.plain)
          }
        }
      }
      
      Divider()
        .background(Color.white.opacity(0.1))
        .padding(.vertical, 16)
      
      // Location status row
      locationStatusRow
      
      Divider()
        .background(Color.white.opacity(0.1))
        .padding(.vertical, 16)
      
      // Profile button
      Button {
        showProfile = true
      } label: {
        HStack(spacing: 10) {
          Image(systemName: auth.isSignedIn ? "person.crop.circle.fill.badge.checkmark" : "person.crop.circle")
            .font(.system(size: 18))
            .foregroundStyle(auth.isSignedIn ? .green : Color.white.opacity(0.6))
          
          VStack(alignment: .leading, spacing: 2) {
            Text(auth.isSignedIn ? "Profile" : "Sign In")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(.white)
            
            if auth.isSignedIn {
              Text(subscription.hasActiveAgentSubscription ? "Subscribed" : "Free")
                .font(.system(size: 12))
                .foregroundStyle(Color.white.opacity(0.5))
            }
          }
          
          Spacer()
          
          Image(systemName: "chevron.right")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.white.opacity(0.4))
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color.white.opacity(0.06))
        )
      }
      .buttonStyle(.plain)
      
      Spacer()
    }
    .padding(.top, 16)
    .padding(.horizontal, 14)
    .frame(maxWidth: 300, alignment: .leading)
    .frame(width: 280)
    .background(
      Rectangle()
        .fill(Color(white: 0.08))
        .ignoresSafeArea()
    )
    .overlay(
      Rectangle()
        .fill(Color.white.opacity(0.06))
        .frame(width: 1),
      alignment: .trailing
    )
    .frame(maxWidth: .infinity, alignment: .leading)
    .sheet(isPresented: $showProfile) {
      ProfileSheetView()
    }
  }
  
  private var locationStatusRow: some View {
    HStack(spacing: 10) {
      Image(systemName: locationIcon)
        .font(.system(size: 16))
        .foregroundStyle(locationColor)
      
      VStack(alignment: .leading, spacing: 2) {
        Text(locationTitle)
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(.white)
        
        Text(locationSubtitle)
          .font(.system(size: 12))
          .foregroundStyle(Color.white.opacity(0.5))
      }
      
      Spacer()
      
      if locationManager.status == .denied {
        Button {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
          }
        } label: {
          Text("Settings")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(.blue)
        }
      }
    }
    .padding(.vertical, 8)
  }
  
  private var locationIcon: String {
    switch locationManager.status {
    case .authorized: return "location.fill"
    case .denied, .restricted: return "location.slash"
    case .notDetermined: return "location"
    }
  }
  
  private var locationColor: Color {
    switch locationManager.status {
    case .authorized: return .green
    case .denied, .restricted: return .orange
    case .notDetermined: return Color.white.opacity(0.6)
    }
  }
  
  private var locationTitle: String {
    switch locationManager.status {
    case .authorized: return "Location On"
    case .denied: return "Location Off"
    case .restricted: return "Location Restricted"
    case .notDetermined: return "Location"
    }
  }
  
  private var locationSubtitle: String {
    switch locationManager.status {
    case .authorized: return "Finding vehicles near you"
    case .denied: return "Use city/ZIP in searches"
    case .restricted: return "Use city/ZIP in searches"
    case .notDetermined: return "Enable for nearby results"
    }
  }
}

private struct SidebarDealRow: View {
  let deal: Deal
  
  var body: some View {
    HStack(spacing: 10) {
      // Thumbnail
      if let urlStr = deal.vehicle.thumbnailUrl, let url = URL(string: urlStr) {
        AsyncImage(url: url) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .aspectRatio(contentMode: .fill)
              .frame(width: 40, height: 40)
              .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
          default:
            placeholderImage
          }
        }
        .frame(width: 40, height: 40)
      } else {
        placeholderImage
      }
      
      VStack(alignment: .leading, spacing: 2) {
        Text("\(deal.vehicle.year) \(deal.vehicle.make)")
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(.white)
          .lineLimit(1)
        
        HStack(spacing: 4) {
          Circle()
            .fill(statusColor)
            .frame(width: 6, height: 6)
          Text(deal.status.displayName)
            .font(.system(size: 11))
            .foregroundStyle(Color.white.opacity(0.6))
        }
      }
      
      Spacer()
      
      Image(systemName: "chevron.right")
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.3))
    }
    .padding(8)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.white.opacity(0.04))
    )
  }
  
  private var placeholderImage: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 6, style: .continuous)
        .fill(Color(white: 0.15))
      Image(systemName: "car.fill")
        .font(.system(size: 14))
        .foregroundStyle(Color.white.opacity(0.3))
    }
    .frame(width: 40, height: 40)
  }
  
  private var statusColor: Color {
    switch deal.status {
    case .interested: return .orange
    case .negotiating: return .blue
    case .accepted: return .green
    case .closed: return .gray
    }
  }
}

// Profile as a sheet (accessible from sidebar)
private struct ProfileSheetView: View {
  @Environment(\.dismiss) private var dismiss
  
  var body: some View {
    NavigationStack {
      ProfileView()
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
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.black, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
  }
}

// MARK: - Chat Mode Toggle (Segmented Control)

private struct ChatModeToggle: View {
  @Binding var selectedMode: ChatMode
  @Namespace private var animation
  
  var body: some View {
    HStack(spacing: 0) {
      ForEach(ChatMode.allCases) { mode in
        Button {
          withAnimation(.easeInOut(duration: 0.2)) {
            selectedMode = mode
          }
        } label: {
          HStack(spacing: 5) {
            Image(systemName: mode.icon)
              .font(.system(size: 12, weight: .semibold))
            Text(mode.rawValue)
              .font(.system(size: 13, weight: .semibold))
          }
          .foregroundStyle(selectedMode == mode ? .black : Color.white.opacity(0.6))
          .padding(.horizontal, 16)
          .padding(.vertical, 8)
          .background {
            if selectedMode == mode {
              Capsule()
                .fill(Color.white)
                .matchedGeometryEffect(id: "modeIndicator", in: animation)
            }
          }
        }
        .buttonStyle(.plain)
      }
    }
    .padding(3)
    .background(
      Capsule()
        .fill(Color.white.opacity(0.1))
    )
  }
}

// Keyboard utilities moved to Utilities/KeyboardExtensions.swift
