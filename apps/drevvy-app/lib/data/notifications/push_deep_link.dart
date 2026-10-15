/// Maps a push payload onto a go_router location.
///
/// Supported `type` values: `price_drop`, `offer_ready`, `car_sold`,
/// `official_offer`, `did_you_buy`. `dealId` (or `deal_id`) is required.
String? locationForPush(Map<String, dynamic> data) {
  final type = (data['type'] ?? data['notificationType'] ?? '').toString().trim().toLowerCase();
  final dealId = (data['dealId'] ?? data['deal_id'] ?? '').toString().trim();
  if (type.isEmpty || dealId.isEmpty) return null;

  final id = Uri.encodeComponent(dealId);
  return switch (type) {
    'price_drop' || 'offer_ready' || 'car_sold' => '/deal/$id',
    'official_offer' => '/deal/$id/official',
    'did_you_buy' => '/deal/$id?prompt=did_you_buy',
    _ => null,
  };
}
