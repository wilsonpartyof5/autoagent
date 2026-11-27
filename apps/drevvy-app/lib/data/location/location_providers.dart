import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_services.dart';
import 'device_location.dart';
import 'location_sources.dart';
import 'place_search.dart';
import 'shop_location_store.dart';

/// OS location. The real source asks the OS for permission.
final deviceLocationSourceProvider = Provider<DeviceLocationSource>(
  (ref) => GeolocatorDeviceLocation(),
);

/// OS geocoder (Apple or Android). Used to turn a ZIP into a map point.
final placeSearchProvider = Provider<PlaceSearch>(
  (ref) => GeocodingPlaceSearch(),
);

/// The place Discover searches from. Shop reads the same storage key.
final shopLocationStoreProvider = Provider<ShopLocationStore>(
  (ref) => ShopLocationStore(ref.watch(localFlagsProvider)),
);
