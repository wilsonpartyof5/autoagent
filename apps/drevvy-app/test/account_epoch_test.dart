import 'dart:async';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/saved_car.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/saved_cars_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_profile_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:flutter_test/flutter_test.dart';

const _live = PurchaseConfig(
  apiBaseUrl: 'https://api.drevvy.com',
  mode: DrevvyDataMode.live,
);

Listing _car(String id) {
  return Listing(
    id: id,
    vin: 'VIN$id',
    price: 18000,
    build: const ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
    media: const ListingMedia(photoLinks: []),
  );
}

SavedCarRecord _record(String id, {String userId = 'user-a'}) {
  return SavedCarRecord(
    car: SavedCar(
      id: id,
      userId: userId,
      listingId: id,
      vin: 'VIN$id',
      savedAt: DateTime.utc(2026, 11, 5),
    ),
    listing: _car(id),
  );
}

class _GatedProfile extends ShopperProfileEndpoint {
  _GatedProfile(this.userId);

  String userId;
  final Completer<void> gate = Completer<void>();
  int calls = 0;

  @override
  Future<ShopperProfile> fetch() async {
    calls += 1;
    final id = userId;
    if (calls == 1) await gate.future;
    return ShopperProfile(consumerUserId: id, status: 'active');
  }
}

class _GatedCredits extends CreditsEndpoint {
  _GatedCredits(this.balance);

  CarCreditBalance? balance;
  final Completer<void> gate = Completer<void>();
  int fetches = 0;

