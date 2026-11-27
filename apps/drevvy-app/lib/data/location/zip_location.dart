import 'dart:async';

import 'location_sources.dart';
import 'shop_location.dart';

final _fiveDigitZip = RegExp(r'^\d{5}$');

/// Turns a US ZIP into a Discover search point with the OS geocoder.
///
/// The Discover API takes latitude and longitude only. It has no ZIP field.
/// The point comes from the geocoder. Nothing is guessed. Returns null when
/// the ZIP is not five digits, the geocoder has no match, the match is not in
/// the US, or the lookup is slow. Callers keep going without a point.
Future<ShopLocation?> locationForZip(
  PlaceSearch places,
  String zip, {
  Duration timeout = const Duration(seconds: 6),
}) async {
  final trimmed = zip.trim();
  if (!_fiveDigitZip.hasMatch(trimmed)) return null;
  try {
    final matches = await places.search('$trimmed, USA').timeout(timeout);
    for (final match in matches) {
      if (!match.isUsable || !_inUnitedStates(match)) continue;
      return ShopLocation(
        latitude: match.latitude,
        longitude: match.longitude,
        label: 'ZIP $trimmed',
      );
    }
    return null;
  } on LocationFailure {
    return null;
  } on TimeoutException {
    return null;
  } catch (_) {
    return null;
  }
}

/// Loose box around the 50 states and territories (incl. Alaska, Hawaii,
/// Puerto Rico). A ZIP match outside it is the wrong place.
bool _inUnitedStates(ShopLocation place) {
  return place.latitude >= 13 &&
      place.latitude <= 72 &&
      ((place.longitude >= -180 && place.longitude <= -64) ||
          place.longitude >= 144);
}
