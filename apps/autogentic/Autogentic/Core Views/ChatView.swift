import SwiftUI

struct ChatView: View {
  @Binding var messages: [Message]
  @ObservedObject var mapVM: MapViewModel
  @ObservedObject var chatVM: ChatViewModel
  var onMapExpand: (() -> Void)? = nil

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 14) {
          introIfNeeded

          ForEach(messages) { message in
            MessageRow(message: message, mapVM: mapVM, chatVM: chatVM, onMapExpand: onMapExpand)
              .id(message.id)
          }
          
          // Loading indicator at bottom when searching
          if chatVM.isSearching {
            HStack {
              ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
              Text("Searching...")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.7))
              Spacer()
            }
            .padding(.vertical, 8)
            .id("__loading")
          }

          Color.clear
            .frame(height: 1)
            .id("__bottom")
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 16)
      }
      .onChange(of: messages) {
        withAnimation(.easeOut(duration: 0.22)) {
          proxy.scrollTo("__bottom", anchor: .bottom)
        }
      }
    }
  }

  private var introIfNeeded: some View {
    let hasUserMessage = messages.contains { $0.role == .user }

    return Group {
      if !hasUserMessage {
        VStack(spacing: 16) {
          // Primary title
          Text("Find the right car, faster.")
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
          
          // Secondary headline
          Text("We'll scan nearby inventory to find your next vehicle.")
            .font(.system(size: 15))
            .foregroundStyle(Color.white.opacity(0.70))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
      }
    }
  }
}

private struct MessageRow: View {
  let message: Message
  @ObservedObject var mapVM: MapViewModel
  var chatVM: ChatViewModel?
  var onMapExpand: (() -> Void)?

  var body: some View {
    switch message.role {
    case .user:
      HStack {
        Spacer(minLength: 40)
        bubble(text: message.text ?? "", isUser: true)
      }

    case .assistant:
      HStack {
        bubble(text: message.text ?? "", isUser: false)
        Spacer(minLength: 40)
      }

    case .tool:
      toolContent
    }
  }

  @ViewBuilder
  private var toolContent: some View {
    switch message.tool {
    case .map:
      MapToolView(mapVM: mapVM, chatVM: chatVM, onExpand: onMapExpand ?? { })
    case .none:
      HStack {
        Text("(Unknown tool)")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(Color.white.opacity(0.7))
        Spacer()
      }
    }
  }

  private func bubble(text: String, isUser: Bool) -> some View {
    Text(text)
      .font(.system(size: 16))
      .foregroundStyle(.white)
      .padding(.horizontal, 12)
      .padding(.vertical, 10)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(isUser ? Color(white: 0.18) : Color(white: 0.11))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(Color.white.opacity(0.06), lineWidth: 1)
      )
  }
}

