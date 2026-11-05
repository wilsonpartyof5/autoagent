import '../notifications/local_flags.dart';
import 'shop_location.dart';

/// Remembers the last confirmed place. This is not inventory and not a
/// fabricated coordinate.
class ShopLocationStore {
  ShopLocationStore(this._flags);

  static const storageKey = 'discover_shop_location';

  final LocalFlags _flags;

  Future<ShopLocation?> read() async {
    final raw = await _flags.getString(storageKey);
    if (raw == null || raw.isEmpty) return null;
    return ShopLocation.tryDecode(raw);
  }

  Future<void> write(ShopLocation location) {
    return _flags.setString(storageKey, location.encode());
  }
}
