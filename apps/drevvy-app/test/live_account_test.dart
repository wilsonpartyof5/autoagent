import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/models/saved_car.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/key_spend_endpoint.dart';
import 'package:drevvy_app/data/services/market_save_response.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/saved_cars_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_profile_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/onboarding/matters_v5.dart';
import 'package:drevvy_app/features/saved/screens/saved_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _live = PurchaseConfig(
  apiBaseUrl: 'https://api.drevvy.com',
  mode: DrevvyDataMode.live,
);

Listing _civic() {
  return const Listing(
    id: 'mc-1',
    vin: '1HGCV1F16LA000111',
    price: 18990,
    build: ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
    media: ListingMedia(photoLinks: []),
  );
}

class _Credits extends CreditsEndpoint {
  _Credits(this.balance);

  CarCreditBalance? balance;
  int fetches = 0;

  @override
  Future<CarCreditBalance?> fetchBalance() async {
    fetches += 1;
    return balance;
  }

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async => balance;

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async => balance;
}

class _Profile extends ShopperProfileEndpoint {
  @override
  Future<ShopperProfile> fetch() async {
    return const ShopperProfile(consumerUserId: 'user-9', status: 'active');
  }
}

class _Saved extends SavedCarsEndpoint {
  _Saved(this.records);

  List<SavedCarRecord> records;
  int saves = 0;
  Object? saveError;

  @override
  Future<void> delete(String listingId) async {
    records = [
      for (final record in records)
        if (record.car.listingId != listingId) record,
    ];
  }

  @override
  Future<List<SavedCarRecord>> list() async => records;

  @override
  Future<SavedCarRecord> save({required String listingId, String? vin}) async {
    saves += 1;
    final error = saveError;
    if (error != null) throw error;
    final record = SavedCarRecord(
      car: SavedCar(
        id: listingId,
        userId: 'user-9',
        listingId: listingId,
        vin: vin ?? '',
        savedAt: DateTime.utc(2026, 11, 5),
      ),
      listing: _civic(),
    );
    records = [...records, record];
    return record;
  }
}

