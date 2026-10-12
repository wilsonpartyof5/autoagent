import AuthenticationServices
import SwiftUI

struct ProfileView: View {
  @EnvironmentObject private var auth: ConsumerAuthStore
  @ObservedObject var demoStore: DemoDataStore = .shared
  @State private var pendingNonce = ""
  @State private var showClearHistoryConfirm = false
  @State private var deletedItemId: String?
  @State private var undoWorkItem: DispatchWorkItem?

  var body: some View {
    ScrollView {
      VStack(spacing: 0) {
        searchProfileSection
        
        divider
        
        accountSection
        
        divider
        
        demoSection
      }
      .padding(.bottom, 40)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.opacity(0.92))
    .task {
      await auth.loadProfile()
    }
  }
  
  private var divider: some View {
    Rectangle()
      .fill(Color.white.opacity(0.08))
      .frame(height: 1)
      .padding(.vertical, 24)
  }
  
  private var searchProfileSection: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Your search profile")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
        .padding(.top, 24)
      
      personalizeToggle
      
      if demoStore.searchProfile.personalize {
        memoryItemsList
        recentSearchesList
        clearHistoryButton
      }
    }
    .padding(.horizontal, 20)
  }
  
  private var personalizeToggle: some View {
    HStack {
      VStack(alignment: .leading, spacing: 4) {
        Text("Personalize with my history")
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(.white)
        Text("Use your searches to suggest relevant cars")
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.5))
      }
      
      Spacer()
      
      Toggle("", isOn: .constant(demoStore.searchProfile.personalize))
        .labelsHidden()
        .tint(Color(red: 0.45, green: 0.45, blue: 0.85))
    }
    .padding(16)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.white.opacity(0.06))
    )
  }
  
  private var memoryItemsList: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(demoStore.searchProfile.items.filter { $0.id != deletedItemId }) { item in
        MemoryItemEditRow(item: item, onDelete: {
          deleteMemoryItem(item)
        })
      }
    }
  }
  
  private func deleteMemoryItem(_ item: MemoryItem) {
    undoWorkItem?.cancel()
    deletedItemId = item.id
    
    let workItem = DispatchWorkItem { [self] in
      deletedItemId = nil
    }
    undoWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: workItem)
  }
  
  private var recentSearchesList: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Recent searches")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.6))
        .padding(.top, 8)
      
      ForEach(demoStore.searchProfile.searches) { search in
        HStack {
          VStack(alignment: .leading, spacing: 4) {
            Text(search.displayTitle)
              .font(.system(size: 15, weight: .medium))
              .foregroundStyle(.white)
              .lineLimit(1)
            Text("Run \(search.runCount) times")
              .font(.system(size: 13))
              .foregroundStyle(Color.white.opacity(0.5))
          }
          
          Spacer()
          
          Button {
            // Run search
          } label: {
            Image(systemName: "play.fill")
              .font(.system(size: 14))
              .foregroundStyle(Color(red: 0.45, green: 0.45, blue: 0.85))
          }
          
          Button {
            // Delete search
          } label: {
            Image(systemName: "trash")
              .font(.system(size: 14))
              .foregroundStyle(Color.red.opacity(0.8))
          }
          .padding(.leading, 8)
        }
        .padding(14)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color.white.opacity(0.06))
        )
      }
    }
  }
  
  private var clearHistoryButton: some View {
    Button {
      showClearHistoryConfirm = true
    } label: {
      Text("Clear history")
        .font(.system(size: 16, weight: .medium))
        .foregroundStyle(.red)
    }
    .padding(.top, 8)
    .alert("Clear your history?", isPresented: $showClearHistoryConfirm) {
      Button("Cancel", role: .cancel) {}
      Button("Clear", role: .destructive) {
        // POST /me/history:clear
      }
    } message: {
      Text("Clear your chat history and search profile? Deals and offers are not affected.")
    }
  }
  
  private var accountSection: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Account")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
        .padding(.horizontal, 20)
      
      if let session = auth.session {
        VStack(spacing: 12) {
          Text("Signed in")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
          Text(session.consumerUserId)
            .font(.system(size: 13, design: .monospaced))
            .foregroundStyle(Color.white.opacity(0.7))
            .textSelection(.enabled)
          if let status = auth.profile?.status {
            Text(status.capitalized)
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(Color.white.opacity(0.8))
          }
          Button("Sign out") {
            Task { await auth.signOut() }
          }
          .buttonStyle(.borderedProminent)
          .tint(.white)
          .foregroundStyle(.black)
          .disabled(auth.isWorking)
        }
        .padding(.horizontal, 20)
      } else {
        VStack(spacing: 12) {
          Text("Sign in to save vehicles and open deals. Vehicle search stays available without an account.")
            .font(.system(size: 15))
            .foregroundStyle(Color.white.opacity(0.7))
            .multilineTextAlignment(.center)
          
          SignInWithAppleButton(.signIn) { request in
            let nonce = AppleNonce.random()
            pendingNonce = nonce
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleNonce.sha256(nonce)
          } onCompletion: { result in
            switch result {
            case .success(let authorization):
              guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let identityToken = String(data: tokenData, encoding: .utf8)
              else {
                auth.message = "Apple did not return a sign-in token."
                return
              }
              let nonce = pendingNonce
              Task { await auth.signIn(identityToken: identityToken, nonce: nonce) }
            case .failure:
              auth.message = "Apple sign-in was canceled."
            }
          }
          .signInWithAppleButtonStyle(.white)
          .frame(height: 48)
          .disabled(auth.isWorking)
        }
        .padding(.horizontal, 20)
      }
      
      if let message = auth.message {
        Text(message)
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.8))
          .multilineTextAlignment(.center)
          .padding(.horizontal, 20)
      }
    }
  }
  
  private var demoSection: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Demo Settings")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
        .padding(.horizontal, 20)
      
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("First-run mode")
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(.white)
          Text("Show generic starters instead of personalized")
            .font(.system(size: 13))
            .foregroundStyle(Color.white.opacity(0.5))
        }
        
        Spacer()
        
        Toggle("", isOn: Binding(
          get: { demoStore.isFirstRun },
          set: { demoStore.setFirstRun($0) }
        ))
        .labelsHidden()
        .tint(Color(red: 0.45, green: 0.45, blue: 0.85))
      }
      .padding(16)
      .padding(.horizontal, 4)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(Color.white.opacity(0.06))
      )
      .padding(.horizontal, 20)
    }
  }
}

struct MemoryItemEditRow: View {
  let item: MemoryItem
  let onDelete: () -> Void
  
  private var iconName: String {
    switch item.kind {
    case .budget: return "dollarsign.circle"
    case .bodyTypes: return "car.fill"
    case .makes: return "building.2"
    case .fuel: return "fuelpump.fill"
    case .location: return "mappin.circle"
    case .mustHaves: return "checkmark.circle"
    }
  }
  
  var body: some View {
    HStack(spacing: 14) {
      Image(systemName: iconName)
        .font(.system(size: 18))
        .foregroundStyle(Color(red: 0.55, green: 0.55, blue: 1.0))
        .frame(width: 28)
      
      VStack(alignment: .leading, spacing: 4) {
        Text(item.kind.rawValue)
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.5))
        Text(item.value)
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(.white)
      }
      
      Spacer()
      
      Button {
        // Edit item
      } label: {
        Image(systemName: "pencil")
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.5))
      }
      
      Button {
        onDelete()
      } label: {
        Image(systemName: "trash")
          .font(.system(size: 14))
          .foregroundStyle(Color.red.opacity(0.8))
      }
      .padding(.leading, 4)
    }
    .padding(14)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color.white.opacity(0.06))
    )
  }
}
