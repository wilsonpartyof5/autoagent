import SwiftUI

struct MainTabView: View {
  @State private var selectedTab: Tab = .chat
  
  enum Tab {
    case deals
    case chat
  }
  
  var body: some View {
    TabView(selection: $selectedTab) {
      DealsListView()
        .tabItem {
          Label("Deals", systemImage: "briefcase.fill")
        }
        .tag(Tab.deals)
      
      ChatTabView()
        .tabItem {
          Label("Chat", systemImage: "message.fill")
        }
        .tag(Tab.chat)
    }
    .tint(.white)
  }
}

#Preview {
  MainTabView()
    .environmentObject(DealsStore(authStore: ConsumerAuthStore()))
    .environmentObject(SubscriptionStore())
    .environmentObject(LocationManager())
    .preferredColorScheme(.dark)
}
