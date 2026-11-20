import 'dart:convert';

import '../models/json_values.dart';

/// A place the shopper confirmed. Coordinates come from the device or a
/// geocoder result the shopper picked. Callers must not invent them.
class ShopLocation {
  const ShopLocation({
    required this.latitude,
    required this.longitude,
    required this.label,
  });

  final double latitude;
  final double longitude;
  final String label;

  /// Rejects non-finite values, out-of-range values, and the null island (0, 0).
  bool get isUsable {
    if (!latitude.isFinite || !longitude.isFinite) return false;
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;
    if (latitude == 0 && longitude == 0) return false;
    return true;
  }

  String encode() => jsonEncode({
    'latitude': latitude,
    'longitude': longitude,
    'label': label,
  });

  static ShopLocation? tryDecode(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final latitude = jsonDouble(decoded['latitude']);
      final longitude = jsonDouble(decoded['longitude']);
      final label = jsonString(decoded['label']) ?? 'Chosen place';
      if (latitude == null || longitude == null) return null;
      final location = ShopLocation(
        latitude: latitude,
        longitude: longitude,
        label: label,
      );
      return location.isUsable ? location : null;
    } on FormatException {
      return null;
    }
  }
}
