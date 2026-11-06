import 'package:equatable/equatable.dart';

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
    this.networkState,
  });

  final bool matched;
  final String? rooftopId;
  final String? vdpUrl;
  final RooftopMatchSource source;

  /// Explicit `data.state` from the network route. Null on demo stubs.
  final RooftopNetworkState? networkState;

  /// A conversation can start only when this client has a rooftop id.
  /// The public network body does not include one, so a verified
  /// `in_network` state does not open chat.
  bool get isInNetwork => matched && rooftopId != null && rooftopId!.isNotEmpty;

  bool get classifiedInNetwork => networkState == RooftopNetworkState.inNetwork;

  bool get classifiedOffNetwork =>
      networkState == RooftopNetworkState.offNetwork;

  const RooftopMatch.offNetwork({
    this.vdpUrl,
    this.source = RooftopMatchSource.stub,
    this.networkState = RooftopNetworkState.offNetwork,
  }) : matched = false,
       rooftopId = null;

  /// The live call failed or the build has no API origin. Not an in-network
  /// guess and not an off-network confirmation.
  const RooftopMatch.unavailable()
    : matched = false,
      rooftopId = null,
      vdpUrl = null,
      source = RooftopMatchSource.unavailable,
      networkState = null;

  RooftopMatch copyWith({
    bool? matched,
    String? rooftopId,
    String? vdpUrl,
    RooftopMatchSource? source,
    RooftopNetworkState? networkState,
  }) {
    return RooftopMatch(
      matched: matched ?? this.matched,
      rooftopId: rooftopId ?? this.rooftopId,
      vdpUrl: vdpUrl ?? this.vdpUrl,
      source: source ?? this.source,
      networkState: networkState ?? this.networkState,
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
  /// `data.state` is `in_network`, `off_network`, `identity_unavailable`, or
  /// `unknown`. The public body has no rooftop id and no dealer URL. A
  /// verified `in_network` is the server's rooftop match, shown by
  /// `dealer_conversation` in `ctas`. Every CTA kind must be one of
  /// `market_intel`, `dealer_conversation`, or `off_network_otd_request`.
  /// An extra unknown kind stays unavailable. This client does not invent an
  /// id or open chat. Explicit `off_network` is a resolved miss. A body with no
  /// `state`, including a legacy `network` / `match: null` payload, stays
  /// unavailable.
  static RooftopMatch parseNetworkResponse(Map<String, dynamic> root) {
    if (root['success'] == false) return const RooftopMatch.unavailable();
    final data = root['data'];
    if (data is! Map) return const RooftopMatch.unavailable();
    final payload = Map<String, dynamic>.from(data);
    final state = payload['state'];
    if (state is! String) return const RooftopMatch.unavailable();
    switch (state) {
      case 'in_network':
        if (!_verifiedInNetworkCtas(payload)) {
          return const RooftopMatch.unavailable();
        }
        return const RooftopMatch(
          matched: true,
          source: RooftopMatchSource.live,
          networkState: RooftopNetworkState.inNetwork,
        );
      case 'off_network':
        return const RooftopMatch.offNetwork(source: RooftopMatchSource.live);
      case 'identity_unavailable':
      case 'unknown':
        return const RooftopMatch.unavailable();
      default:
        return const RooftopMatch.unavailable();
    }
  }

  static const _knownCtaKinds = {
    'market_intel',
    'dealer_conversation',
    'off_network_otd_request',
  };

  /// `dealer_conversation` is required, and it does not accept an unknown
  /// CTA kind beside it. Classification is not permission to open chat.
  static bool _verifiedInNetworkCtas(Map<String, dynamic> payload) {
    final ctas = payload['ctas'];
    if (ctas is! List || ctas.isEmpty) return false;
    var hasConversation = false;
    for (final item in ctas) {
      if (item is! Map) return false;
      final kind = item['kind'];
      if (kind is! String || !_knownCtaKinds.contains(kind)) return false;
      if (kind == 'dealer_conversation') hasConversation = true;
    }
    return hasConversation;
  }

  static String? _string(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value is String && value.trim().isNotEmpty) return value.trim();
    }
    return null;
  }

  @override
  List<Object?> get props => [matched, rooftopId, vdpUrl, source, networkState];
}

enum RooftopMatchSource { live, stub, unavailable }

/// `data.state` from `POST /api/consumer/listings/network`.
enum RooftopNetworkState { inNetwork, offNetwork }
