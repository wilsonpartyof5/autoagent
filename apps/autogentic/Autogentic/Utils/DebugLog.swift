import Foundation

#if DEBUG
/// Debug logging helper with timestamps and tags
func debugLog(_ tag: String, _ message: String) {
  let timestamp = String(format: "%.3f", Date().timeIntervalSince1970)
  print("[\(tag)][\(timestamp)] \(message)")
}
#else
func debugLog(_ tag: String, _ message: String) {}
#endif

