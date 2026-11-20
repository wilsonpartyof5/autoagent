import 'dart:async';
import 'dart:convert';

import 'package:drevvy_app/core/config/api_config_exception.dart';
import 'package:drevvy_app/core/config/drevvy_api_config.dart';
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
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _liveOrigin = PurchaseConfig(
  mode: DrevvyDataMode.live,
  apiBaseUrl: 'https://api.drevvy.com',
  revenueCatIosApiKey: 'test_store_key',
);

void main() {
  group('PurchaseConfig', () {
    test('defaults to the demo service when API keys are missing', () {
      const config = PurchaseConfig();
      expect(config.usesRevenueCat, isFalse);
      expect(config.usesSuperwall, isFalse);
      expect(buildPurchaseService(config), isA<FakePurchaseService>());
      expect(PurchaseConfig.fromEnvironment().usesRevenueCat, isFalse);
    });

    test('a public platform key does not select the store service', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      const ios = PurchaseConfig(
        mode: DrevvyDataMode.live,
        apiBaseUrl: 'https://api.drevvy.com',
        revenueCatIosApiKey: 'appl_public',
      );
      expect(ios.usesRevenueCat, isTrue);
      expect(ios.hasTestStoreKey, isFalse);
      expect(ios.sandboxPurchasesEnabled, isFalse);
      final service = buildPurchaseService(ios, gateway: _FakeStore());
      expect(service, isA<UnavailablePurchaseService>());
      expect(
        (service as UnavailablePurchaseService).message,
        platformKeyNotSandboxMessage,
      );

      const androidOnly = PurchaseConfig(
        mode: DrevvyDataMode.live,
        apiBaseUrl: 'https://api.drevvy.com',
        revenueCatAndroidApiKey: 'goog_public',
      );
      expect(androidOnly.usesRevenueCat, isFalse);
      expect(androidOnly.sandboxPurchasesEnabled, isFalse);

      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(androidOnly.usesRevenueCat, isTrue);
      expect(androidOnly.sandboxPurchasesEnabled, isFalse);
      expect(
        PurchaseConfig(superwallAndroidApiKey: 'pk_test').usesSuperwall,
        isTrue,
      );
    });

    test(
      'demo stays on the local service when a Test Store key is present',
      () {
        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        addTearDown(() => debugDefaultTargetPlatformOverride = null);

        const demo = PurchaseConfig(revenueCatIosApiKey: 'test_store_key');
        expect(demo.hasTestStoreKey, isTrue);
        expect(demo.sandboxPurchasesEnabled, isFalse);
        expect(buildPurchaseService(demo), isA<FakePurchaseService>());
      },
    );

    test('live Test Store purchases require the API origin', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      const missingOrigin = PurchaseConfig(
        mode: DrevvyDataMode.live,
        revenueCatIosApiKey: 'test_store_key',
      );
      expect(missingOrigin.sandboxPurchasesEnabled, isFalse);
      final blocked = buildPurchaseService(missingOrigin);
      expect(blocked, isA<UnavailablePurchaseService>());
      expect(
        (blocked as UnavailablePurchaseService).message,
        apiNotConfiguredMessage,
      );

      expect(_liveOrigin.sandboxPurchasesEnabled, isTrue);
      expect(
        buildPurchaseService(_liveOrigin, gateway: _FakeStore()),
        isA<RevenueCatPurchaseService>(),
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

    test(
      'restore returns consumable transactions without a local total',
      () async {
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
        expect(success.creditsRestored, 0);
        expect(success.transactions, hasLength(2));
      },
    );

    test('a blank transaction id is not a completed purchase', () async {
      final store = _FakeStore()
        ..outcome = const StorePurchaseSucceeded(transactionId: '  ');
      final service = RevenueCatPurchaseService(gateway: store);
      final result = await service.purchasePack(CarPackType.starter);
      expect(result, isA<PurchaseError>());
      expect((result as PurchaseError).code, 'missing_transaction');
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
        4.99,
        19.99,
        34.99,
        74.99,
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
        expect(credits.lastProductId, 'drevvy_keys_5');
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
        expect(balance.balance, 26);
        expect(balance.totalPurchased, 26);

        await repo.purchasePack(CarPackType.plus);
        expect((await repo.getCreditBalance()).balance, 26);
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
      expect((first as RestoreSuccess).creditsRestored, 15);
      expect((await repo.getCreditBalance()).balance, 15);

      final second = await repo.restorePurchases();
      expect((second as RestoreSuccess).creditsRestored, 0);
      expect((await repo.getCreditBalance()).balance, 15);
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
          ..identity = RevenueCatIdentity(config: _liveOrigin, gateway: store);

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

    test('a platform SDK key does not log in to RevenueCat', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final store = _FakeStore();
      final session = ShopperSessionStore()
        ..identity = RevenueCatIdentity(
          config: const PurchaseConfig(
            mode: DrevvyDataMode.live,
            apiBaseUrl: 'https://api.drevvy.com',
            revenueCatIosApiKey: 'appl_public',
          ),
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

  group('sandbox credit confirmation', () {
    test('a Test Store purchase keeps the server balance', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final store = _FakeStore()
        ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_5');
      final credits = _ScriptedCredits(
        grantResult: const CarCreditBalance(
          balance: 8,
          totalPurchased: 8,
          totalSpent: 0,
          totalRefunded: 0,
        ),
      );
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: credits,
      );

      final result = await repo.purchasePack(CarPackType.starter);
      expect(result, isA<PurchaseSuccess>());
      expect((result as PurchaseSuccess).creditsAdded, 8);
      expect(credits.grantCalls, 1);
      expect(credits.lastProductId, 'drevvy_keys_5');
      expect(credits.lastTransactionId, 'txn_5');
      expect((await repo.getCreditBalance()).balance, 8);

      store.outcome = const StorePurchaseSucceeded(transactionId: 'txn_5');
      final repeat = await repo.purchasePack(CarPackType.starter);
      expect(repeat, isA<PurchaseSuccess>());
      expect((repeat as PurchaseSuccess).creditsAdded, 0);
      expect(credits.grantCalls, 1);
      expect((await repo.getCreditBalance()).balance, 8);
    });

    test('cancellation, pending, and a failed grant do not add keys', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final store = _FakeStore()..outcome = const StorePurchaseCancelled();
      final credits = _ScriptedCredits(
        grantResult: const CarCreditBalance(
          balance: 5,
          totalPurchased: 5,
          totalSpent: 0,
          totalRefunded: 0,
        ),
      );
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: credits,
        initialBalance: const CarCreditBalance.withBalance(2),
      );

      expect(
        await repo.purchasePack(CarPackType.starter),
        isA<PurchaseCancelled>(),
      );
      store.outcome = const StorePurchasePending();
      expect(
        await repo.purchasePack(CarPackType.starter),
        isA<PurchasePending>(),
      );
      expect(credits.grantCalls, 0);
      expect((await repo.getCreditBalance()).balance, 2);

      store.outcome = const StorePurchaseSucceeded(
        transactionId: 'txn_unverified',
      );
      credits.grantError = const ApiConfigException(
        'Purchase could not be verified.',
      );
      final failed = await repo.purchasePack(CarPackType.starter);
      expect(failed, isA<PurchaseError>());
      expect(
        (failed as PurchaseError).message,
        'Purchase could not be verified.',
      );
      expect((await repo.getCreditBalance()).balance, 2);
    });

    test('a live credits error body is not a local grant', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final store = _FakeStore()
        ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_402');
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: HttpCreditsEndpoint(
          baseUrl: 'https://api.drevvy.com',
          strict: true,
          sessionStore: ShopperSessionStore(),
          client: MockClient(
            (request) async => http.Response(
              jsonEncode({
                'success': false,
                'error': {
                  'code': 'unverified_purchase',
                  'message': 'Purchase could not be verified.',
                },
              }),
              402,
            ),
          ),
        ),
        initialBalance: const CarCreditBalance.withBalance(1),
      );

      final result = await repo.purchasePack(CarPackType.single);
      expect(result, isA<PurchaseError>());
      expect(
        (result as PurchaseError).message,
        'Purchase could not be verified.',
      );
      expect((await repo.getCreditBalance()).balance, 1);
    });

    test('restore uses the server balance', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final store = _FakeStore()
        ..restored = const [
          RestoredTransaction(
            transactionId: 'txn_5',
            packType: CarPackType.starter,
          ),
          RestoredTransaction(
            transactionId: 'txn_25',
            packType: CarPackType.plus,
          ),
        ];
      final credits = _ScriptedCredits(
        restoreResult: const CarCreditBalance(
          balance: 4,
          totalPurchased: 4,
          totalSpent: 0,
          totalRefunded: 0,
        ),
      );
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: credits,
        initialBalance: const CarCreditBalance.withBalance(1),
      );

      final result = await repo.restorePurchases();
      expect(result, isA<RestoreSuccess>());
      final success = result as RestoreSuccess;
      expect(success.countKnown, isTrue);
      expect(success.creditsRestored, 3);
      expect(restoreResultMessage(success, demo: false), 'Restored 3 keys.');
      expect(credits.lastRestoreIds, ['txn_5', 'txn_25']);
      expect((await repo.getCreditBalance()).balance, 4);
    });

    test('an unchanged server balance does not say keys were added', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final store = _FakeStore()
        ..restored = const [
          RestoredTransaction(
            transactionId: 'txn_same',
            packType: CarPackType.single,
          ),
        ];
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: _ScriptedCredits(
          restoreResult: const CarCreditBalance(
            balance: 4,
            totalPurchased: 4,
            totalSpent: 0,
            totalRefunded: 0,
          ),
        ),
        initialBalance: const CarCreditBalance.withBalance(4),
      );

      final result = await repo.restorePurchases();
      expect(result, isA<RestoreSuccess>());
      final success = result as RestoreSuccess;
      expect(success.countKnown, isTrue);
      expect(success.creditsRestored, 0);
      expect(
        restoreResultMessage(success, demo: false),
        'No new keys were added.',
      );
      expect((await repo.getCreditBalance()).balance, 4);
    });

    test(
      'a restore without a loaded balance does not say zero keys were added',
      () async {
        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        addTearDown(() => debugDefaultTargetPlatformOverride = null);

        final store = _FakeStore()
          ..restored = const [
            RestoredTransaction(
              transactionId: 'txn_unloaded',
              packType: CarPackType.starter,
            ),
          ];
        final repo = DemoRepository(
          config: _liveOrigin,
          networkDelay: Duration.zero,
          purchaseService: RevenueCatPurchaseService(gateway: store),
          credits: _ScriptedCredits(
            restoreResult: const CarCreditBalance(
              balance: 8,
              totalPurchased: 8,
              totalSpent: 0,
              totalRefunded: 0,
            ),
          ),
        );

        final result = await repo.restorePurchases();
        expect(result, isA<RestoreSuccess>());
        final success = result as RestoreSuccess;
        expect(success.countKnown, isFalse);
        expect(success.creditsRestored, 0);
        expect(
          restoreResultMessage(success, demo: false),
          'Purchases restored. Your key balance is updated.',
        );
        expect(
          restoreResultMessage(success, demo: false),
          isNot('No new keys were added.'),
        );
        expect((await repo.getCreditBalance()).balance, 8);
      },
    );

    test('a second tap is rejected while a purchase is open', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      final gate = Completer<void>();
      final store = _FakeStore()
        ..hold = gate.future
        ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_hold');
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: _ScriptedCredits(
          grantResult: const CarCreditBalance(
            balance: 1,
            totalPurchased: 1,
            totalSpent: 0,
            totalRefunded: 0,
          ),
        ),
      );

      final first = repo.purchasePack(CarPackType.single);
      await store.started.future;
      final second = await repo.purchasePack(CarPackType.single);
      expect(second, isA<PurchaseError>());
      expect((second as PurchaseError).code, 'in_flight');
      gate.complete();
      expect(await first, isA<PurchaseSuccess>());
      expect((await repo.getCreditBalance()).balance, 1);
    });

    test('demo added keys are labeled as samples', () {
      expect(
        keysAddedMessage(added: 5, demo: true),
        'Added 5 sample keys in this demo.',
      );
      expect(
        keysAddedMessage(added: 1, demo: true),
        'Added 1 sample key in this demo.',
      );
      expect(
        keysAddedMessage(added: 5, demo: false),
        'Added 5 keys. Packs never expire.',
      );
      expect(
        keysAddedMessage(added: 0, demo: true),
        'Purchase confirmed. No new keys were added.',
      );
    });

    test('a restore with no added keys does not say keys were added', () {
      expect(
        restoreResultMessage(
          const RestoreSuccess(creditsRestored: 0),
          demo: false,
        ),
        'No new keys were added.',
      );
      expect(
        restoreResultMessage(
          const RestoreSuccess(creditsRestored: 15),
          demo: true,
        ),
        'Restored 15 sample keys in this demo.',
      );
      expect(
        restoreResultMessage(const RestoreNoPurchases(), demo: true),
        'No purchases to restore.',
      );
      expect(
        restoreResultMessage(
          const RestoreError(message: 'Purchases were not restored.'),
          demo: false,
        ),
        'Purchases were not restored.',
      );
    });

    test('a purchase that finishes after sign-out does not add keys', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);
      final sessions = _bindSession();
      final gate = Completer<void>();
      final store = _FakeStore()
        ..hold = gate.future
        ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_late');
      final credits = _ScriptedCredits(
        grantResult: const CarCreditBalance(
          balance: 9,
          totalPurchased: 9,
          totalSpent: 0,
          totalRefunded: 0,
        ),
      );
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: credits,
        initialBalance: const CarCreditBalance.withBalance(2),
      );
      sessions.bind(repo);
      sessions.store.session = const ShopperSession(
        accessToken: 'jwt-a',
        consumerUserId: 'user-a',
      );

      final pending = repo.purchasePack(CarPackType.single);
      await store.started.future;
      sessions.store.session = null;
      gate.complete();
      final result = await pending;

      expect(result, isA<PurchaseError>());
      expect((result as PurchaseError).code, 'stale_account');
      expect(credits.grantCalls, 0);
      expect((await repo.getCreditBalance()).balance, 0);
    });

    test(
      'a purchase that finishes after an account switch does not add keys',
      () async {
        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        addTearDown(() => debugDefaultTargetPlatformOverride = null);
        final sessions = _bindSession();
        final gate = Completer<void>();
        final store = _FakeStore()
          ..hold = gate.future
          ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_switch');
        final credits = _ScriptedCredits(
          grantResult: const CarCreditBalance(
            balance: 9,
            totalPurchased: 9,
            totalSpent: 0,
            totalRefunded: 0,
          ),
        );
        final repo = DemoRepository(
          config: _liveOrigin,
          networkDelay: Duration.zero,
          purchaseService: RevenueCatPurchaseService(gateway: store),
          credits: credits,
          initialBalance: const CarCreditBalance.withBalance(2),
        );
        sessions.bind(repo);
        sessions.store.session = const ShopperSession(
          accessToken: 'jwt-a',
          consumerUserId: 'user-a',
        );

        final pending = repo.purchasePack(CarPackType.starter);
        await store.started.future;
        sessions.store.session = const ShopperSession(
          accessToken: 'jwt-b',
          consumerUserId: 'user-b',
        );
        gate.complete();
        final result = await pending;

        expect((result as PurchaseError).code, 'stale_account');
        expect(credits.grantCalls, 0);
        expect((await repo.getCreditBalance()).balance, 0);
      },
    );

    test(
      'a restore that finishes after sign-out does not replace the balance',
      () async {
        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        addTearDown(() => debugDefaultTargetPlatformOverride = null);
        final sessions = _bindSession();
        final gate = Completer<void>();
        final store = _FakeStore()
          ..restoreHold = gate.future
          ..restored = const [
            RestoredTransaction(
              transactionId: 'txn_old',
              packType: CarPackType.plus,
            ),
          ];
        final credits = _ScriptedCredits(
          restoreResult: const CarCreditBalance(
            balance: 25,
            totalPurchased: 25,
            totalSpent: 0,
            totalRefunded: 0,
          ),
        );
        final repo = DemoRepository(
          config: _liveOrigin,
          networkDelay: Duration.zero,
          purchaseService: RevenueCatPurchaseService(gateway: store),
          credits: credits,
          initialBalance: const CarCreditBalance.withBalance(3),
        );
        sessions.bind(repo);
        sessions.store.session = const ShopperSession(
          accessToken: 'jwt-a',
          consumerUserId: 'user-a',
        );

        final pending = repo.restorePurchases();
        await store.restoreStarted.future;
        sessions.store.session = null;
        gate.complete();
        final result = await pending;

        expect(result, isA<RestoreNoPurchases>());
        expect(
          restoreResultMessage(result, demo: false),
          'No purchases to restore.',
        );
        expect(credits.lastRestoreIds, isNull);
        expect((await repo.getCreditBalance()).balance, 0);
      },
    );

    test('a restore that finishes after an account switch does not replace the balance', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);
      final sessions = _bindSession();
      final gate = Completer<void>();
      final store = _FakeStore()
        ..restoreHold = gate.future
        ..restored = const [
          RestoredTransaction(
            transactionId: 'txn_switch',
            packType: CarPackType.plus,
          ),
        ];
      final credits = _ScriptedCredits(
        restoreResult: const CarCreditBalance(
          balance: 25,
          totalPurchased: 25,
          totalSpent: 0,
          totalRefunded: 0,
        ),
      );
      final repo = DemoRepository(
        config: _liveOrigin,
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: credits,
        initialBalance: const CarCreditBalance.withBalance(3),
      );
      sessions.bind(repo);
      sessions.store.session = const ShopperSession(
        accessToken: 'jwt-a',
        consumerUserId: 'user-a',
      );

      final pending = repo.restorePurchases();
      await store.restoreStarted.future;
      sessions.store.session = const ShopperSession(
        accessToken: 'jwt-b',
        consumerUserId: 'user-b',
      );
      gate.complete();
      final result = await pending;

      expect(result, isA<RestoreNoPurchases>());
      expect(
        restoreResultMessage(result, demo: false),
        'No purchases to restore.',
      );
      expect(credits.lastRestoreIds, isNull);
      expect((await repo.getCreditBalance()).balance, 0);
    });

    test('a demo purchase after sign-out does not add sample keys', () async {
      final sessions = _bindSession();
      final gate = Completer<void>();
      final store = _FakeStore()
        ..hold = gate.future
        ..outcome = const StorePurchaseSucceeded(transactionId: 'txn_demo');
      final repo = DemoRepository(
        networkDelay: Duration.zero,
        purchaseService: RevenueCatPurchaseService(gateway: store),
        credits: const MissingCreditsEndpoint(),
        initialBalance: const CarCreditBalance.withBalance(1),
      );
      sessions.bind(repo);

      final pending = repo.purchasePack(CarPackType.single);
      await store.started.future;
      repo.clearSignedInState();
      gate.complete();
      final result = await pending;

      expect((result as PurchaseError).code, 'stale_account');
      expect((await repo.getCreditBalance()).balance, 6);
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

class _BoundSession {
  _BoundSession(this.store, this.previousIdentity, this.previousCleared);

  final ShopperSessionStore store;
  final void Function()? previousIdentity;
  final void Function()? previousCleared;

  void bind(DemoRepository repo) {
    store.onIdentityChanged = repo.noteSignedInIdentity;
    store.onSessionCleared = repo.clearSignedInState;
  }
}

_BoundSession _bindSession() {
  final store = ShopperSessionStore.instance;
  final bound = _BoundSession(
    store,
    store.onIdentityChanged,
    store.onSessionCleared,
  );
  store.session = null;
  addTearDown(() {
    store.onIdentityChanged = bound.previousIdentity;
    store.onSessionCleared = bound.previousCleared;
    store.session = null;
  });
  return bound;
}

class _FakeStore implements StoreGateway {
  StorePurchaseOutcome outcome = const StorePurchaseSucceeded(
    transactionId: 'txn',
  );
  List<RestoredTransaction> restored = const [];
  CarPackType? purchased;
  String? loggedInUserId;
  bool loggedOut = false;
  Future<void>? hold;
  Future<void>? restoreHold;
  final Completer<void> started = Completer<void>();
  final Completer<void> restoreStarted = Completer<void>();

  @override
  Future<void> configure() async {}

  @override
  Future<List<CarPackOffering>> getOfferings() async {
    return const [
      CarPackOffering(
        packType: CarPackType.single,
        localizedPrice: r'$4.99',
        currencyCode: 'USD',
        priceAmount: 4.99,
      ),
      CarPackOffering(
        packType: CarPackType.starter,
        localizedPrice: r'$19.99',
        currencyCode: 'USD',
        priceAmount: 19.99,
      ),
      CarPackOffering(
        packType: CarPackType.bestValue,
        localizedPrice: r'$34.99',
        currencyCode: 'USD',
        priceAmount: 34.99,
      ),
      CarPackOffering(
        packType: CarPackType.plus,
        localizedPrice: r'$74.99',
        currencyCode: 'USD',
        priceAmount: 74.99,
      ),
    ];
  }

  @override
  Future<StorePurchaseOutcome> purchase(CarPackType packType) async {
    purchased = packType;
    if (!started.isCompleted) started.complete();
    final pending = hold;
    if (pending != null) await pending;
    return outcome;
  }

  @override
  Future<List<RestoredTransaction>> restore() async {
    if (!restoreStarted.isCompleted) restoreStarted.complete();
    final pending = restoreHold;
    if (pending != null) await pending;
    return restored;
  }

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
  _ScriptedCredits({this.grantResult, this.restoreResult});

  final CarCreditBalance? grantResult;
  final CarCreditBalance? restoreResult;
  ApiConfigException? grantError;
  String? lastProductId;
  String? lastTransactionId;
  List<String>? lastRestoreIds;
  int grantCalls = 0;

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async {
    grantCalls += 1;
    lastProductId = productId;
    lastTransactionId = transactionId;
    final error = grantError;
    if (error != null) throw error;
    return grantResult;
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async {
    lastRestoreIds = transactionIds;
    return restoreResult;
  }

  @override
  Future<CarCreditBalance?> fetchBalance() async {
    return null;
  }
}
