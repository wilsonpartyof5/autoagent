import '../models/car_pack.dart';
import 'purchase_service.dart';

/// Store purchase outcomes, independent of the RevenueCat plugin types.
sealed class StorePurchaseOutcome {
  const StorePurchaseOutcome();
}

class StorePurchaseSucceeded extends StorePurchaseOutcome {
  const StorePurchaseSucceeded({required this.transactionId});

  final String transactionId;
}

class StorePurchaseCancelled extends StorePurchaseOutcome {
  const StorePurchaseCancelled();
}

class StorePurchasePending extends StorePurchaseOutcome {
  const StorePurchasePending();
}

class StorePurchaseFailed extends StorePurchaseOutcome {
  const StorePurchaseFailed({required this.message, this.code});

  final String message;
  final String? code;
}

/// Port the RevenueCat SDK adapter implements. Tests use a fake.
abstract class StoreGateway {
  Future<void> configure();

  Future<List<CarPackOffering>> getOfferings();

  Future<StorePurchaseOutcome> purchase(CarPackType packType);

  Future<List<RestoredTransaction>> restore();

  Future<bool> isAvailable(String productId);

  /// Identifies the shopper. [appUserId] is the Supabase user id.
  Future<void> logIn(String appUserId);

  Future<void> logOut();
}
