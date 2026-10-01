import Foundation

struct ConsumerSession: Codable, Equatable {
  var accessToken: String
  var refreshToken: String
  var expiresAt: Date?
  var consumerUserId: String

  var isNearExpiry: Bool {
    guard let expiresAt else { return false }
    return expiresAt.timeIntervalSinceNow < 60
  }
}

struct ConsumerProfile: Decodable, Equatable {
  var consumerUserId: String
  var status: String?
  var createdAt: String?
  var updatedAt: String?
}

@MainActor
final class ConsumerAuthStore: ObservableObject {
  @Published private(set) var session: ConsumerSession?
  @Published private(set) var profile: ConsumerProfile?
  @Published private(set) var isWorking = false
  @Published var message: String?

  var isSignedIn: Bool { session != nil }

  init() {
    session = KeychainSessionStore.load()
  }

  func restoreSessionIfNeeded() async {
    guard session != nil else { return }
    await loadProfile()
  }

  func signIn(identityToken: String, nonce: String) async {
    isWorking = true
    message = nil
    profile = nil
    defer { isWorking = false }
    do {
      let session = try await requestSession(
        path: ["auth", "apple"],
        body: ["identityToken": identityToken, "nonce": nonce]
      )
      store(session)
      message = nil
      await loadProfile()
    } catch {
      session = nil
      KeychainSessionStore.delete()
      message = error.localizedDescription
    }
  }

  func refreshIfNeeded() async {
    guard let current = session, current.isNearExpiry else { return }
    do {
      let refreshed = try await requestSession(
        path: ["auth", "refresh"],
        body: ["refreshToken": current.refreshToken]
      )
      store(refreshed)
    } catch let error as ConsumerAuthFailure where error.isUnauthorized {
      session = nil
      profile = nil
      KeychainSessionStore.delete()
      message = "Your session has expired. Please sign in again."
    } catch {
      message = error.localizedDescription
    }
  }

  func loadProfile() async {
    await refreshIfNeeded()
    guard let current = session else {
      profile = nil
      return
    }
    do {
      var request = URLRequest(url: endpoint("profile"))
      request.httpMethod = "GET"
      request.setValue("Bearer \(current.accessToken)", forHTTPHeaderField: "Authorization")
      let (data, response) = try await URLSession.shared.data(for: request)
      try throwIfNeeded(data: data, response: response)
      let decoded = try JSONDecoder().decode(ProfileEnvelope.self, from: data)
      profile = decoded.data
    } catch let error as ConsumerAuthFailure where error.isUnauthorized {
      session = nil
      profile = nil
      KeychainSessionStore.delete()
      message = "Your session has expired. Please sign in again."
    } catch {
      message = error.localizedDescription
    }
  }

  func signOut() async {
    let current = session
    session = nil
    profile = nil
    KeychainSessionStore.delete()
    message = nil
    guard let current else { return }
    var request = URLRequest(url: endpoint("auth", "signout"))
    request.httpMethod = "POST"
    request.setValue("Bearer \(current.accessToken)", forHTTPHeaderField: "Authorization")
    _ = try? await URLSession.shared.data(for: request)
  }

  private func store(_ session: ConsumerSession) {
    self.session = session
    KeychainSessionStore.save(session)
  }

  private func endpoint(_ components: String...) -> URL {
    components.reduce(Config.consumerAuthBaseURL) { url, component in
      url.appending(path: component)
    }
  }

  private func requestSession(path: [String], body: [String: String]) async throws -> ConsumerSession {
    var request = URLRequest(url: path.reduce(Config.consumerAuthBaseURL) { url, component in
      url.appending(path: component)
    })
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await URLSession.shared.data(for: request)
    try throwIfNeeded(data: data, response: response)
    let decoded = try JSONDecoder().decode(SessionEnvelope.self, from: data)
    return ConsumerSession(
      accessToken: decoded.data.accessToken,
      refreshToken: decoded.data.refreshToken,
      expiresAt: decoded.data.expiresAt.map { Date(timeIntervalSince1970: $0) },
      consumerUserId: decoded.data.consumerUserId
    )
  }

  private func throwIfNeeded(data: Data, response: URLResponse) throws {
    guard let http = response as? HTTPURLResponse else {
      throw ConsumerAuthFailure(message: "Network error. Please try again.", statusCode: nil)
    }
    guard (200..<300).contains(http.statusCode) else {
      let errorEnvelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
      let message = errorEnvelope?.error.message ?? "Drevvy could not finish sign-in."
      throw ConsumerAuthFailure(message: message, statusCode: http.statusCode)
    }
  }
}

// MARK: - Response Envelopes

private struct SessionEnvelope: Decodable {
  struct DataBody: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Double?
    let consumerUserId: String
  }
  let data: DataBody
}

private struct ProfileEnvelope: Decodable {
  let data: ConsumerProfile
}

private struct ErrorEnvelope: Decodable {
  struct Detail: Decodable { let message: String }
  let error: Detail
}

private struct ConsumerAuthFailure: LocalizedError {
  let message: String
  let statusCode: Int?
  
  var errorDescription: String? { message }
  
  var isUnauthorized: Bool {
    statusCode == 401 || statusCode == 403
  }
}
