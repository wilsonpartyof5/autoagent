import 'package:equatable/equatable.dart';

import 'json_values.dart';

/// Whether an onboarded rooftop matches a listing.
///
/// Live classification is `POST /api/consumer/listings/network`. Demo mode
/// keeps the labeled stub: listings 001 and 007 are in-network. A live miss
/// is [RooftopMatch.unavailable], which is neither in-network nor off-network.
class RooftopMatch extends Equatable {
  const RooftopMatch({
    required this.matched,
    this.rooftopId,
    this.vdpUrl,
    this.source = RooftopMatchSource.stub,
  });

  final bool matched;
  final String? rooftopId;
  final String? vdpUrl;
  final RooftopMatchSource source;

  bool get isInNetwork => matched && rooftopId != null && rooftopId!.isNotEmpty;

  const RooftopMatch.offNetwork({
    this.vdpUrl,
    this.source = RooftopMatchSource.stub,
  }) : matched = false,
       rooftopId = null;

  /// The live call failed or the build has no API origin. Not an in-network
  /// guess and not an off-network confirmation.
  const RooftopMatch.unavailable()
    : matched = false,
      rooftopId = null,
      vdpUrl = null,
      source = RooftopMatchSource.unavailable;

  RooftopMatch copyWith({
    bool? matched,
    String? rooftopId,
    String? vdpUrl,
    RooftopMatchSource? source,
  }) {
    return RooftopMatch(
      matched: matched ?? this.matched,
      rooftopId: rooftopId ?? this.rooftopId,
      vdpUrl: vdpUrl ?? this.vdpUrl,
      source: source ?? this.source,
    );
  }

  factory RooftopMatch.fromJson(Map<String, dynamic> json) {
    final payload = json['data'] is Map
        ? Map<String, dynamic>.from(json['data'] as Map)
        : json;
    final rooftopId = _string(payload, const ['rooftopId', 'rooftop_id', 'id']);
    final matched =
        payload['matched'] == true ||
        payload['inNetwork'] == true ||
        payload['in_network'] == true ||
        (rooftopId != null && rooftopId.isNotEmpty);
    return RooftopMatch(
      matched: matched,
      rooftopId: rooftopId,
      vdpUrl: _string(payload, const [
        'vdpUrl',
        'vdp_url',
        'listingUrl',
        'url',
      ]),
      source: RooftopMatchSource.live,
    );
  }

  /// Reads `POST /api/consumer/listings/network`.
  ///
  /// [suppliedListingUrl] is a URL already present on the listing. This parser
  /// does not invent one. `in_network` requires `data.match.rooftopId`.
  /// `off_network` is trusted only when that URL was sent. A listing-id-only
  /// `off_network` body uses the same `match: null` shape as a failed
  /// MarketCheck identity lookup, so it stays [RooftopMatch.unavailable].
  static RooftopMatch parseNetworkResponse(
    Map<String, dynamic> root, {
    required bool suppliedListingUrl,
    String? listingUrl,
  }) {
    if (root['success'] == false) return const RooftopMatch.unavailable();
    final data = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root;
    final network = data['network'];
    if (network == 'in_network') {
      final match = data['match'];
      final rooftopId = match is Map
          ? jsonString(Map<String, dynamic>.from(match)['rooftopId'])
          : null;
      if (rooftopId == null || rooftopId.isEmpty) {
        return const RooftopMatch.unavailable();
      }
      return RooftopMatch(
        matched: true,
        rooftopId: rooftopId,
        vdpUrl: suppliedListingUrl ? listingUrl : null,
        source: RooftopMatchSource.live,
      );
    }
    if (network == 'off_network') {
      if (!suppliedListingUrl) return const RooftopMatch.unavailable();
      return RooftopMatch.offNetwork(
        vdpUrl: listingUrl,
        source: RooftopMatchSource.live,
      );
    }
    return const RooftopMatch.unavailable();
  }

  static String? _string(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value is String && value.trim().isNotEmpty) return value.trim();
    }
    return null;
  }

  @override
  List<Object?> get props => [matched, rooftopId, vdpUrl, source];
}

enum RooftopMatchSource { live, stub, unavailable }
