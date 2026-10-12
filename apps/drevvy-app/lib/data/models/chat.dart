import 'package:equatable/equatable.dart';
import 'listing.dart';

enum ChatMode { ask, shop }

enum MessageRole { user, agent }

enum MessageContentType { text, listings, handoff, typing, error }

/// Chat thread per spec §11.1 (v1.6.1)
/// Deal-scoped chats use a separate DealThread model; this is for Ask/Shop chats only.
class ChatThread extends Equatable {
  const ChatThread({
    required this.id,
    required this.mode,
    this.userId,
    this.title,
    this.messages = const [],
    this.sourcesCount,
    this.createdAt,
    this.updatedAt,
    this.lastFilters,
    this.usedMemory = false,
  });

  final String id;
  final String? userId;
  final String? title;
  final ChatMode mode;
  final List<ChatMessage> messages;
  final int? sourcesCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final SearchFilters? lastFilters;
  final bool usedMemory;

  bool get isEmpty => messages.isEmpty;
  
  /// Auto-generate title from first user message (≤40 chars) per spec §6.13
  String get displayTitle {
    if (title != null && title!.isNotEmpty) return title!;
    final firstUserMsg = messages.cast<ChatMessage?>().firstWhere(
      (m) => m?.role == MessageRole.user && m?.text != null,
      orElse: () => null,
    );
    if (firstUserMsg?.text != null) {
      final text = firstUserMsg!.text!;
      return text.length > 40 ? '${text.substring(0, 37)}...' : text;
    }
    return mode == ChatMode.ask ? 'New chat' : 'Search';
  }

  @override
  List<Object?> get props => [id, mode, messages, title, createdAt];

  ChatThread copyWith({
    String? userId,
    String? title,
    ChatMode? mode,
    List<ChatMessage>? messages,
    int? sourcesCount,
    DateTime? createdAt,
    DateTime? updatedAt,
    SearchFilters? lastFilters,
    bool? usedMemory,
  }) {
    return ChatThread(
      id: id,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      mode: mode ?? this.mode,
      messages: messages ?? this.messages,
      sourcesCount: sourcesCount ?? this.sourcesCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      lastFilters: lastFilters ?? this.lastFilters,
      usedMemory: usedMemory ?? this.usedMemory,
    );
  }
}

/// Search filters per spec §11.1
class SearchFilters extends Equatable {
  const SearchFilters({
    this.makes = const [],
    this.models = const [],
    this.trims = const [],
    this.yearMin,
    this.yearMax,
    this.priceMax,
    this.milesMax,
    this.zip,
    this.radiusMi,
    this.bodyTypes = const [],
    this.fuel = const [],
    this.drivetrain = const [],
    this.condition,
  });

  final List<String> makes;
  final List<String> models;
  final List<String> trims;
  final int? yearMin;
  final int? yearMax;
  final int? priceMax;
  final int? milesMax;
  final String? zip;
  final int? radiusMi;
  final List<String> bodyTypes;
  final List<String> fuel;
  final List<String> drivetrain;
  final String? condition;

  @override
  List<Object?> get props => [makes, models, priceMax, zip, radiusMi];
}

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.contentType,
    this.chatId,
    this.text,
    this.listings,
    this.handoff,
    this.timestamp,
    this.memoryItemIds = const [],
  });

  final String id;
  final String? chatId;
  final MessageRole role;
  final MessageContentType contentType;
  final String? text;
  final List<Listing>? listings;
  final ChatHandoff? handoff;
  final DateTime? timestamp;
  /// IDs of memory items used to generate this message (v1.6.1)
  final List<String> memoryItemIds;

  bool get isUser => role == MessageRole.user;
  bool get isAgent => role == MessageRole.agent;
  bool get isTyping => contentType == MessageContentType.typing;
  /// Whether this message used past searches/memory per spec §6.14
  bool get usedMemory => memoryItemIds.isNotEmpty;

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
