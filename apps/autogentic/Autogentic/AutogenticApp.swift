import SwiftUI

@main
struct AutogenticApp: App {
  @StateObject private var auth = ConsumerAuthStore()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(auth)
        .preferredColorScheme(.dark)
    }
  }
}
