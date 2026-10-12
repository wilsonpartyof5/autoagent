import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
  case shop = "Shop"
  case deals = "Deals"
  case profile = "Profile"
  
  var id: String { rawValue }
  
  var systemImage: String {
    switch self {
    case .shop: return "text.bubble"
    case .deals: return "tag"
    case .profile: return "person"
    }
  }
}

enum ChatMode: String {
  case ask = "Ask"
  case shop = "Shop"
}

struct ContentView: View {
  @StateObject private var chatVM = ChatViewModel(preload: true)
  @StateObject private var mapVM = MapViewModel()
  @StateObject private var inventoryVM = InventoryViewModel()
  @StateObject private var demoStore = DemoDataStore.shared
  
  @State private var selectedTab: AppTab = .shop
  @State private var chatMode: ChatMode = .ask
  @State private var isDrawerOpen: Bool = false
  @State private var isMapExpanded: Bool = false
  @State private var draftText: String = ""
  
  private var hasStartedChat: Bool {
    !chatVM.messages.isEmpty
  }
  
  private var showShopHome: Bool {
    selectedTab == .shop && !hasStartedChat
  }
  
  private var inputPlaceholder: String {
    chatMode == .ask ? "Ask about any car..." : "Search for any vehicle..."
  }
  
  var body: some View {
    ZStack(alignment: .bottom) {
      mainContent
      
      if isDrawerOpen {
        drawerOverlay
      }
      
      floatingControls
    }
    .background(
      LinearGradient(
        colors: [
          Color(red: 0.08, green: 0.08, blue: 0.12),
          Color(red: 0.02, green: 0.02, blue: 0.04)
        ],
        startPoint: .top,
        endPoint: .bottom
      )
      .ignoresSafeArea()
    )
    .onAppear {
      chatVM.setMapViewModel(mapVM)
    }
  }
  
  @ViewBuilder
  private var mainContent: some View {
    VStack(spacing: 0) {
      if selectedTab == .shop {
        shopHeader
        
        if showShopHome {
          ShopHomeView(
            demoStore: demoStore,
            chatVM: chatVM,
            onStarterCardTapped: handleStarterCardTap
          )
        } else {
          ChatView(
            messages: $chatVM.messages,
            mapVM: mapVM,
            chatVM: chatVM,
            onMapExpand: { isMapExpanded = true },
            demoStore: demoStore
          )
        }
      } else if selectedTab == .deals {
        DealsPlaceholderView()
      } else if selectedTab == .profile {
        ProfileView(demoStore: demoStore)
      }
    }
  }
  
