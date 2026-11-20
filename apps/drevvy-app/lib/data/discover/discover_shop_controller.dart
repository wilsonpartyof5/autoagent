import 'package:flutter/foundation.dart';

import '../location/shop_location.dart';
import '../location/shop_location_store.dart';
import '../models/listing.dart';
import 'discover_catalog.dart';
import 'discover_exception.dart';
import 'discover_filters.dart';

enum DiscoverShopPhase { needsLocation, loading, results, empty, error }

/// Shop search state for the live Discover path.
///
/// An error or an empty page clears or keeps only listings that came from
/// [DiscoverCatalog]. It never loads the demo RAV4 set.
class DiscoverShopController extends ChangeNotifier {
  DiscoverShopController({
    required this.catalog,
    this.locations,
    this.location,
  });

  final DiscoverCatalog catalog;
  final ShopLocationStore? locations;

  DiscoverShopPhase phase = DiscoverShopPhase.needsLocation;
  List<Listing> listings = const [];
  String? errorMessage;
  DiscoverFilters filters = const DiscoverFilters();
  ShopLocation? location;
  bool hasNextPage = false;
  bool loadingMore = false;
  String queryText = '';

  int _page = 1;
  int _generation = 0;

  Future<void> restore() async {
    final stored = await locations?.read();
    if (stored != null && stored.isUsable) {
      location = stored;
    }
    if (location == null || location!.isUsable == false) {
      phase = DiscoverShopPhase.needsLocation;
      listings = const [];
    }
    notifyListeners();
  }

  Future<void> setLocation(ShopLocation value) async {
    if (!value.isUsable) {
      location = null;
      listings = const [];
      phase = DiscoverShopPhase.error;
      errorMessage = 'That place does not have a usable map location.';
      notifyListeners();
      return;
    }
    location = value;
    await locations?.write(value);
    await search(reset: true);
  }

  void setFilters(DiscoverFilters value) {
    filters = value;
    notifyListeners();
  }

  Future<void> search({String? query, bool reset = true}) async {
    if (query != null) queryText = query;
    final current = location;
    if (current == null || !current.isUsable) {
      phase = DiscoverShopPhase.needsLocation;
      listings = const [];
      errorMessage = null;
      hasNextPage = false;
      notifyListeners();
      return;
    }
    final effective = filters.withQuery(queryText);
    final problem = effective.validate();
    if (problem != null) {
      if (reset) listings = const [];
      phase = listings.isEmpty ? DiscoverShopPhase.error : phase;
      errorMessage = problem;
      notifyListeners();
      return;
    }

    final page = reset ? 1 : _page + 1;
    final generation = ++_generation;
    if (reset) {
      phase = DiscoverShopPhase.loading;
      listings = const [];
      errorMessage = null;
      hasNextPage = false;
    } else {
      loadingMore = true;
    }
    notifyListeners();

    try {
      final result = await catalog.search(
        location: current,
        filters: effective,
        page: page,
      );
      if (generation != _generation) return;
      _page = result.page;
      listings = reset
          ? List<Listing>.unmodifiable(result.listings)
          : List<Listing>.unmodifiable([...listings, ...result.listings]);
      hasNextPage = result.hasNextPage;
      errorMessage = null;
      phase = listings.isEmpty
          ? DiscoverShopPhase.empty
          : DiscoverShopPhase.results;
    } on DiscoverException catch (error) {
      if (generation != _generation) return;
      errorMessage = error.message;
      if (reset) {
        listings = const [];
        hasNextPage = false;
        phase = DiscoverShopPhase.error;
      } else if (listings.isEmpty) {
        phase = DiscoverShopPhase.error;
      }
    } finally {
      if (generation == _generation) {
        loadingMore = false;
        notifyListeners();
      }
    }
  }

  Future<void> retry() => search(reset: listings.isEmpty);
}
