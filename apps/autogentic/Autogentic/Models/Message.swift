import Foundation

struct Message: Identifiable, Equatable {
  enum Role: String, Codable {
    case user
    case assistant
    case tool
  }

  enum ToolKind: String, Codable {
    case map
  }

  let id: String
  let role: Role
  let text: String?
  let tool: ToolKind?
  let createdAt: Date

  init(id: String = UUID().uuidString, role: Role, text: String? = nil, tool: ToolKind? = nil, createdAt: Date = Date()) {
    self.id = id
    self.role = role
    self.text = text
    self.tool = tool
    self.createdAt = createdAt
  }

  static func user(_ text: String) -> Message {
    Message(role: .user, text: text)
  }

  static func assistant(_ text: String) -> Message {
    Message(role: .assistant, text: text)
  }

  static func tool(_ kind: ToolKind) -> Message {
    Message(role: .tool, text: nil, tool: kind)
  }
}

