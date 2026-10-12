import SwiftUI

struct ChatHistoryDrawer: View {
  @ObservedObject var demoStore: DemoDataStore
  @Binding var isOpen: Bool
  @State private var searchText: String = ""
  var onChatSelected: (ChatThread) -> Void
  var onNewChat: () -> Void
  
  private var filteredChats: [ChatThread] {
    if searchText.isEmpty {
      return demoStore.chatThreads
    }
    let query = searchText.lowercased()
    return demoStore.chatThreads.filter { chat in
      chat.title.lowercased().contains(query)
    }
  }
  
  private var groupedChats: [(String, [ChatThread])] {
    let now = Date()
    let calendar = Calendar.current
    
    var today: [ChatThread] = []
    var yesterday: [ChatThread] = []
    var lastWeek: [ChatThread] = []
    var lastMonth: [ChatThread] = []
    var older: [String: [ChatThread]] = [:]
    
    for chat in filteredChats {
      let daysDiff = calendar.dateComponents([.day], from: chat.updatedAt, to: now).day ?? 0
      
      if calendar.isDateInToday(chat.updatedAt) {
        today.append(chat)
      } else if calendar.isDateInYesterday(chat.updatedAt) {
        yesterday.append(chat)
      } else if daysDiff <= 7 {
        lastWeek.append(chat)
      } else if daysDiff <= 30 {
        lastMonth.append(chat)
      } else {
        let monthKey = chat.updatedAt.formatted(.dateTime.month(.wide).year())
        older[monthKey, default: []].append(chat)
      }
    }
    
    var result: [(String, [ChatThread])] = []
    if !today.isEmpty { result.append(("Today", today)) }
    if !yesterday.isEmpty { result.append(("Yesterday", yesterday)) }
    if !lastWeek.isEmpty { result.append(("Last 7 days", lastWeek)) }
    if !lastMonth.isEmpty { result.append(("Last 30 days", lastMonth)) }
    for (month, chats) in older.sorted(by: { $0.key > $1.key }) {
      result.append((month, chats))
    }
    return result
  }
  
  var body: some View {
    GeometryReader { geo in
      HStack(spacing: 0) {
        VStack(alignment: .leading, spacing: 0) {
          header
          searchField
          newChatButton
          
          if filteredChats.isEmpty {
            emptyState
          } else {
            chatList
          }
          
          Spacer()
          footer
        }
        .frame(width: min(318, geo.size.width * 0.85))
        .background(
          UnevenRoundedRectangle(
            cornerRadii: .init(topLeading: 0, bottomLeading: 0, bottomTrailing: 28, topTrailing: 28)
          )
          .fill(Color(white: 0.08))
          .ignoresSafeArea()
        )
        
        Spacer()
      }
    }
  }
  
  private var header: some View {
    HStack {
      Text("Chats")
        .font(.system(size: 24, weight: .bold))
        .foregroundStyle(.white)
      Spacer()
      Button {
        withAnimation(.easeOut(duration: 0.2)) {
          isOpen = false
        }
      } label: {
        Image(systemName: "xmark")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(Color.white.opacity(0.6))
          .frame(width: 32, height: 32)
      }
    }
    .padding(.horizontal, 16)
    .padding(.top, 60)
    .padding(.bottom, 16)
  }
  
  private var searchField: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.4))
      
      TextField("Search chats", text: $searchText)
        .font(.system(size: 15))
        .foregroundStyle(.white)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.white.opacity(0.06))
    )
    .padding(.horizontal, 16)
    .padding(.bottom, 12)
  }
  
  private var newChatButton: some View {
    Button {
      onNewChat()
      withAnimation(.easeOut(duration: 0.2)) {
        isOpen = false
      }
    } label: {
      HStack(spacing: 10) {
        Image(systemName: "plus")
          .font(.system(size: 15, weight: .semibold))
        Text("New chat")
          .font(.system(size: 16, weight: .medium))
        Spacer()
      }
      .foregroundStyle(.white)
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(Color.white.opacity(0.08))
      )
    }
    .padding(.horizontal, 16)
    .padding(.bottom, 16)
  }
  
  private var chatList: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 0) {
        ForEach(groupedChats, id: \.0) { group in
          Text(group.0)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.white.opacity(0.5))
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 8)
          
          ForEach(group.1) { chat in
            ChatHistoryRow(chat: chat)
              .onTapGesture {
                onChatSelected(chat)
                withAnimation(.easeOut(duration: 0.2)) {
                  isOpen = false
                }
              }
          }
        }
      }
    }
  }
  
  private var emptyState: some View {
    VStack(spacing: 12) {
      Spacer()
      Image(systemName: "bubble.left.and.bubble.right")
        .font(.system(size: 40))
        .foregroundStyle(Color.white.opacity(0.2))
      Text("No chats yet")
        .font(.system(size: 17, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.6))
      Text("Your conversations will show up here.")
        .font(.system(size: 14))
        .foregroundStyle(Color.white.opacity(0.4))
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
      Spacer()
    }
    .frame(maxWidth: .infinity)
  }
  
  private var footer: some View {
    Text("Chats about a car you added live in that deal, under Deals.")
      .font(.system(size: 12))
      .foregroundStyle(Color.white.opacity(0.4))
      .multilineTextAlignment(.leading)
      .padding(.horizontal, 16)
      .padding(.bottom, 24)
  }
}

struct ChatHistoryRow: View {
  let chat: ChatThread
  
  private var timeString: String {
    let formatter = DateFormatter()
    if Calendar.current.isDateInToday(chat.updatedAt) {
      formatter.dateFormat = "h:mm a"
    } else {
      formatter.dateFormat = "MMM d"
    }
    return formatter.string(from: chat.updatedAt)
  }
  
  private var modeIcon: String {
    chat.mode == .ask ? "sparkle" : "text.bubble"
  }
  
  private var modeLabel: String {
    chat.mode == .ask ? "Ask" : "Shop"
  }
  
  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: modeIcon)
        .font(.system(size: 14))
        .foregroundStyle(Color(red: 0.55, green: 0.55, blue: 1.0))
        .frame(width: 24, height: 24)
      
      VStack(alignment: .leading, spacing: 4) {
        Text(chat.title)
          .font(.system(size: 15, weight: .medium))
          .foregroundStyle(.white)
          .lineLimit(1)
        
        HStack(spacing: 4) {
          Text(modeLabel)
            .font(.system(size: 13))
            .foregroundStyle(Color.white.opacity(0.5))
          Text("·")
            .foregroundStyle(Color.white.opacity(0.5))
          Text(timeString)
            .font(.system(size: 13))
            .foregroundStyle(Color.white.opacity(0.5))
        }
      }
      
      Spacer()
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 10)
    .contentShape(Rectangle())
  }
}
