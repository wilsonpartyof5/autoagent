import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart' as rc;

import '../models/car_pack.dart';
import 'pack_offering.dart';
import 'purchase_config.dart';
import 'purchase_service.dart';
import 'store_gateway.dart';

/// `purchases_flutter` adapter for the three consumable car packs.
class PurchasesFlutterStore implements StoreGateway {
  PurchasesFlutterStore(this.config);

  final PurchaseConfig config;
  static Future<void>? _configureOnce;

  @override
  Future<void> configure() {
    return _configureOnce ??= _configure();
  }

  Future<void> _configure() async {
    try {
      final apiKey = config.revenueCatApiKeyFor(defaultTargetPlatform);
      if (apiKey == null) {
        throw StateError('RevenueCat public SDK key is not set.');
      }
      await rc.Purchases.setLogLevel(kDebugMode ? rc.LogLevel.debug : rc.LogLevel.info);
      if (await rc.Purchases.isConfigured) return;
      // Stay anonymous until sign-in calls [logIn] with the Supabase user id.
      await rc.Purchases.configure(rc.PurchasesConfiguration(apiKey));
    } catch (_) {
      _configureOnce = null;
      rethrow;
    }
  }

  @override
  Future<List<CarPackOffering>> getOfferings() async {
    final offerings = await rc.Purchases.getOfferings();
    final matched = <CarPackType, CarPackOffering>{};
    final packages = _packages(offerings);
    for (final package in packages) {
      final pack = CarPackType.fromProductId(package.storeProduct.identifier) ??
          CarPackType.fromProductId(package.identifier);
      if (pack == null || matched.containsKey(pack)) continue;
      matched[pack] = _offeringFromProduct(pack, package.storeProduct);
    }

    final missing = [
      for (final pack in CarPackType.values)
        if (!matched.containsKey(pack)) pack.productId,
    ];
    if (missing.isNotEmpty) {
      final products = await rc.Purchases.getProducts(
        missing,
        productCategory: rc.ProductCategory.nonSubscription,
      );
      for (final product in products) {
        final pack = CarPackType.fromProductId(product.identifier);
        if (pack == null || matched.containsKey(pack)) continue;
        matched[pack] = _offeringFromProduct(pack, product);
      }
    }

    return [
      for (final pack in CarPackType.values)
        if (matched.containsKey(pack)) matched[pack]!,
    ];
  }

  @override
  Future<StorePurchaseOutcome> purchase(CarPackType packType) async {
    try {
      final package = await _packageFor(packType);
      final rc.PurchaseResult result;
      if (package != null) {
        result = await rc.Purchases.purchase(rc.PurchaseParams.package(package));
      } else {
        final products = await rc.Purchases.getProducts(
          [packType.productId],
          productCategory: rc.ProductCategory.nonSubscription,
        );
        if (products.isEmpty) {
          return StorePurchaseFailed(
            message: '${packType.productId} is not available.',
            code: 'product_not_available',
          );
        }
        result = await rc.Purchases.purchase(rc.PurchaseParams.storeProduct(products.first));
      }
      return StorePurchaseSucceeded(transactionId: _transactionId(result.storeTransaction, packType));
    } on PlatformException catch (error) {
      final code = rc.PurchasesErrorHelper.getErrorCode(error);
      if (code == rc.PurchasesErrorCode.purchaseCancelledError) {
        return const StorePurchaseCancelled();
      }
      if (code == rc.PurchasesErrorCode.paymentPendingError) {
        return const StorePurchasePending();
      }
      return StorePurchaseFailed(
        message: error.message ?? 'Purchase failed',
        code: code.name,
      );
    }
  }

  @override
  Future<List<RestoredTransaction>> restore() async {
    final info = await rc.Purchases.restorePurchases();
    final restored = <RestoredTransaction>[];
    for (final transaction in info.nonSubscriptionTransactions) {
      final pack = CarPackType.fromProductId(transaction.productIdentifier);
      if (pack == null) continue;
      restored.add(
        RestoredTransaction(
          transactionId: _transactionId(transaction, pack),
          packType: pack,
        ),
      );
    }
    return restored;
  }

  @override
  Future<void> logIn(String appUserId) async {
    await configure();
    await rc.Purchases.logIn(appUserId);
  }

  @override
  Future<void> logOut() async {
    if (!await rc.Purchases.isConfigured) return;
    try {
      await rc.Purchases.logOut();
    } on PlatformException catch (error) {
      debugPrint('RevenueCat logOut skipped: $error');
    }
  }

  @override
  Future<bool> isAvailable(String productId) async {
    final offerings = await getOfferings();
    if (offerings.any((offering) => offering.packType.productId == productId)) {
      return true;
    }
    final products = await rc.Purchases.getProducts(
      [productId],
      productCategory: rc.ProductCategory.nonSubscription,
    );
    return products.isNotEmpty;
  }

  List<rc.Package> _packages(rc.Offerings offerings) {
    return selectPackPackages<rc.Package>(
      byOfferingId: {
        for (final entry in offerings.all.entries) entry.key: entry.value.availablePackages,
      },
      currentPackages: offerings.current?.availablePackages,
    );
  }

  Future<rc.Package?> _packageFor(CarPackType packType) async {
    final offerings = await rc.Purchases.getOfferings();
    final packages = _packages(offerings);
    for (final package in packages) {
      final pack = CarPackType.fromProductId(package.storeProduct.identifier) ??
          CarPackType.fromProductId(package.identifier);
      if (pack == packType) return package;
    }
    return null;
  }

  CarPackOffering _offeringFromProduct(CarPackType pack, rc.StoreProduct product) {
    return CarPackOffering(
      packType: pack,
      localizedPrice: product.priceString,
      currencyCode: product.currencyCode,
      priceAmount: product.price,
    );
  }

  String _transactionId(rc.StoreTransaction transaction, CarPackType pack) {
    if (transaction.transactionIdentifier.isNotEmpty) {
      return transaction.transactionIdentifier;
    }
    return '${pack.productId}_${transaction.purchaseDate}';
  }
}
