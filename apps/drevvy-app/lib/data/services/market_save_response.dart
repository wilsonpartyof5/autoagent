import 'dart:convert';

import '../models/json_values.dart';

/// Parser for `POST /api/consumer/keys/market-save`.
///
/// The body is `{ success, data: SavedCarView, credits, spent }`. `credits` is
/// `{ balance, canAdd, reason }`. Nothing in that payload is a fair price, a
/// comp set, or a flag that survives a later read. Callers must not treat a
/// parse as an unlocked price brief, and the live app does not send this
/// request while market intel cannot be shown.
class MarketSaveResponse {
  const MarketSaveResponse({
    required this.listingId,
    required this.spent,
    required this.balance,
    required this.canAdd,
    required this.reason,
  });

  final String listingId;
  final bool spent;
  final int? balance;
  final bool canAdd;
  final String? reason;

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
    );
  }
}