  @override
  Future<CarCreditBalance?> fetchBalance() async {
    fetches += 1;
    final value = balance;
    if (fetches == 1) await gate.future;
    return value;
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

class _GatedSaved extends SavedCarsEndpoint {
  _GatedSaved(this.records);

  List<SavedCarRecord> records;
  final Completer<void> listGate = Completer<void>();
  Future<void>? writeHold;
  int lists = 0;
  int saves = 0;
  int deletes = 0;
  Object? listError;
  bool holdList = false;

  @override
  Future<List<SavedCarRecord>> list() async {
    lists += 1;
    if (holdList && lists == 1) await listGate.future;
    final error = listError;
    if (error != null) throw error;
    return records;
  }

  @override
  Future<SavedCarRecord> save({required String listingId, String? vin}) async {
    saves += 1;
    final saveHold = writeHold;
    if (saveHold != null) {
      writeHold = null;
      await saveHold;
    }
    final record = _record(listingId);
    records = [...records, record];
    return record;
  }

  @override
  Future<void> delete(String listingId) async {
    deletes += 1;
    final deleteHold = writeHold;
    if (deleteHold != null) {
      writeHold = null;
      await deleteHold;
    }
    records = [
      for (final record in records)
        if (record.car.listingId != listingId) record,
    ];
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ShopperSessionStore store;
  void Function()? previousIdentity;
  void Function()? previousCleared;

  setUp(() {
    store = ShopperSessionStore.instance;
    previousIdentity = store.onIdentityChanged;
    previousCleared = store.onSessionCleared;
    store.session = null;
  });

  tearDown(() {
    store.onIdentityChanged = previousIdentity;
    store.onSessionCleared = previousCleared;
    store.session = null;
  });

  void bind(DemoRepository repo) {
    store.onIdentityChanged = repo.noteSignedInIdentity;
    store.onSessionCleared = repo.clearSignedInState;
  }

  test('a late refresh does not restore a signed-out account', () async {
    final profile = _GatedProfile('user-a');
    final credits = _GatedCredits(const CarCreditBalance.withBalance(9));
    final saved = _GatedSaved([_record('mc-a')])..holdList = true;
    final repo = DemoRepository(
      config: _live,
      profile: profile,
      credits: credits,
      savedCars: saved,
      networkDelay: Duration.zero,
    );
    bind(repo);
    store.session = const ShopperSession(
      accessToken: 'jwt-a',
      consumerUserId: 'user-a',
    );
    await repo.addDeal(_car('deal-a'), spend: false);

    final refresh = repo.refreshLiveAccount();
    await Future<void>.delayed(Duration.zero);
    store.session = null;
    profile.gate.complete();
    credits.gate.complete();
    saved.listGate.complete();
    final user = await refresh;

    expect(user.firstName, DemoRepository.signedOutShopperLabel);
    expect(user.id, isNot('user-a'));
    expect((await repo.getCreditBalance()).balance, 0);
    expect(repo.creditNotice, isNull);
    expect(repo.isListingSaved('mc-a'), isFalse);
    expect(await repo.getDeals(), isEmpty);
    expect(repo.savedCarsError, isNull);
  });

  test(
    'a late refresh does not overwrite the account that signed in next',
    () async {
      final profile = _GatedProfile('user-a');
      final credits = _GatedCredits(const CarCreditBalance.withBalance(9));
      final saved = _GatedSaved([_record('mc-a')])..holdList = true;
      final repo = DemoRepository(
        config: _live,
        profile: profile,
        credits: credits,
        savedCars: saved,
        networkDelay: Duration.zero,
      );
      bind(repo);
      store.session = const ShopperSession(
        accessToken: 'jwt-a',
        consumerUserId: 'user-a',
      );

      final first = repo.refreshLiveAccount();
      await Future<void>.delayed(Duration.zero);
      profile.userId = 'user-b';
      credits.balance = const CarCreditBalance.withBalance(2);
      saved.records = [_record('mc-b', userId: 'user-b')];
      store.session = const ShopperSession(
        accessToken: 'jwt-b',
        consumerUserId: 'user-b',
      );
      profile.gate.complete();
      credits.gate.complete();
      saved.listGate.complete();
      await first;

      expect((await repo.getCurrentUser()).id, 'user-b');
      expect((await repo.getCreditBalance()).balance, 0);
      expect(repo.isListingSaved('mc-a'), isFalse);

      final second = await repo.refreshLiveAccount();
      expect(second.id, 'user-b');
      expect((await repo.getCreditBalance()).balance, 2);
      expect(repo.isListingSaved('mc-b'), isTrue);
      expect(repo.isListingSaved('mc-a'), isFalse);
      expect(await repo.getDeals(), isEmpty);
    },
  );

  test('a late saved-car error does not stick to the next account', () async {
    final saved = _GatedSaved(const [])
      ..holdList = true
      ..listError = const SavedCarsException('Could not load saved cars.');
    final repo = DemoRepository(
      config: _live,
      savedCars: saved,
      networkDelay: Duration.zero,
    );
    bind(repo);
    store.session = const ShopperSession(
      accessToken: 'jwt-a',
      consumerUserId: 'user-a',
    );

    final pending = repo.getSavedCars();
    await Future<void>.delayed(Duration.zero);
    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    saved.listGate.complete();
    await pending;

    expect(repo.savedCarsError, isNull);
    expect(repo.isListingSaved('mc-b'), isFalse);
    saved.listError = null;
    saved.records = [_record('mc-b', userId: 'user-b')];

    expect((await repo.getSavedCars()).single.listingId, 'mc-b');
    expect(repo.savedCarsError, isNull);
  });

  test(
    'a late heart save or delete does not change the next account',
    () async {
      final saved = _GatedSaved([_record('mc-a')]);
      final deleteHold = Completer<void>();
      saved.writeHold = deleteHold.future;
      final repo = DemoRepository(
        config: _live,
        savedCars: saved,
        networkDelay: Duration.zero,
      );
      bind(repo);
      store.session = const ShopperSession(
        accessToken: 'jwt-a',
        consumerUserId: 'user-a',
      );
      await repo.getSavedCars();
      expect(repo.isListingSaved('mc-a'), isTrue);

      final unsave = repo.unsaveByListingId('mc-a', source: 'shop');
      await Future<void>.delayed(Duration.zero);
      store.session = const ShopperSession(
        accessToken: 'jwt-b',
        consumerUserId: 'user-b',
      );
      saved.records = [_record('mc-b', userId: 'user-b')];
      await repo.getSavedCars();
      deleteHold.complete();

      await expectLater(unsave, throwsA(isA<StaleAccountException>()));
      expect(repo.isListingSaved('mc-b'), isTrue);
      expect(repo.isListingSaved('mc-a'), isFalse);

      final saveHold = Completer<void>();
      saved.writeHold = saveHold.future;
      final save = repo.saveCar(_car('mc-a'), source: 'shop');
      await Future<void>.delayed(Duration.zero);
      store.session = null;
      saveHold.complete();
      await expectLater(save, throwsA(isA<StaleAccountException>()));
      expect(repo.isListingSaved('mc-a'), isFalse);
      expect(repo.isListingSaved('mc-b'), isFalse);
      expect(
        (await repo.getCurrentUser()).firstName,
        DemoRepository.signedOutShopperLabel,
      );
    },
  );
}
