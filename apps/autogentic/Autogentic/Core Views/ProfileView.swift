import AuthenticationServices
import SwiftUI

struct ProfileView: View {
  @EnvironmentObject private var auth: ConsumerAuthStore
  @EnvironmentObject private var deals: DealsStore
  @State private var pendingNonce = ""

  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        if let session = auth.session {
          signedInContent(session: session)
          
          // My Deals section
          MyDealsView()
            .padding(.horizontal, 16)
            .padding(.top, 8)
        } else {
          Spacer(minLength: 60)
          signedOutContent
          Spacer(minLength: 60)
        }
        
        if let message = auth.message {
          Text(message)
            .font(.system(size: 14))
            .foregroundStyle(Color.white.opacity(0.8))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 28)
        }
      }
      .padding(.vertical, 24)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.opacity(0.92))
    .task {
      await auth.loadProfile()
    }
  }

  @ViewBuilder
  private func signedInContent(session: ConsumerSession) -> some View {
    Image(systemName: "person.crop.circle.fill.badge.checkmark")
      .font(.system(size: 56))
      .foregroundStyle(Color.green.opacity(0.9))
    
    Text("Signed in")
      .font(.system(size: 26, weight: .bold))
      .foregroundStyle(.white)
    
    if let profile = auth.profile {
      VStack(spacing: 8) {
        if let status = profile.status {
          HStack(spacing: 6) {
            Circle()
              .fill(status == "active" ? Color.green : Color.orange)
              .frame(width: 8, height: 8)
            Text(status.capitalized)
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(Color.white.opacity(0.8))
          }
          .padding(.horizontal, 12)
          .padding(.vertical, 6)
          .background(Capsule().fill(Color.white.opacity(0.12)))
        }
      }
    } else if auth.isWorking {
      ProgressView()
        .tint(.white)
    }
    
    VStack(spacing: 8) {
      Text("Drevvy will negotiate the best out-the-door price for you.")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))
        .multilineTextAlignment(.center)
        .padding(.horizontal, 28)
    }
    .padding(.top, 8)
    
    Button {
      Task { await auth.signOut() }
    } label: {
      HStack(spacing: 8) {
        if auth.isWorking {
          ProgressView()
            .tint(.white)
            .scaleEffect(0.8)
        }
        Text("Sign out")
          .font(.system(size: 16, weight: .semibold))
      }
      .foregroundStyle(.white)
      .padding(.horizontal, 24)
      .padding(.vertical, 12)
      .background(
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .stroke(Color.white.opacity(0.3), lineWidth: 1)
      )
    }
    .disabled(auth.isWorking)
    .padding(.top, 12)
  }

  private var signedOutContent: some View {
    VStack(spacing: 18) {
      Image(systemName: "person.crop.circle")
        .font(.system(size: 56))
        .foregroundStyle(Color.white.opacity(0.4))
      
      Text("Profile")
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(.white)
      
      Text("Sign in to save vehicles and get the best out-the-door prices. Vehicle search stays available without an account.")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))
        .multilineTextAlignment(.center)
        .padding(.horizontal, 28)
      
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
      .padding(.horizontal, 28)
      .disabled(auth.isWorking)
      
      if auth.isWorking {
        ProgressView()
          .tint(.white)
      }
    }
  }
}
