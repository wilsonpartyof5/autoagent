import Foundation
import Security

enum KeychainSessionStore {
  private static let service = "drevvy.consumer.session"
  private static let account = "session"

  static func load() -> ConsumerSession? {
    var query = baseQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data else { return nil }
    return try? JSONDecoder().decode(ConsumerSession.self, from: data)
  }

  static func save(_ session: ConsumerSession) {
    guard let data = try? JSONEncoder().encode(session) else { return }
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    let status = SecItemUpdate(baseQuery() as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      var insert = baseQuery()
      insert[kSecValueData as String] = data
      insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      SecItemAdd(insert as CFDictionary, nil)
    }
  }

  static func delete() {
    SecItemDelete(baseQuery() as CFDictionary)
  }

  private static func baseQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }
}
