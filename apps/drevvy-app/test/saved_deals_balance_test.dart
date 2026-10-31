import 'dart:io';
import 'dart:ui' as ui;

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/deal.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/account/widgets/car_balance_card.dart';
import 'package:drevvy_app/features/deals/widgets/accept_confirm_sheet.dart';
import 'package:drevvy_app/features/deals/widgets/ended_deal_notice.dart';
import 'package:drevvy_app/features/deals/widgets/offer_rounds.dart';
import 'package:drevvy_app/features/shop/car_unlock.dart';
import 'package:drevvy_app/features/shop/widgets/inventory_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const _captureScreens = bool.fromEnvironment('CAPTURE_SCREENS');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('unlock gate', () {
    test('a balance above zero is ready to move into Deals', () {
      expect(
        carUnlockGate(const CarCreditBalance.withBalance(2)),
        CarUnlockGate.ready,
      );
    });

    test('a shopper who has never bought a pack sees the pack picker', () {
      expect(
        carUnlockGate(const CarCreditBalance.empty()),
        CarUnlockGate.firstPack,
      );
    });

    test('a used-up balance is the out-of-cars state', () {
      expect(
        carUnlockGate(
          const CarCreditBalance(
            balance: 0,
            totalPurchased: 3,
            totalSpent: 3,
            totalRefunded: 0,
          ),
        ),
        CarUnlockGate.outOfCars,
      );
    });
  });

  group('saved cars move to deals', () {
    late DemoRepository repo;

    setUp(() {
      repo = DemoRepository(networkDelay: Duration.zero);
    });

    test('unlock removes the car from Saved and spends one car', () async {
      await repo.getSavedCars();
      final before = (await repo.getCreditBalance()).balance;
      final saved = (await repo.getSavedCars()).firstWhere(
        (car) => car.id == 'saved_001',
      );

      final deal = await repo.moveToDeals(saved.id);

      expect(deal, isNotNull);
      expect(deal!.listingId, 'listing_008');
      expect(deal.status, DealStatus.reachingOut);
      final savedAfter = await repo.getSavedCars();
      expect(savedAfter.any((car) => car.listingId == 'listing_008'), isFalse);
      expect((await repo.getCreditBalance()).balance, before - 1);
      expect((await repo.getDeals()).any((item) => item.id == deal.id), isTrue);
    });

    test('unlock from the detail path also leaves Saved', () async {
      await repo.getSavedCars();
      final listing = await repo.getListingById('listing_009');
      await repo.addDeal(listing);

      final saved = await repo.getSavedCars();
      expect(saved.any((car) => car.listingId == 'listing_009'), isFalse);
      expect(repo.isListingInDeals('listing_009'), isTrue);
    });

    test('a second unlock does not spend another car', () async {
      await repo.getSavedCars();
      final listing = await repo.getListingById('listing_008');
      await repo.addDeal(listing);
      final balance = (await repo.getCreditBalance()).balance;

      await repo.addDeal(listing);

      expect((await repo.getCreditBalance()).balance, balance);
    });

    test('zero cars leaves the saved car in place', () async {
      repo = DemoRepository(
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance(
          balance: 0,
          totalPurchased: 5,
          totalSpent: 5,
          totalRefunded: 0,
        ),
      );
      await repo.getSavedCars();
      final saved = (await repo.getSavedCars()).firstWhere(
        (car) => car.id == 'saved_001',
      );

      expect(await repo.moveToDeals(saved.id), isNull);
      expect(
        (await repo.getSavedCars()).any((car) => car.id == 'saved_001'),
        isTrue,
      );
    });

    test('a sold saved car stays out of Shop results', () async {
      final sold = await repo.getListingById('listing_sold_010');
      expect(sold.build.model, 'Outback');
      expect(
        (await repo.getSavedCars()).any((car) => car.isNoLongerListed),
        isTrue,
      );
      final shop = await repo.searchListings();
      expect(shop.any((listing) => listing.id == 'listing_sold_010'), isFalse);
    });
  });

  group('deal and balance screens', () {
    setUp(() async {
      final binding = TestWidgetsFlutterBinding.ensureInitialized();
      binding.platformDispatcher.views.first
        ..physicalSize = const Size(420, 900)
        ..devicePixelRatio = 1;
      if (_captureScreens) await _loadManrope();
    });

    tearDown(() {
      final view = TestWidgetsFlutterBinding.ensureInitialized()
          .platformDispatcher
          .views
          .first;
      view.resetPhysicalSize();
      view.resetDevicePixelRatio();
    });

    testWidgets('rounds show the price drop and cross off removed fees', (
      tester,
    ) async {
      await tester.pumpWidget(_frame(OfferRounds(offers: _rounds())));
      await tester.pumpAndSettle();

      expect(find.text('Price rounds'), findsOneWidget);
      expect(find.text('Down \$1,705 from the last round'), findsOneWidget);
      expect(find.text('Down \$1,330 from the last round'), findsOneWidget);
      expect(find.text('Round 1'), findsOneWidget);
      final removed = tester.widget<Text>(find.text('Nitrogen fill').first);
      expect(removed.style?.decoration, TextDecoration.lineThrough);
      expect(find.textContaining('negotiate'), findsNothing);
      await _maybeCapture(tester, 'deal-price-rounds');
    });

    testWidgets('sold and no-response states offer similar cars', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        _frame(
          Column(
            children: [
              EndedDealNotice(
                status: DealStatus.noLongerListed,
                onFindSimilar: () => taps++,
              ),
              EndedDealNotice(
                status: DealStatus.noResponse,
                onFindSimilar: () => taps++,
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No longer listed (likely sold)'), findsOneWidget);
      expect(find.text('No dealer response after 7 days'), findsOneWidget);
      expect(find.text('Find similar cars'), findsNWidgets(2));
      await tester.tap(find.text('Find similar cars').first);
      await tester.pump();
      expect(taps, 1);
      await _maybeCapture(tester, 'deal-sold-and-no-response');
    });

    testWidgets('accept asks for confirmation before it commits', (
      tester,
    ) async {
      var accepted = false;
      await tester.pumpWidget(
        _frame(
          AcceptConfirmSheet(
            deal: _dealWithOffer(),
            onAccept: () => accepted = true,
            onNotYet: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Accept \$23,100 out the door?'), findsOneWidget);
      expect(
        find.text('Drevvy will tell Dealer A and request the official written offer.'),
        findsOneWidget,
      );
      expect(find.textContaining('Drevvy never accepts for you'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pump();
      expect(accepted, isFalse);

      await tester.tap(find.text('Confirm'));
      await tester.pump();
      expect(accepted, isTrue);
      await _maybeCapture(tester, 'deal-accept-confirm');
    });

    testWidgets('account balance shows cars left and the out-of-cars state', (
      tester,
    ) async {
      await tester.pumpWidget(
        _frame(
          Column(
            children: [
              CarBalanceCard(
                balance: const CarCreditBalance.withBalance(6),
                onBuy: () {},
              ),
              const SizedBox(height: 16),
              CarBalanceCard(
                balance: const CarCreditBalance(
                  balance: 0,
                  totalPurchased: 3,
                  totalSpent: 3,
                  totalRefunded: 0,
                ),
                onBuy: () {},
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('keys left · packs never expire'), findsOneWidget);
      expect(find.text('Buy keys'), findsOneWidget);
      expect(find.text('Out of keys'), findsOneWidget);
      expect(find.text('Add keys'), findsOneWidget);
      expect(find.textContaining('Max out-the-door'), findsNothing);
      await _maybeCapture(tester, 'car-balance');
    });

    testWidgets('every shop car card has a save button', (tester) async {
      var saved = false;
      await tester.pumpWidget(
        _frame(
          InventoryCard(
            listing: _listing(),
            onTap: () {},
            onSaveToggle: () => saved = true,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel('Save car'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Save car'));
      await tester.pump();
      expect(saved, isTrue);
    });
  });

  test('shopper copy does not say negotiate or max out-the-door', () {
    const files = [
      'lib/features/deals/widgets/offer_rounds.dart',
      'lib/features/deals/widgets/ended_deal_notice.dart',
      'lib/features/account/widgets/car_balance_card.dart',
      'lib/features/shop/car_unlock.dart',
      'lib/features/saved/screens/saved_screen.dart',
      'lib/features/deals/screens/deal_detail_screen.dart',
      'lib/features/deals/screens/deal_timeline_screen.dart',
      'lib/data/models/car_pack.dart',
      'lib/features/shop/widgets/vdp_cta_bar.dart',
      'lib/features/shop/widgets/dealer_chat_sheet.dart',
      'lib/features/shop/widgets/otd_request_sheet.dart',
      'lib/features/shop/widgets/dealer_inbox_stub.dart',
      'lib/features/onboarding/screens/onboarding_flow_screen.dart',
      'lib/features/onboarding/matters_v5.dart',
      'lib/features/onboarding/widgets/onboarding_steps.dart',
    ];
    for (final path in files) {
      final text = File(path).readAsStringSync().toLowerCase();
      expect(text.contains('negotiate'), isFalse, reason: path);
      expect(text.contains('max out-the-door'), isFalse, reason: path);
    }
  });
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(
      body: RepaintBoundary(
        key: const Key('shot'),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ),
    ),
  );
}

Future<void> _loadManrope() async {
  final loader = FontLoader('Manrope');
  for (final file in const [
    'Manrope-Medium.ttf',
    'Manrope-SemiBold.ttf',
    'Manrope-Bold.ttf',
    'Manrope-ExtraBold.ttf',
  ]) {
    final bytes = await File('assets/fonts/$file').readAsBytes();
    loader.addFont(Future.value(bytes.buffer.asByteData()));
  }
  await loader.load();
}

Future<void> _maybeCapture(WidgetTester tester, String name) async {
  if (!_captureScreens) return;
  await tester.pumpAndSettle();
  await tester.runAsync(() async {
    final boundary = tester.renderObject<RenderRepaintBoundary>(
      find.byKey(const Key('shot')),
    );
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final file = File('/opt/cursor/artifacts/screenshots/$name.png');
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes!.buffer.asUint8List());
  });
}

Listing _listing() {
  return const Listing(
    id: 'listing_008',
    vin: '19XFC2F59NE123456',
    price: 21990,
    miles: 41200,
    build: ListingBuild(
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      trim: 'Sport',
      bodyType: 'Sedan',
      drivetrain: 'FWD',
    ),
    media: ListingMedia(photoLinks: []),
    dist: 9,
  );
}

Deal _dealWithOffer() {
  return Deal(
    id: 'deal_test',
    listingId: 'listing_008',
    letter: 'A',
    status: DealStatus.offerReceived,
    listedAtStart: 21990,
    addedAt: DateTime(2026, 10, 1),
    listing: _listing(),
    offers: [
      Offer(
        id: 'offer_test',
        receivedAt: DateTime(2026, 10, 2),
        otd: 23100,
        vehiclePrice: 20500,
        lines: const [OfferLine(key: 'Vehicle price', amount: 20500)],
      ),
    ],
  );
}

List<Offer> _rounds() {
  return [
    Offer(
      id: 'offer_1',
      receivedAt: DateTime(2026, 10, 1),
      otd: 36450,
      vehiclePrice: 32100,
      lines: const [],
    ),
    Offer(
      id: 'offer_2',
      receivedAt: DateTime(2026, 10, 3),
      otd: 35120,
      vehiclePrice: 31200,
      lines: const [],
      removedAddOns: const [OfferLine(key: 'Nitrogen fill', amount: 199)],
    ),
    Offer(
      id: 'offer_3',
      receivedAt: DateTime(2026, 10, 5),
      otd: 33415,
      vehiclePrice: 30700,
      lines: const [],
      removedAddOns: const [
        OfferLine(key: 'Paint protection', amount: 895),
        OfferLine(key: 'Nitrogen fill', amount: 199),
      ],
    ),
  ];
}
