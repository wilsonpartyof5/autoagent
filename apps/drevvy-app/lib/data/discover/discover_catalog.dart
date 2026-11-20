import '../location/shop_location.dart';
import '../models/listing.dart';
import 'discover_client.dart';
import 'discover_filters.dart';
import 'discover_page.dart';

/// Shop and vehicle detail read this. The HTTP implementation never substitutes
/// demo listings.
abstract class DiscoverCatalog {
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  });

  Future<Listing> listing(String id);
}

class HttpDiscoverCatalog implements DiscoverCatalog {
  HttpDiscoverCatalog({DiscoverClient? client})
    : _client = client ?? DiscoverClient();

  final DiscoverClient _client;

  @override
  Future<Listing> listing(String id) => _client.listing(id);

  @override
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) {
    return _client.search(location: location, filters: filters, page: page);
  }
}
