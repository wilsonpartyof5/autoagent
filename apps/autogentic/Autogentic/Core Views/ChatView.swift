import SwiftUI

struct ChatView: View {
  @Binding var messages: [Message]
  @ObservedObject var mapVM: MapViewModel
  @ObservedObject var chatVM: ChatViewModel
  @Binding var chatMode: ChatMode
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
        VStack(spacing: 24) {
          // Mode icon
          Image(systemName: chatMode.icon)
            .font(.system(size: 40))
            .foregroundStyle(chatMode == .ask ? .yellow : .blue)
            .padding(.bottom, 4)
          
          // Primary headline
          Text(chatMode == .ask
               ? "Ask me which car fits your needs"
               : "Search real inventory near you")
            .font(.system(size: 22, weight: .bold))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
          
          // Mode explanation
          VStack(spacing: 6) {
            if chatMode == .ask {
              Text("Research mode")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.yellow.opacity(0.9))
              Text("Get advice on what to look for, compare options, and understand trade-offs — without searching inventory.")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.6))
                .multilineTextAlignment(.center)
            } else {
              Text("Shopping mode")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.blue.opacity(0.9))
              Text("Find available vehicles nearby. Describe what you want and I'll show you real listings on the map.")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.6))
                .multilineTextAlignment(.center)
            }
          }
          .padding(.horizontal, 36)
          
          // Example prompts as tappable chips
          VStack(spacing: 8) {
            Text("Try asking:")
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(Color.white.opacity(0.4))
            
            if chatMode == .ask {
              exampleChip("What's the best SUV for a family of 5?")
              exampleChip("Should I get a hybrid or full electric?")
              exampleChip("What should I budget for a reliable truck?")
            } else {
              exampleChip("Find 2025 F-150s near me")
              exampleChip("Black SUVs under $40k")
              exampleChip("Used Tacomas in Charlotte NC")
            }
          }
          .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
      }
    }
  }
  
  private func exampleChip(_ text: String) -> some View {
    Text(text)
      .font(.system(size: 13))
      .foregroundStyle(Color.white.opacity(0.7))
      .padding(.horizontal, 14)
      .padding(.vertical, 8)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(Color.white.opacity(0.08))
      )
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

