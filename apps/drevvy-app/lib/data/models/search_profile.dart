import 'package:equatable/equatable.dart';
import 'chat.dart';

/// Memory item kinds per spec §11.1
enum MemoryKind {
  budget,
  bodyTypes,
  makes,
  fuel,
  location,
  mustHaves,
}

extension MemoryKindX on MemoryKind {
  String get label => switch (this) {
    MemoryKind.budget => 'Budget',
    MemoryKind.bodyTypes => 'Body types',
    MemoryKind.makes => 'Makes',
    MemoryKind.fuel => 'Fuel',
    MemoryKind.location => 'Location',
    MemoryKind.mustHaves => 'Must-haves',
  };
}

/// Memory source per spec §11.1
enum MemorySource {
  explicit,
  inferred,
  onboarding,
}

/// A remembered preference item per spec §11.1
class MemoryItem extends Equatable {
  const MemoryItem({
    required this.id,
    required this.kind,
    required this.value,
    required this.source,
    required this.updatedAt,
    this.lastUsedAt,
  });

  final String id;
  final MemoryKind kind;
  final Object value;
  final MemorySource source;
  final DateTime updatedAt;
  final DateTime? lastUsedAt;

  bool get isInferred => source == MemorySource.inferred;

  String get displayValue {
    if (value is List) {
      return (value as List).join(', ');
    }
    if (kind == MemoryKind.budget && value is int) {
      return '\$${_formatNumber(value as int)}';
    }
    if (kind == MemoryKind.location && value is Map) {
      final map = value as Map;
      return '${map['zip']} · ${map['radius']} mi';
    }
    return value.toString();
  }

  String _formatNumber(int n) {
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  @override
  List<Object?> get props => [id, kind, value, source];

  MemoryItem copyWith({
    Object? value,
    MemorySource? source,
    DateTime? updatedAt,
    DateTime? lastUsedAt,
  }) {
    return MemoryItem(
      id: id,
      kind: kind,
      value: value ?? this.value,
      source: source ?? this.source,
      updatedAt: updatedAt ?? this.updatedAt,
      lastUsedAt: lastUsedAt ?? this.lastUsedAt,
    );
  }
}

/// A saved search per spec §11.1
class SavedSearch extends Equatable {
  const SavedSearch({
    required this.id,
    required this.filters,
    required this.lastRunAt,
    this.runCount = 1,
    this.seenListingIds = const {},
  });

  final String id;
  final SearchFilters filters;
  final DateTime lastRunAt;
  final int runCount;
  final Set<String> seenListingIds;

  String get displayTitle {
    final parts = <String>[];
    if (filters.makes.isNotEmpty) parts.add(filters.makes.first);
    if (filters.models.isNotEmpty) parts.add(filters.models.first);
    if (filters.priceMax != null) parts.add('under \$${filters.priceMax}');
    if (filters.zip != null && filters.radiusMi != null) {
      parts.add('${filters.radiusMi} mi of ${filters.zip}');
    }
    return parts.isEmpty ? 'Search' : parts.join(' · ');
  }

  @override
  List<Object?> get props => [id, filters, lastRunAt];
}

/// A viewed listing record per spec §11.1
class ViewedListing extends Equatable {
  const ViewedListing({
    required this.vin,
    required this.listingId,
    required this.priceAtView,
    required this.viewedAt,
  });

  final String vin;
  final String listingId;
  final int priceAtView;
  final DateTime viewedAt;

  @override
  List<Object?> get props => [vin, listingId, viewedAt];
}

/// Search profile per spec §11.1
class SearchProfile extends Equatable {
  const SearchProfile({
    required this.userId,
    this.personalize = true,
    this.items = const [],
    this.searches = const [],
    this.viewed = const [],
  });

  final String userId;
  final bool personalize;
  final List<MemoryItem> items;
  final List<SavedSearch> searches;
  final List<ViewedListing> viewed;

  @override
  List<Object?> get props => [userId, personalize, items];

  SearchProfile copyWith({
    bool? personalize,
    List<MemoryItem>? items,
    List<SavedSearch>? searches,
    List<ViewedListing>? viewed,
  }) {
    return SearchProfile(
      userId: userId,
      personalize: personalize ?? this.personalize,
      items: items ?? this.items,
      searches: searches ?? this.searches,
      viewed: viewed ?? this.viewed,
    );
  }
}

/// Starter card for personalized home screen per spec §6.14
enum StarterKind {
  backToSearch,
  priceDrops,
  newListings,
  fairPrice,
  generic,
}

class StarterCard extends Equatable {
  const StarterCard({
    required this.kind,
    required this.kicker,
    required this.title,
    required this.action,
  });

  final StarterKind kind;
  final String kicker;
  final String title;
  final StarterAction action;

  @override
  List<Object?> get props => [kind, title];
}

class StarterAction extends Equatable {
  const StarterAction({
    this.mode,
    this.filters,
    this.vin,
    this.prompt,
  });

  final String? mode;
  final SearchFilters? filters;
  final String? vin;
  final String? prompt;

  @override
  List<Object?> get props => [mode, filters, vin, prompt];
}
