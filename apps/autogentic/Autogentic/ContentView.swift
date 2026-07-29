import SwiftUI

struct ContentView: View {
  enum SidebarTab: String, CaseIterable, Identifiable {
    case chat = "Chat"
    case marketScan = "Market Scan"
    case savedVehicles = "Saved Vehicles"
    case myDeals = "My Deals"
    case profile = "Profile"

    var id: String { rawValue }

    var systemImage: String {
      switch self {
      case .chat: return "message.fill"
      case .marketScan: return "sparkle.magnifyingglass"
      case .savedVehicles: return "bookmark.fill"
      case .myDeals: return "briefcase.fill"
      case .profile: return "person.crop.circle"
      }
    }
  }

  @StateObject private var chatVM = ChatViewModel(preload: true)
  @StateObject private var mapVM = MapViewModel()
  @StateObject private var inventoryVM = InventoryViewModel()

  @State private var selectedTab: SidebarTab = .chat
  @State private var isSidebarOpen: Bool = false
  @State private var isMapExpanded: Bool = false

  @State private var draftText: String = ""

  var body: some View {
    NavigationStack {
      ZStack(alignment: .bottom) {
        // Non-negotiable base: ChatView is always present.
        ChatView(messages: $chatVM.messages, mapVM: mapVM, chatVM: chatVM, onMapExpand: {
          isMapExpanded = true
        })
        .onAppear {
          chatVM.setMapViewModel(mapVM)
        }
        .opacity(selectedTab == .chat ? 1 : 0.12)
        .allowsHitTesting(selectedTab == .chat)

        // Placeholder tab overlays
        if selectedTab != .chat {
          PlaceholderTabView(title: selectedTab.rawValue)
            .transition(.opacity)
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
        InputBarView(
          text: $draftText,
          placeholder: "Search for any vehicle...",
          onSend: {
            let query = draftText
            chatVM.send(text: query)

            if query.lowercased().contains("black") ||
              query.lowercased().contains("white") || query.lowercased().contains("red") ||
              query.lowercased().contains("blue") || query.lowercased().contains("under") ||
              query.lowercased().contains("below") || query.lowercased().contains("$") {
              mapVM.applyQuery(query)
            }

            draftText = ""
          }
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
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
          Text(selectedTab.rawValue)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
        }
      }
    }
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("AutoAgent")
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(.white)
        Spacer()
      }
      .padding(.bottom, 8)

      ForEach(SidebarTab.allCases) { tab in
        Button {
          selectedTab = tab
          withAnimation(.easeOut(duration: 0.2)) { isSidebarOpen = false }
        } label: {
          HStack(spacing: 10) {
            Image(systemName: tab.systemImage)
              .frame(width: 22)
            Text(tab.rawValue)
              .font(.system(size: 16, weight: .semibold))
            Spacer()
          }
          .foregroundStyle(.white)
          .padding(.vertical, 10)
          .padding(.horizontal, 12)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(selectedTab == tab ? Color.white.opacity(0.12) : Color.clear)
          )
        }
        .buttonStyle(.plain)
      }

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
  }
}

private struct PlaceholderTabView: View {
  let title: String

  var body: some View {
    VStack(spacing: 14) {
      Spacer()
      Text(title)
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(.white)

      Text("Step 0 placeholder")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))

      Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.opacity(0.92))
  }
}

// Keyboard utilities moved to Utilities/KeyboardExtensions.swift
