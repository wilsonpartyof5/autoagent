import 'dart:convert';

import '../models/json_values.dart';
import '../models/market_intel_brief.dart';

/// Parser for `POST /api/consumer/keys/market-save`.
///
/// The body is `{ success, data, credits, spent, available, unlocked, reason,
/// message, market }`. `market` is the stored fair-price snapshot when the
/// unlock landed. A body with no `market` does not invent a brief.
class MarketSaveResponse {
  const MarketSaveResponse({
    required this.listingId,
    required this.spent,
    required this.balance,
    required this.canAdd,
    required this.reason,
    this.unlocked,
    this.available = true,
    this.outcome,
    this.message,
    this.market,
  });

  final String listingId;
  final bool spent;
  final int? balance;
  final bool canAdd;
  final String? reason;
  final bool? unlocked;
  final bool available;
  final String? outcome;
  final String? message;
  final MarketIntelBrief? market;

  /// The lookup did not store a card, so the key should come back.
  bool get refused =>
      unlocked == false || available == false || outcome == 'market_unavailable';

  static MarketSaveResponse? tryParse(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! Map) return null;
    final root = Map<String, dynamic>.from(decoded);
    if (root['success'] == false) return null;
    final data = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : const <String, dynamic>{};
    final listingId = jsonString(data['listingId']);
    if (listingId == null || listingId.isEmpty) return null;
    final credits = root['credits'] is Map
        ? Map<String, dynamic>.from(root['credits'] as Map)
        : const <String, dynamic>{};
    return MarketSaveResponse(
      listingId: listingId,
      spent: root['spent'] == true,
      balance: jsonInt(credits['balance']),
      canAdd: credits['canAdd'] == true,
      reason: jsonString(credits['reason']),
      unlocked: root.containsKey('unlocked') ? root['unlocked'] == true : null,
      available: root.containsKey('available') ? root['available'] == true : true,
      outcome: jsonString(root['reason']),
      message: jsonString(root['message']),
      market: MarketIntelBrief.tryParse(root['market']),
    );
  }
}
