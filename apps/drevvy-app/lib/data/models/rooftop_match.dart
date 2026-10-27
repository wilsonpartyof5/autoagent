import 'package:equatable/equatable.dart';

/// Whether a listing URL maps to an onboarded dealer-dashboard rooftop.
///
/// Live API: `GET /api/consumer/listings/:id/rooftop-match`.
/// Until that route lands, [source] is `stub` and demo listings 001 / 007
/// are treated as in-network.
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

  const RooftopMatch.offNetwork({this.vdpUrl, this.source = RooftopMatchSource.stub})
    : matched = false,
      rooftopId = null;

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
    final rooftopId = _string(payload, const [
      'rooftopId',
      'rooftop_id',
      'id',
    ]);
    final matched =
        payload['matched'] == true ||
        payload['inNetwork'] == true ||
        payload['in_network'] == true ||
        (rooftopId != null && rooftopId.isNotEmpty);
    return RooftopMatch(
      matched: matched,
      rooftopId: rooftopId,
      vdpUrl: _string(payload, const ['vdpUrl', 'vdp_url', 'listingUrl', 'url']),
      source: RooftopMatchSource.live,
    );
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

enum RooftopMatchSource { live, stub }
