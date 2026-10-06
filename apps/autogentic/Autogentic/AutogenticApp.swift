import SwiftUI

@main
struct AutogenticApp: App {
  @StateObject private var auth = ConsumerAuthStore()
  @StateObject private var deals: DealsStore
  @StateObject private var subscription = SubscriptionStore()
  @StateObject private var locationManager = LocationManager()

  init() {
    let authStore = ConsumerAuthStore()
    _auth = StateObject(wrappedValue: authStore)
    _deals = StateObject(wrappedValue: DealsStore(authStore: authStore))
    
    // Configure tab bar appearance for dark mode
    let tabBarAppearance = UITabBarAppearance()
    tabBarAppearance.configureWithOpaqueBackground()
    tabBarAppearance.backgroundColor = UIColor.black
    UITabBar.appearance().standardAppearance = tabBarAppearance
    UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
  }

  var body: some Scene {
    WindowGroup {
      MainTabView()
        .environmentObject(auth)
        .environmentObject(deals)
        .environmentObject(subscription)
        .environmentObject(locationManager)
        .preferredColorScheme(.dark)
    }
  }
}
