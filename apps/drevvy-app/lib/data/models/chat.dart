import 'package:equatable/equatable.dart';
import 'listing.dart';

enum ChatMode { ask, shop }

enum MessageRole { user, agent }

enum MessageContentType { text, listings, handoff, typing, error }

class ChatThread extends Equatable {
  const ChatThread({
    required this.id,
    required this.mode,
    this.messages = const [],
    this.sourcesCount,
  });

  final String id;
  final ChatMode mode;
  final List<ChatMessage> messages;
  final int? sourcesCount;

  bool get isEmpty => messages.isEmpty;

  @override
  List<Object?> get props => [id, mode, messages];

  ChatThread copyWith({
    ChatMode? mode,
    List<ChatMessage>? messages,
    int? sourcesCount,
  }) {
    return ChatThread(
      id: id,
      mode: mode ?? this.mode,
      messages: messages ?? this.messages,
      sourcesCount: sourcesCount ?? this.sourcesCount,
    );
  }
}

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.contentType,
    this.text,
    this.listings,
    this.handoff,
    this.timestamp,
  });

  final String id;
  final MessageRole role;
  final MessageContentType contentType;
  final String? text;
  final List<Listing>? listings;
  final ChatHandoff? handoff;
  final DateTime? timestamp;

  bool get isUser => role == MessageRole.user;
  bool get isAgent => role == MessageRole.agent;
  bool get isTyping => contentType == MessageContentType.typing;

  @override
  List<Object?> get props => [id, role, contentType];
}

class ChatHandoff extends Equatable {
  const ChatHandoff({
    required this.query,
    required this.listingsCount,
    this.filters,
  });

  final String query;
  final int listingsCount;
  final Map<String, dynamic>? filters;

  @override
  List<Object?> get props => [query, listingsCount];
}

class SourceInfo extends Equatable {
  const SourceInfo({
    required this.name,
    required this.description,
    this.count,
  });

  final String name;
  final String description;
  final int? count;

  @override
  List<Object?> get props => [name];
}
