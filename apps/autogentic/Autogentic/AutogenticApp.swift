import SwiftUI

@main
struct AutogenticApp: App {
  @StateObject private var auth = ConsumerAuthStore()
  @StateObject private var deals: DealsStore

  init() {
    let authStore = ConsumerAuthStore()
    _auth = StateObject(wrappedValue: authStore)
    _deals = StateObject(wrappedValue: DealsStore(authStore: authStore))
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(auth)
        .environmentObject(deals)
        .preferredColorScheme(.dark)
    }
  }
}
