import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/cars_balance_placement.dart';
import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';
import 'package:drevvy_app/data/services/purchase_service_factory.dart';
import 'package:drevvy_app/data/services/revenue_cat_identity.dart';
import 'package:drevvy_app/data/services/revenue_cat_purchase_service.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/data/services/store_gateway.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PurchaseConfig', () {
    test('defaults to the demo service when API keys are missing', () {
      const config = PurchaseConfig();
      expect(config.usesRevenueCat, isFalse);
      expect(config.usesSuperwall, isFalse);
      expect(buildPurchaseService(config), isA<FakePurchaseService>());
      expect(PurchaseConfig.fromEnvironment().usesRevenueCat, isFalse);
    });

    test('selects RevenueCat only for the platform that has a public key', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      const ios = PurchaseConfig(revenueCatIosApiKey: 'appl_test');
      expect(ios.usesRevenueCat, isTrue);
      expect(ios.usesSuperwall, isFalse);
      expect(
        buildPurchaseService(ios, gateway: _FakeStore()),
        isA<RevenueCatPurchaseService>(),
      );

      const androidOnly = PurchaseConfig(revenueCatAndroidApiKey: 'goog_test');
      expect(androidOnly.usesRevenueCat, isFalse);

      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(androidOnly.usesRevenueCat, isTrue);
      expect(
        PurchaseConfig(superwallAndroidApiKey: 'pk_test').usesSuperwall,
        isTrue,
      );
    });
  });

  group('RevenueCatPurchaseService', () {
    test('maps a consumable purchase to pack credits', () async {
      final store = _FakeStore()
        ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_10');
      final service = RevenueCatPurchaseService(gateway: store);

      final result = await service.purchasePack(CarPackType.bestValue);

      expect(result, isA<PurchaseSuccess>());
      final success = result as PurchaseSuccess;
      expect(success.creditsAdded, 10);
      expect(success.packType, CarPackType.bestValue);
      expect(success.transactionId, 'txn_10');
      expect(store.purchased, CarPackType.bestValue);
    });

    test('cancellation and pending payments are not errors', () async {
      final store = _FakeStore()..outcome = const StorePurchaseCancelled();
      final service = RevenueCatPurchaseService(gateway: store);
      expect(
        await service.purchasePack(CarPackType.starter),
        isA<PurchaseCancelled>(),
      );

      store.outcome = const StorePurchasePending();
      expect(
        await service.purchasePack(CarPackType.starter),
        isA<PurchasePending>(),
      );
    });

    test('restore sums non-subscription pack transactions', () async {
      final store = _FakeStore()
        ..restored = const [
          RestoredTransaction(
            transactionId: 'a',
            packType: CarPackType.starter,
          ),
          RestoredTransaction(transactionId: 'b', packType: CarPackType.plus),
        ];
      final service = RevenueCatPurchaseService(gateway: store);
      final result = await service.restorePurchases();

      expect(result, isA<RestoreSuccess>());
      final success = result as RestoreSuccess;
      expect(success.creditsRestored, 8);
      expect(success.transactions, hasLength(2));
    });

    test('restore with no consumable transactions reports none', () async {
      final service = RevenueCatPurchaseService(gateway: _FakeStore());
      expect(await service.restorePurchases(), isA<RestoreNoPurchases>());
    });

    test('offerings keep the four pack prices', () async {
      final service = RevenueCatPurchaseService(gateway: _FakeStore());
      final offerings = await service.getOfferings();
      expect(offerings, isNotNull);
      expect(offerings!.map((offering) => offering.priceAmount), [
        35,
        55,
        75,
        95,
      ]);
    });
  });

  group('credit sync', () {
    test(
      'uses the backend balance when the credits endpoint responds',
      () async {
        final credits = _ScriptedCredits(
          grantResult: const CarCreditBalance(
            balance: 13,
            totalPurchased: 13,
            totalSpent: 0,
            totalRefunded: 0,
          ),
        );
        final repo = DemoRepository(
          networkDelay: Duration.zero,
          purchaseService: FakePurchaseService(simulateDelay: Duration.zero),
          credits: credits,
          initialBalance: const CarCreditBalance.empty(),
        );

        final result = await repo.purchasePack(CarPackType.starter);
        expect(result, isA<PurchaseSuccess>());
        expect(credits.lastProductId, 'drevvy_pack_3');
        expect((await repo.getCreditBalance()).balance, 13);
      },
    );

    test(
      'keeps the local demo balance when the credits endpoint is absent',
      () async {
        final repo = DemoRepository(
          networkDelay: Duration.zero,
          purchaseService: RevenueCatPurchaseService(
            gateway: _FakeStore()
              ..outcome = const StorePurchaseSucceeded(
                transactionId: 'txn_local',
              ),
          ),
          credits: const MissingCreditsEndpoint(),
          initialBalance: const CarCreditBalance.withBalance(1),
        );

        await repo.purchasePack(CarPackType.plus);
        final balance = await repo.getCreditBalance();
        expect(balance.balance, 6);
        expect(balance.totalPurchased, 6);

        await repo.purchasePack(CarPackType.plus);
        expect((await repo.getCreditBalance()).balance, 6);
      },
    );

    test('restore applies each consumable transaction once', () async {
      final store = _FakeStore()
        ..restored = const [
          RestoredTransaction(
            transactionId: 'txn_3',
            packType: CarPackType.starter,
          ),
          RestoredTransaction(
            transactionId: 'txn_10',
            packType: CarPackType.bestValue,
          ),
        ];
      final repo = DemoRepository(
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: const MissingCreditsEndpoint(),
        initialBalance: const CarCreditBalance.empty(),
      );

      final first = await repo.restorePurchases();
      expect(first, isA<RestoreSuccess>());
      expect((first as RestoreSuccess).creditsRestored, 13);
      expect((await repo.getCreditBalance()).balance, 13);

      final second = await repo.restorePurchases();
      expect((second as RestoreSuccess).creditsRestored, 0);
      expect((await repo.getCreditBalance()).balance, 13);
    });
  });

  group('RevenueCat app user id', () {
    test(
      'sign-in logs in as the Supabase user and sign-out logs out',
      () async {
        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        addTearDown(() => debugDefaultTargetPlatformOverride = null);

        final store = _FakeStore();
        final session = ShopperSessionStore()
          ..identity = RevenueCatIdentity(
            config: const PurchaseConfig(revenueCatIosApiKey: 'appl_test'),
            gateway: store,
          );

        await session.save(
          const ShopperSession(
            accessToken: 'shopper-jwt',
            consumerUserId: 'supabase-user-1',
          ),
        );
        expect(store.loggedInUserId, 'supabase-user-1');

        await session.clear();
        expect(store.loggedOut, isTrue);
      },
    );

    test('demo mode does not call RevenueCat identity', () async {
      final store = _FakeStore();
      final session = ShopperSessionStore()
        ..identity = RevenueCatIdentity(
          config: const PurchaseConfig(),
          gateway: store,
        );

      await session.save(
        const ShopperSession(
          accessToken: 'shopper-jwt',
          consumerUserId: 'supabase-user-1',
        ),
      );
      await session.clear();

      expect(store.loggedInUserId, isNull);
      expect(store.loggedOut, isFalse);
    });
  });

  group('cars_balance_empty', () {
    test('shows the local paywall when Superwall is not configured', () async {
      expect(CarsBalancePlacement.name, 'cars_balance_empty');
      var shown = false;
      await const LocalCarsBalancePlacement().register(
        presentLocalPaywall: () => shown = true,
      );
      expect(shown, isTrue);
    });
  });
}

