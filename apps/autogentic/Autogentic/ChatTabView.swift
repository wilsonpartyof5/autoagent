import SwiftUI

struct ChatTabView: View {
  @EnvironmentObject private var deals: DealsStore
  @EnvironmentObject private var subscription: SubscriptionStore
  @EnvironmentObject private var locationManager: LocationManager

  @StateObject private var chatVM = ChatViewModel(preload: true)
  @StateObject private var mapVM = MapViewModel()
  @StateObject private var inventoryVM = InventoryViewModel()

  @State private var isMapExpanded: Bool = false
  @State private var chatMode: ChatMode = .ask
  @State private var draftText: String = ""

  var body: some View {
    NavigationStack {
      ZStack(alignment: .bottom) {
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
      }
      .safeAreaInset(edge: .bottom, spacing: 0) {
        VStack(spacing: 0) {
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
      .navigationTitle("Drevvy")
      .navigationBarTitleDisplayMode(.inline)
      .toolbarBackground(Color.black, for: .navigationBar)
      .toolbarBackground(.visible, for: .navigationBar)
      .toolbarColorScheme(.dark, for: .navigationBar)
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

#Preview {
  ChatTabView()
    .environmentObject(DealsStore(authStore: ConsumerAuthStore()))
    .environmentObject(SubscriptionStore())
    .environmentObject(LocationManager())
    .preferredColorScheme(.dark)
}