  private var shopHeader: some View {
    HStack {
      Button {
        withAnimation(.easeOut(duration: 0.25)) {
          isDrawerOpen = true
        }
      } label: {
        Image(systemName: "line.3.horizontal")
          .font(.system(size: 20, weight: .medium))
          .foregroundStyle(.white)
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel("Chat history")
      
      Spacer()
      
      modeToggle
      
      Spacer()
      
      SizedBox(width: 44)
    }
    .padding(.horizontal, 8)
    .padding(.top, 8)
  }
  
  private var modeToggle: some View {
    HStack(spacing: 0) {
      modeButton(mode: .ask, icon: "plus", label: "Ask")
      modeButton(mode: .shop, icon: "text.bubble", label: "Shop")
    }
    .padding(4)
    .background(
      Capsule()
        .fill(Color.white.opacity(0.08))
    )
  }
  
  private func modeButton(mode: ChatMode, icon: String, label: String) -> some View {
    Button {
      withAnimation(.easeOut(duration: 0.2)) {
        chatMode = mode
      }
    } label: {
      HStack(spacing: 6) {
        Image(systemName: icon)
          .font(.system(size: 13, weight: .medium))
        Text(label)
          .font(.system(size: 14, weight: .semibold))
      }
      .foregroundStyle(chatMode == mode ? .black : .white)
      .padding(.horizontal, 14)
      .padding(.vertical, 8)
      .background(
        Capsule()
          .fill(chatMode == mode ? .white : .clear)
      )
    }
  }
  
  private var drawerOverlay: some View {
    ZStack(alignment: .leading) {
      Color.black.opacity(0.38)
        .ignoresSafeArea()
        .onTapGesture {
          withAnimation(.easeOut(duration: 0.25)) {
            isDrawerOpen = false
          }
        }
      
      ChatHistoryDrawer(
        demoStore: demoStore,
        isOpen: $isDrawerOpen,
        onChatSelected: { chat in
          // Load chat
        },
        onNewChat: {
          chatVM.messages = []
        }
      )
      .transition(.move(edge: .leading))
    }
  }
  
  private var floatingControls: some View {
    VStack(spacing: 0) {
      Spacer()
      
      if selectedTab == .shop {
        floatingInputBar
          .padding(.horizontal, 16)
          .padding(.bottom, 12)
      }
      
      floatingTabBar
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
  }
  
  private var floatingInputBar: some View {
    HStack(alignment: .center, spacing: 10) {
      TextField("", text: $draftText, prompt: Text(inputPlaceholder).foregroundStyle(Color.white.opacity(0.4)))
        .font(.system(size: 16))
        .foregroundStyle(.white)
        .textInputAutocapitalization(.sentences)
        .autocorrectionDisabled(false)
        .padding(.leading, 16)
        .padding(.vertical, 14)
      
      Button {
        // Microphone action placeholder
      } label: {
        Image(systemName: "mic")
          .font(.system(size: 18))
          .foregroundStyle(Color.white.opacity(0.5))
      }
      .padding(.trailing, 4)
      
      Button {
        sendMessage()
      } label: {
        Image(systemName: "arrow.up")
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(.white)
          .frame(width: 36, height: 36)
          .background(
            Circle()
              .fill(canSend ? Color(red: 0.35, green: 0.4, blue: 0.95) : Color.white.opacity(0.15))
          )
      }
      .disabled(!canSend)
      .padding(.trailing, 8)
    }
    .frame(height: 56)
    .background(
      Capsule()
        .fill(Color.white.opacity(0.08))
    )
    .overlay(
      Capsule()
        .stroke(Color.white.opacity(0.1), lineWidth: 1)
    )
  }
  
  private var canSend: Bool {
    !draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }
  
  private func sendMessage() {
    guard canSend else { return }
    let query = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
    draftText = ""
    
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    chatVM.send(text: query)
    
    if query.lowercased().contains("black") ||
       query.lowercased().contains("white") ||
       query.lowercased().contains("red") ||
       query.lowercased().contains("blue") ||
       query.lowercased().contains("under") ||
       query.lowercased().contains("below") ||
       query.lowercased().contains("$") {
      mapVM.applyQuery(query)
    }
  }
  
  private func handleStarterCardTap(_ card: StarterCard) {
    switch card.action {
    case .askGeneric(let prompt):
      draftText = prompt
      sendMessage()
    case .runSearch(let searchId):
      if let search = demoStore.searchProfile.searches.first(where: { $0.id == searchId }) {
        draftText = search.displayTitle
        sendMessage()
      }
    case .showPriceDrops:
      draftText = "Show me price drops on cars I've viewed"
      sendMessage()
    case .showNewListings:
      draftText = "Show new listings matching my searches"
      sendMessage()
    case .askFairPrice(let vin, let price):
      draftText = "Is $\(price.formatted()) fair for this car?"
      sendMessage()
    }
  }
  
  private var floatingTabBar: some View {
    HStack(spacing: 0) {
      ForEach(AppTab.allCases) { tab in
        Button {
          withAnimation(.easeOut(duration: 0.2)) {
            selectedTab = tab
          }
        } label: {
          HStack(spacing: 8) {
            Image(systemName: tab.systemImage)
              .font(.system(size: 16))
            Text(tab.rawValue)
              .font(.system(size: 15, weight: .medium))
          }
          .foregroundStyle(selectedTab == tab ? .white : Color.white.opacity(0.5))
          .padding(.horizontal, 20)
          .padding(.vertical, 14)
          .background(
            Capsule()
              .fill(selectedTab == tab ? Color.white.opacity(0.15) : .clear)
          )
        }
      }
    }
    .padding(6)
    .background(
      Capsule()
        .fill(Color(white: 0.12).opacity(0.95))
    )
    .overlay(
      Capsule()
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

struct SizedBox: View {
  var width: CGFloat? = nil
  var height: CGFloat? = nil
  
  var body: some View {
    Color.clear
      .frame(width: width, height: height)
  }
}

struct DealsPlaceholderView: View {
  var body: some View {
    VStack(spacing: 14) {
      Spacer()
      
      Image(systemName: "tag")
        .font(.system(size: 48))
        .foregroundStyle(Color.white.opacity(0.3))
      
      Text("Deals")
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(.white)
      
      Text("Cars you're working on will appear here.")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))
      
      Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