class _FakeStore implements StoreGateway {
  StorePurchaseOutcome outcome = const StorePurchaseSucceeded(
    transactionId: 'txn',
  );
  List<RestoredTransaction> restored = const [];
  CarPackType? purchased;
  String? loggedInUserId;
  bool loggedOut = false;

  @override
  Future<void> configure() async {}

  @override
  Future<List<CarPackOffering>> getOfferings() async {
    return const [
      CarPackOffering(
        packType: CarPackType.single,
        localizedPrice: r'$35.00',
        currencyCode: 'USD',
        priceAmount: 35,
      ),
      CarPackOffering(
        packType: CarPackType.starter,
        localizedPrice: r'$55.00',
        currencyCode: 'USD',
        priceAmount: 55,
      ),
      CarPackOffering(
        packType: CarPackType.plus,
        localizedPrice: r'$75.00',
        currencyCode: 'USD',
        priceAmount: 75,
      ),
      CarPackOffering(
        packType: CarPackType.bestValue,
        localizedPrice: r'$95.00',
        currencyCode: 'USD',
        priceAmount: 95,
      ),
    ];
  }

  @override
  Future<StorePurchaseOutcome> purchase(CarPackType packType) async {
    purchased = packType;
    return outcome;
  }

  @override
  Future<List<RestoredTransaction>> restore() async => restored;

  @override
  Future<bool> isAvailable(String productId) async {
    return CarPackType.fromProductId(productId) != null;
  }

  @override
  Future<void> logIn(String appUserId) async {
    loggedInUserId = appUserId;
  }

  @override
  Future<void> logOut() async {
    loggedOut = true;
  }
}

class _ScriptedCredits extends CreditsEndpoint {
  _ScriptedCredits({this.grantResult});

  final CarCreditBalance? grantResult;
  String? lastProductId;

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async {
    lastProductId = productId;
    return grantResult;
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async {
    return null;
  }
}
