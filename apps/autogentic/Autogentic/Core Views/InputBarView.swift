import SwiftUI

/// The app's persistent search and refinement control.
///
/// InputBarView serves as the primary interaction point for vehicle search across all screens.
/// It supports natural language queries for searching, refining, comparing, and exploring vehicles.
///
/// Usage:
/// - In chat view: initiates new searches and modifies the master search state
/// - In expanded map: refines current results without losing map context
/// - In vehicle detail: enables comparison queries referencing the current vehicle
///
/// The bar is always visible and keyboard-aware, adapting its position when the keyboard appears.
struct InputBarView: View {
  @Binding var text: String
  var placeholder: String = "Ask anything about cars"
  let onSend: () -> Void

  @FocusState private var isFocused: Bool

  private var canSend: Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  var body: some View {
    HStack(alignment: .bottom, spacing: 10) {
      ZStack(alignment: .leading) {
        if text.isEmpty {
          Text(placeholder)
            .foregroundStyle(Color.white.opacity(0.45))
            .padding(.leading, 12)
            .padding(.vertical, 10)
        }

        TextField("", text: $text, axis: .vertical)
          .focused($isFocused)
          .textInputAutocapitalization(.sentences)
          .autocorrectionDisabled(false)
          .foregroundStyle(.white)
          .padding(.horizontal, 12)
          .padding(.vertical, 10)
          .lineLimit(1...5)
      }
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color(white: 0.12))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(Color.white.opacity(0.06), lineWidth: 1)
      )

      Button {
        guard canSend else { return }
        print("🟡 DEBUG: Input bar send button pressed, unfocusing keyboard")
        isFocused = false // Unfocus the text field
        onSend()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
      } label: {
        Image(systemName: "arrow.up")
          .font(.system(size: 16, weight: .bold))
          .frame(width: 34, height: 34)
          .background(Circle().fill(canSend ? Color.white : Color.white.opacity(0.18)))
          .foregroundStyle(.black)
      }
      .buttonStyle(.plain)
      .disabled(!canSend)
    }
    .padding(10)
    .background(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .fill(Color(white: 0.06).opacity(0.95))
    )
    .overlay(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