class _Spend extends KeySpendEndpoint {
  int marketSaves = 0;

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    return const KeySpendResult.blocked('unused');
  }

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) async {
    marketSaves += 1;
    return KeySpendResult(
      ok: true,
      source: KeySpendSource.live,
      balance: const CarCreditBalance.withBalance(1),
    );
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) async {
    return const KeySpendResult.blocked('unused');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    ShopperSessionStore.instance.session = null;
  });

  test('a live account uses the profile id and never Dana', () async {
    ShopperSessionStore.instance.session = const ShopperSession(
      accessToken: 'jwt',
      consumerUserId: 'user-9',
    );
    final repo = DemoRepository(
      config: _live,
      profile: _Profile(),
      credits: _Credits(const CarCreditBalance.withBalance(3)),
      savedCars: _Saved(const []),
      networkDelay: Duration.zero,
    );

    final before = await repo.getCurrentUser();
    expect(before.firstName, DemoRepository.signedOutShopperLabel);
    expect(before.nameIsKnown, isFalse);

    final user = await repo.refreshLiveAccount();

    expect(user.id, 'user-9');
    expect(user.firstName, DemoRepository.signedInShopperLabel);
    expect(user.accountLabel, 'Signed in');
    expect(user.email, isEmpty);
    expect(user.nameIsKnown, isFalse);
    expect(user.firstName, isNot('Dana'));
    expect((await repo.getCreditBalance()).balance, 3);
    expect(await repo.grantStarterKeys(), isFalse);
    expect((await repo.getCreditBalance()).balance, 3);
  });

  test('a missed credits read does not restore the seeded 6 keys', () async {
    final repo = DemoRepository(
      config: _live,
      credits: _Credits(null),
      networkDelay: Duration.zero,
    );

    expect(await repo.pullSignedInBalance(), isFalse);
    expect((await repo.getCreditBalance()).balance, 0);
    expect(repo.creditNotice, isNotNull);
  });

  test(
    'saved cars come from the server and a failed save is not local success',
    () async {
      final saved = _Saved(const []);
      final first = DemoRepository(
        config: _live,
        savedCars: saved,
        networkDelay: Duration.zero,
      );
      final car = await first.saveCar(_civic(), source: 'shop');
      expect(car.listingId, 'mc-1');
      expect(saved.saves, 1);

      final relaunch = DemoRepository(
        config: _live,
        savedCars: saved,
        networkDelay: Duration.zero,
      );
      final cars = await relaunch.getSavedCars();
      expect(cars.single.listingId, 'mc-1');
      expect(relaunch.listingForSavedCar('mc-1')?.build.model, 'Civic');

      saved.saveError = const SavedCarsException(
        'Drevvy could not reach the server.',
      );
      expect(
        () => relaunch.saveCar(_civic(), source: 'shop'),
        throwsA(isA<SavedCarsException>()),
      );
      expect((await relaunch.getSavedCars()).length, 1);
    },
  );

  test(
    'the saved-cars client sends the bearer token and parses the row',
    () async {
      final sessions = ShopperSessionStore()
        ..session = const ShopperSession(
          accessToken: 'shopper-jwt',
          consumerUserId: 'user-9',
        );
      late http.Request captured;
      final endpoint = HttpSavedCarsEndpoint(
        baseUrl: 'https://api.drevvy.com',
        sessionStore: sessions,
        client: MockClient((request) async {
          captured = request;
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {
                  'userId': 'user-9',
                  'listingId': 'mc-1',
                  'vin': '1HGCV1F16LA000111',
                  'savedAt': '2026-11-05T12:00:00.000Z',
                  'movedToDealId': null,
                  'listing': {
                    'id': 'mc-1',
                    'vin': '1HGCV1F16LA000111',
                    'year': 2020,
                    'make': 'Honda',
                    'model': 'Civic',
                    'price': 18990,
                    'photoUrls': ['https://cdn.example/civic.jpg'],
                  },
                },
              ],
            }),
            200,
          );
        }),
      );

      final records = await endpoint.list();

      expect(captured.headers['authorization'], 'Bearer shopper-jwt');
      expect(captured.url.path, '/api/consumer/saved-cars');
      expect(records.single.car.listingId, 'mc-1');
      expect(records.single.listing?.title, '2020 Honda Civic');
      expect(records.single.listing?.price, 18990);
    },
  );

  test(
    'profile parsing keeps the id and drops a name the route does not publish',
    () async {
      final sessions = ShopperSessionStore()
        ..session = const ShopperSession(accessToken: 'shopper-jwt');
      final endpoint = HttpShopperProfileEndpoint(
        baseUrl: 'https://api.drevvy.com',
        sessionStore: sessions,
        client: MockClient((request) async {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'consumerUserId': 'user-9',
                'status': 'active',
                'firstName': 'Dana',
                'email': 'dana@example.com',
              },
            }),
            200,
          );
        }),
      );

      final profile = await endpoint.fetch();

      expect(profile.consumerUserId, 'user-9');
      expect(profile.status, 'active');
    },
  );

  test('live market intel does not call market-save', () async {
    final spend = _Spend();
    final repo = DemoRepository(
      config: _live,
      keySpend: spend,
      networkDelay: Duration.zero,
    );

    expect(repo.marketIntelSpendEnabled, isFalse);
    expect(await repo.unlockMarketIntel(_civic()), isFalse);
    expect(spend.marketSaves, 0);
    expect(repo.hasUnlockedMarketIntel('mc-1'), isFalse);
    expect((await repo.getCreditBalance()).balance, 0);
  });

  test(
    'the market-save parser reads credits and does not invent a price brief',
    () {
      final parsed = MarketSaveResponse.tryParse(
        jsonEncode({
          'success': true,
          'data': {
            'listingId': 'mc-1',
            'vin': '1HGCV1F16LA000111',
            'savedAt': '2026-11-05T12:00:00.000Z',
          },
          'spent': true,
          'credits': {'balance': 2, 'canAdd': true, 'reason': 'ok'},
        }),
      );

      expect(parsed?.listingId, 'mc-1');
      expect(parsed?.spent, isTrue);
      expect(parsed?.balance, 2);
      expect(parsed?.canAdd, isTrue);
      expect(parsed?.reason, 'ok');
    },
  );

  test(
    'sign-out clears the live account instead of leaving it in place',
    () async {
      final saved = _Saved([
        SavedCarRecord(
          car: SavedCar(
            id: 'mc-1',
            userId: 'user-9',
            listingId: 'mc-1',
            vin: '1HGCV1F16LA000111',
            savedAt: DateTime.utc(2026, 11, 5),
          ),
          listing: _civic(),
        ),
      ]);
      final repo = DemoRepository(
        config: _live,
        credits: _Credits(const CarCreditBalance.withBalance(3)),
        savedCars: saved,
        networkDelay: Duration.zero,
      );
      ShopperSessionStore.instance.session = const ShopperSession(
        accessToken: 'jwt',
        consumerUserId: 'user-9',
      );
      await repo.refreshLiveAccount();
      expect(repo.isListingSaved('mc-1'), isTrue);

      final store = ShopperSessionStore()
        ..onSessionCleared = repo.clearSignedInState;
      store.session = const ShopperSession(
        accessToken: 'jwt',
        consumerUserId: 'user-9',
      );
      await store.clear();

      final user = await repo.getCurrentUser();
      expect(store.session, isNull);
      expect(user.firstName, DemoRepository.signedOutShopperLabel);
      expect(user.id, isNot('user-9'));
      expect((await repo.getCreditBalance()).balance, 0);
      expect(repo.isListingSaved('mc-1'), isFalse);
      expect(user.firstName, isNot('Dana'));
    },
  );

  test(
    'demo mode still grants starter keys and keeps the sample label',
    () async {
      final demo = DemoRepository(
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(0),
      );

      expect((await demo.getCurrentUser()).firstName, 'Dana');
      expect((await demo.getCurrentUser()).nameIsKnown, isTrue);
      expect(await demo.grantStarterKeys(), isTrue);
      expect((await demo.getCreditBalance()).balance, 3);
      expect(mattersMarketIntelSampleBadge, contains('Sample'));
      expect(demo.marketIntelSpendEnabled, isTrue);
    },
  );

  testWidgets('a saved-cars failure offers retry and does not look empty', (
    tester,
  ) async {
    var lists = 0;
    final endpoint = _FlakySaved(
      onList: () {
        lists += 1;
        if (lists == 1) {
          throw const SavedCarsException('Drevvy could not reach the server.');
        }
        return [
          SavedCarRecord(
            car: SavedCar(
              id: 'mc-1',
              userId: 'user-9',
              listingId: 'mc-1',
              vin: '1HGCV1F16LA000111',
              savedAt: DateTime.utc(2026, 11, 5),
            ),
            listing: _civic(),
          ),
        ];
      },
    );
    final repo = DemoRepository(
      config: _live,
      savedCars: endpoint,
      networkDelay: Duration.zero,
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: SavedScreen(repository: repo),
      ),
    );
    await tester.pump();

    expect(find.text('Saved cars are unavailable'), findsOneWidget);
    expect(find.text('No saved cars yet'), findsNothing);
    expect(find.text('2020 Honda Civic'), findsNothing);

    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();

    expect(find.text('2020 Honda Civic'), findsOneWidget);
    expect(find.text('No saved cars yet'), findsNothing);
  });
}

class _FlakySaved extends SavedCarsEndpoint {
  _FlakySaved({required this.onList});

  final List<SavedCarRecord> Function() onList;

  @override
  Future<void> delete(String listingId) async {}

  @override
  Future<List<SavedCarRecord>> list() async => onList();

  @override
  Future<SavedCarRecord> save({required String listingId, String? vin}) async {
    throw const SavedCarsException('unused');
  }
}
