import 'package:geolocator/geolocator.dart';

import '../../core/platform/plugin_errors.dart';
import 'location_sources.dart';
import 'shop_location.dart';

class GeolocatorDeviceLocation implements DeviceLocationSource {
  @override
  Future<ShopLocation> current() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const LocationFailure(
          'Location permission is off. Search for a city instead.',
        );
      }
      final serviceOn = await Geolocator.isLocationServiceEnabled();
      if (!serviceOn) {
        throw const LocationFailure(
          'Location services are off. Search for a city instead.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      final location = ShopLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        label: 'Current location',
      );
      if (!location.isUsable) {
        throw const LocationFailure(
          'The device location is not usable. Search for a city instead.',
        );
      }
      return location;
    } on LocationFailure {
      rethrow;
    } catch (error) {
      if (isPluginMissing(error)) {
        throw const LocationFailure(
          'Location is not available on this device. Search for a city instead.',
        );
      }
      throw const LocationFailure(
        'Could not read this device location. Search for a city instead.',
      );
    }
  }
}
