import SwiftUI

// ContentView is now a legacy wrapper that redirects to MainTabView
// Keeping it for backward compatibility with any references

struct ContentView: View {
  var body: some View {
    MainTabView()
  }
}

#Preview {
  ContentView()
    .environmentObject(ConsumerAuthStore())
    .environmentObject(DealsStore(authStore: ConsumerAuthStore()))
    .environmentObject(SubscriptionStore())
    .environmentObject(LocationManager())
    .preferredColorScheme(.dark)
}
