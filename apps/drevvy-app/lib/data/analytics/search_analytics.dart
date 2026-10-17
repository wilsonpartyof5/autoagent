import '../models/chat.dart';

const vehicleCategories = <String>{
  'suv',
  'sedan',
  'truck',
  'van',
  'minivan',
  'coupe',
  'hatchback',
  'wagon',
  'convertible',
  'electric',
  'hybrid',
  'diesel',
  'cpo',
  'used',
  'new',
  'luxury',
};

/// Search properties with no raw query, name, email, phone, or address.
Map<String, Object> searchEventProperties({
  required String surface,
  required String query,
  String source = 'composer',
  SearchFilters? filters,
}) {
  return {
    'surface': surface,
    'source': source,
    'query_length': query.trim().length,
    'query_category': queryCategory(query),
    ...filterEventProperties(filters),
  };
}

String queryCategory(String query) {
  final lower = query.toLowerCase();
  final hits = <String>[];
  for (final category in vehicleCategories) {
    if (RegExp('\\b$category\\b').hasMatch(lower)) hits.add(category);
  }
  if (RegExp(r'\bpickups?\b').hasMatch(lower) && !hits.contains('truck')) {
    hits.add('truck');
  }
  if (hits.isEmpty) return 'unspecified';
  return hits.take(3).join(',');
}

Map<String, Object> filterEventProperties(SearchFilters? filters) {
  if (filters == null) return const {'has_filters': false};
  final bodies = filters.bodyTypes
      .map((value) => value.trim().toLowerCase())
      .where(vehicleCategories.contains)
      .take(4)
      .toList();
  final condition = filters.condition?.trim().toLowerCase();
  return {
    'has_filters': _hasFilters(filters),
    'make_count': filters.makes.length,
    'model_count': filters.models.length,
    'body_count': filters.bodyTypes.length,
    if (bodies.isNotEmpty) 'body_types': bodies.join(','),
    'fuel_count': filters.fuel.length,
    'has_price_max': filters.priceMax != null,
    'has_year': filters.yearMin != null || filters.yearMax != null,
    'has_miles_max': filters.milesMax != null,
    'has_zip': filters.zip != null && filters.zip!.trim().isNotEmpty,
    if (condition == 'new' || condition == 'used' || condition == 'cpo')
      'condition': condition!,
  };
}

bool _hasFilters(SearchFilters filters) {
  return filters.makes.isNotEmpty ||
      filters.models.isNotEmpty ||
      filters.trims.isNotEmpty ||
      filters.yearMin != null ||
      filters.yearMax != null ||
      filters.priceMax != null ||
      filters.milesMax != null ||
      (filters.zip != null && filters.zip!.trim().isNotEmpty) ||
      filters.radiusMi != null ||
      filters.bodyTypes.isNotEmpty ||
      filters.fuel.isNotEmpty ||
      filters.drivetrain.isNotEmpty ||
      (filters.condition != null && filters.condition!.trim().isNotEmpty);
}
