import '../models/chat.dart';

/// Allow-listed Discover search filters from `docs/discover-public-api.md`.
///
/// ZIP is not a filter. The server rejects it. Coordinates live on the request,
/// not in this object.
class DiscoverFilters {
  const DiscoverFilters({
    this.make,
    this.model,
    this.trim,
    this.yearMin,
    this.yearMax,
    this.priceMin,
    this.priceMax,
    this.milesMax,
    this.condition,
    this.bodyType,
    this.radiusMiles = 25,
  });

  static const bodyTypes = <String>[
    'Pickup',
    'SUV',
    'Sedan',
    'Minivan',
    'Cargo Van',
    'Passenger Van',
    'Coupe',
    'Hatchback',
    'Wagon',
    'Convertible',
  ];

  static const conditions = <String>['new', 'used', 'certified'];

  final String? make;
  final String? model;
  final String? trim;
  final int? yearMin;
  final int? yearMax;
  final int? priceMin;
  final int? priceMax;
  final int? milesMax;
  final String? condition;
  final String? bodyType;
  final int radiusMiles;

  DiscoverFilters copyWith({
    String? make,
    String? model,
    String? trim,
    int? yearMin,
    int? yearMax,
    int? priceMin,
    int? priceMax,
    int? milesMax,
    String? condition,
    String? bodyType,
    int? radiusMiles,
    bool clearModel = false,
    bool clearTrim = false,
    bool clearMake = false,
  }) {
    return DiscoverFilters(
      make: clearMake ? null : make ?? this.make,
      model: clearModel ? null : model ?? this.model,
      trim: clearTrim ? null : trim ?? this.trim,
      yearMin: yearMin ?? this.yearMin,
      yearMax: yearMax ?? this.yearMax,
      priceMin: priceMin ?? this.priceMin,
      priceMax: priceMax ?? this.priceMax,
      milesMax: milesMax ?? this.milesMax,
      condition: condition ?? this.condition,
      bodyType: bodyType ?? this.bodyType,
      radiusMiles: radiusMiles ?? this.radiusMiles,
    );
  }

  /// Shop composer text becomes make + model. It does not invent coordinates.
  DiscoverFilters withQuery(String query) {
    final text = query.trim();
    if (text.isEmpty) return this;
    final parts = text.split(RegExp(r'\s+'));
    return copyWith(
      make: parts.first,
      model: parts.length > 1 ? parts.sublist(1).join(' ') : null,
      clearModel: parts.length == 1,
    );
  }

  /// Maps a saved demo filter onto the public contract. ZIP is dropped.
  factory DiscoverFilters.fromSearchFilters(SearchFilters filters) {
    String? first(List<String> values) {
      for (final value in values) {
        final trimmed = value.trim();
        if (trimmed.isNotEmpty) return trimmed;
      }
      return null;
    }

    final body = first(filters.bodyTypes);
    final condition = filters.condition?.trim().toLowerCase();
    final radius = filters.radiusMi;
    return DiscoverFilters(
      make: first(filters.makes),
      model: first(filters.models),
      trim: first(filters.trims),
      yearMin: filters.yearMin,
      yearMax: filters.yearMax,
      priceMax: filters.priceMax,
      milesMax: filters.milesMax,
      condition: conditions.contains(condition) ? condition : null,
      bodyType: bodyTypes.contains(body) ? body : null,
      radiusMiles: radius == null ? 25 : radius.clamp(5, 50),
    );
  }

  String? validate({DateTime? now}) {
    final yearCap = (now ?? DateTime.now()).year + 1;
    if (radiusMiles < 5 || radiusMiles > 50) {
      return 'Radius must be between 5 and 50 miles.';
    }
    String? range(String label, int? value, int min, int max) {
      if (value == null) return null;
      if (value < min || value > max) {
        return '$label must be between $min and $max.';
      }
      return null;
    }

    final priceMinError = range('Minimum price', priceMin, 0, 500000);
    if (priceMinError != null) return priceMinError;
    final priceMaxError = range('Maximum price', priceMax, 0, 500000);
    if (priceMaxError != null) return priceMaxError;
    if (priceMin != null && priceMax != null && priceMin! > priceMax!) {
      return 'Minimum price cannot be above the maximum.';
    }
    final milesError = range('Maximum miles', milesMax, 0, 400000);
    if (milesError != null) return milesError;
    final yearMinError = range('Start year', yearMin, 1990, yearCap);
    if (yearMinError != null) return yearMinError;
    final yearMaxError = range('End year', yearMax, 1990, yearCap);
    if (yearMaxError != null) return yearMaxError;
    if (yearMin != null && yearMax != null && yearMin! > yearMax!) {
      return 'The start year cannot be after the end year.';
    }
    if (condition != null && !conditions.contains(condition)) {
      return 'That condition is not supported.';
    }
    if (bodyType != null && !bodyTypes.contains(bodyType)) {
      return 'That body type is not supported.';
    }
    for (final name in [make, model, trim]) {
      if (name != null && name.trim().length > 40) {
        return 'Make, model, and trim must be 40 characters or fewer.';
      }
    }
    return null;
  }

  Map<String, Object> toJson() {
    final filters = <String, Object>{};
    void putString(String key, String? value) {
      final trimmed = value?.trim();
      if (trimmed == null || trimmed.isEmpty) return;
      filters[key] = trimmed;
    }

    putString('make', make);
    putString('model', model);
    putString('trim', trim);
    if (yearMin != null) filters['year_min'] = yearMin!;
    if (yearMax != null) filters['year_max'] = yearMax!;
    if (priceMin != null) filters['price_min'] = priceMin!;
    if (priceMax != null) filters['price_max'] = priceMax!;
    if (milesMax != null) filters['miles_max'] = milesMax!;
    putString('condition', condition);
    putString('body_type', bodyType);
    return filters;
  }
}
