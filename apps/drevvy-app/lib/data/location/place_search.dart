import 'package:geocoding/geocoding.dart';

import '../../core/platform/plugin_errors.dart';
import 'location_sources.dart';
import 'shop_location.dart';

class GeocodingPlaceSearch implements PlaceSearch {
  @override
  Future<List<ShopLocation>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 2) {
      throw const LocationFailure('Enter a city or place name.');
    }
    try {
      final matches = await locationFromAddress(trimmed);
      final places = <ShopLocation>[];
      for (final match in matches) {
        final place = ShopLocation(
          latitude: match.latitude,
          longitude: match.longitude,
          label: trimmed,
        );
        final duplicate = places.any(
          (item) =>
              item.latitude == place.latitude &&
              item.longitude == place.longitude,
        );
        if (place.isUsable && !duplicate) places.add(place);
      }
      if (places.isEmpty) {
        throw const LocationFailure('No map location found for that place.');
      }
      return places;
    } on LocationFailure {
      rethrow;
    } catch (error) {
      if (isPluginMissing(error)) {
        throw const LocationFailure(
          'Place search is not available on this device.',
        );
      }
      throw const LocationFailure('Could not look up that place.');
    }
  }
}
