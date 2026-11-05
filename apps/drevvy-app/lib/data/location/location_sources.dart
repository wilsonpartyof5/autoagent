import 'shop_location.dart';

class LocationFailure implements Exception {
  const LocationFailure(this.message);

  final String message;

  @override
  String toString() => message;
}

/// OS location. Implementations request permission and return a real fix.
abstract class DeviceLocationSource {
  Future<ShopLocation> current();
}

/// Turns a place name into geocoder coordinates. An empty result is a failure,
/// not a reason to invent a lat/lng.
abstract class PlaceSearch {
  Future<List<ShopLocation>> search(String query);
}
