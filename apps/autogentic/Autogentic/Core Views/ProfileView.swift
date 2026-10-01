import AuthenticationServices
import SwiftUI

struct ProfileView: View {
  @EnvironmentObject private var auth: ConsumerAuthStore
  @State private var pendingNonce = ""

  var body: some View {
    VStack(spacing: 18) {
      Spacer()
      if let session = auth.session {
        Text("Signed in")
          .font(.system(size: 26, weight: .bold))
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
      } else {
        Text("Profile")
          .font(.system(size: 26, weight: .bold))
          .foregroundStyle(.white)
        Text("Sign in to save vehicles and open deals. Vehicle search stays available without an account.")
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
      }
      if let message = auth.message {
        Text(message)
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.8))
          .multilineTextAlignment(.center)
          .padding(.horizontal, 28)
      }
      Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.opacity(0.92))
    .task {
      await auth.loadProfile()
    }
  }
}
