/// Numeric and string readers for inventory JSON.
///
/// Discover prices may arrive as ints, decimals, or numeric strings. These
/// helpers never throw on a mismatched type.
int? jsonInt(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) {
    if (!value.isFinite) return null;
    return value.round();
  }
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    final asInt = int.tryParse(trimmed);
    if (asInt != null) return asInt;
    final asDouble = double.tryParse(trimmed);
    if (asDouble == null || !asDouble.isFinite) return null;
    return asDouble.round();
  }
  return null;
}

double? jsonDouble(Object? value) {
  if (value == null) return null;
  if (value is num) {
    final number = value.toDouble();
    return number.isFinite ? number : null;
  }
  if (value is String) {
    final number = double.tryParse(value.trim());
    if (number == null || !number.isFinite) return null;
    return number;
  }
  return null;
}

String? jsonString(Object? value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

List<String> jsonStringList(Object? value) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is String && item.trim().isNotEmpty) item,
  ];
}
