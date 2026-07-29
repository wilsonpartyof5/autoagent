import SwiftUI
import Combine

/// Keyboard height publisher for tracking keyboard appearance/dismissal
enum Keyboard {
  static var heightPublisher: AsyncStream<CGFloat> {
    AsyncStream { continuation in
      let willShow = NotificationCenter.default.addObserver(
        forName: UIResponder.keyboardWillShowNotification,
        object: nil,
        queue: .main
      ) { note in
        let endFrame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect) ?? .zero
        continuation.yield(endFrame.height)
      }

      let willHide = NotificationCenter.default.addObserver(
        forName: UIResponder.keyboardWillHideNotification,
        object: nil,
        queue: .main
      ) { _ in
        continuation.yield(0)
      }

      continuation.onTermination = { _ in
        NotificationCenter.default.removeObserver(willShow)
        NotificationCenter.default.removeObserver(willHide)
      }
    }
  }
}

/// Extension to enable onReceive for AsyncStream
extension View {
  func onReceive(_ stream: AsyncStream<CGFloat>, perform: @escaping (CGFloat) -> Void) -> some View {
    task {
      for await value in stream {
        perform(value)
      }
    }
  }
}
