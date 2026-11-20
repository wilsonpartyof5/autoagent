import '../models/listing.dart';

class DiscoverPage {
  const DiscoverPage({
    required this.listings,
    required this.page,
    required this.hasNextPage,
    this.total,
  });

  final List<Listing> listings;
  final int page;
  final bool hasNextPage;
  final int? total;
}
