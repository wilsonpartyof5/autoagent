import 'package:equatable/equatable.dart';

/// Saved car model per spec §11.2.
/// Stores only Drevvy's own data - no persisted MarketCheck listing data.
/// Price changes come from live data, not stored prices.
enum SavedCarStatus {
  active,
  noLongerListed,
}

class SavedCar extends Equatable {
  const SavedCar({
    required this.id,
    required this.userId,
    required this.listingId,
    required this.vin,
    required this.savedAt,
    this.savedPrice,
    this.status = SavedCarStatus.active,
  });

  final String id;
  final String userId;
  final String listingId;
  final String vin;
  final DateTime savedAt;
  /// Price at time of save - used for price change display.
  /// TODO: In production, price changes must come from live MarketCheck data,
  /// not stored prices. This field is for demo display only.
  final int? savedPrice;
  final SavedCarStatus status;

  bool get isActive => status == SavedCarStatus.active;
  bool get isNoLongerListed => status == SavedCarStatus.noLongerListed;

  SavedCar copyWith({
    SavedCarStatus? status,
    int? savedPrice,
  }) {
    return SavedCar(
      id: id,
      userId: userId,
      listingId: listingId,
      vin: vin,
      savedAt: savedAt,
      savedPrice: savedPrice ?? this.savedPrice,
      status: status ?? this.status,
    );
  }

  @override
  List<Object?> get props => [id, listingId, vin, savedAt, status];
}
