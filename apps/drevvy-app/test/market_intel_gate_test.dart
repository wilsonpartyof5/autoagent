import 'dart:io';
import 'dart:ui';

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/widgets/drevvy_buttons.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/onboarding/matters_v5.dart';
import 'package:drevvy_app/features/onboarding/widgets/onboarding_steps.dart';
import 'package:drevvy_app/features/shop/widgets/market_intel_gate.dart';
import 'package:drevvy_app/features/shop/widgets/market_intel_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/market_price_bar.dart';
import 'package:drevvy_app/features/shop/widgets/new_car_market_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const listing = Listing(
    id: 'listing_vdp_mi',
    vin: 'VINMI001',
    price: 32995,
    miles: 18420,
    build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
    domActive: 21,
  );
  const newListing = Listing(
    id: 'listing_vdp_mi_new',
    vin: 'VINMI002',
    price: 34990,
    msrp: 36990,
    inventoryType: 'new',
    build: ListingBuild(year: 2026, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
  );
  const market = MarketContext(
    fairVehiclePrice: 33900,
    fairOtd: 36000,
    lowPrice: 31000,
    medianPrice: 33500,
    highPrice: 36000,
    comparablesCount: 14,
    daysListedMedian: 38,
    priceDrops: 2,
  );
  const newMarket = MarketContext(
    fairVehiclePrice: 34990,
    fairOtd: 38490,
    lowPrice: 33490,
    medianPrice: 35490,
    highPrice: 37990,
    comparablesCount: 8,
    isNewCar: true,
    msrp: 36990,
    msrpDiscount: 2000,
  );

  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(800, 2000);
    view.devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  test('VDP teaser and confirm stay free of locked claims', () {
    for (final copy in [
      KeySpend.marketIntelTeaser,
      KeySpend.marketIntelUnlockedConfirm,
    ]) {
      final lower = copy.toLowerCase();
      expect(lower.contains('deal score'), isFalse, reason: copy);
      expect(lower.contains('talk point'), isFalse, reason: copy);
      expect(lower.contains('pack'), isFalse, reason: copy);
      expect(lower.contains('refund'), isFalse, reason: copy);
      expect(RegExp(r'\bsold\b').hasMatch(lower), isFalse, reason: copy);
    }
    expect(
      KeySpend.marketIntelTeaser,
      'See fair price, similar cars, days listed, price drops · 1 key',
    );
    expect(
      KeySpend.marketIntelUnlockedConfirm,
      'Fair price unlocked · Car saved.',
    );
  });

  testWidgets('locked gate blurs used-car MI and shows the teaser', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      _frame(
        MarketIntelGate(
          unlocked: false,
          onUnlock: () => taps++,
          child: Column(
            children: [
              MarketPriceBar(listing: listing, market: market),
              const SizedBox(height: 16),
              const Text('Days listed'),
            ],
          ),
        ),
      ),
    );

    expect(find.byType(ImageFiltered), findsOneWidget);
    expect(find.text(KeySpend.marketIntelTeaser), findsOneWidget);
    expect(find.byType(MarketPriceBar), findsOneWidget);
    expect(find.text('Days listed'), findsOneWidget);

    final filter = tester.widget<ImageFiltered>(find.byType(ImageFiltered));
    expect(filter.imageFilter, isA<ImageFilter>());

    await tester.tap(find.text(KeySpend.marketIntelTeaser));
    expect(taps, 1);
  });

  testWidgets('locked gate also wraps the new-car market card', (tester) async {
    await tester.pumpWidget(
      _frame(
        MarketIntelGate(
          unlocked: false,
          onUnlock: () {},
          child: NewCarMarketCard(listing: newListing, market: newMarket),
        ),
      ),
    );

    expect(find.byType(ImageFiltered), findsOneWidget);
    expect(find.byType(NewCarMarketCard), findsOneWidget);
    expect(find.text(KeySpend.marketIntelTeaser), findsOneWidget);
  });

  testWidgets('unlocked gate shows full MI and hides the teaser', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        MarketIntelGate(
          unlocked: true,
          onUnlock: () {},
          child: MarketPriceBar(listing: listing, market: market),
        ),
      ),
    );

    expect(find.byType(ImageFiltered), findsNothing);
    expect(find.text(KeySpend.marketIntelTeaser), findsNothing);
    expect(find.text('Market price'), findsOneWidget);
    expect(find.textContaining('Fair price'), findsOneWidget);
  });

  testWidgets('sheet confirm is Fair price unlocked · Car saved.', (
    tester,
  ) async {
    var confirmed = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: TextButton(
                onPressed: () {
                  showModalBottomSheet<void>(
                    context: context,
                    backgroundColor: Colors.transparent,
                    builder: (_) => MarketIntelSheet(
                      listing: listing,
                      creditBalance: const CarCreditBalance.withBalance(3),
                      onConfirm: () async {
                        confirmed = true;
                      },
                    ),
                  );
                },
                child: const Text('open sheet'),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('open sheet'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.widgetWithText(DrevvyPrimaryButton, KeySpend.marketIntelCta),
    );
    await tester.pump();
    expect(confirmed, isTrue);
    expect(find.text(KeySpend.marketIntelUnlockedConfirm), findsOneWidget);
    expect(find.text('Market intel unlocked.'), findsNothing);
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pumpAndSettle();
  });

  test('unlockMarketIntel spends one key, unlocks MI, and saves the car', () async {
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(4),
    );
    await repo.getSavedCars();
    final before = await repo.getCreditBalance();

    expect(repo.hasUnlockedMarketIntel(listing.id), isFalse);
    expect(repo.isListingSaved(listing.id), isFalse);

    final ok = await repo.unlockMarketIntel(listing);
    expect(ok, isTrue);
    expect(repo.hasUnlockedMarketIntel(listing.id), isTrue);
    expect(repo.isListingSaved(listing.id), isTrue);
    expect((await repo.getCreditBalance()).balance, before.balance - 1);

    final again = await repo.unlockMarketIntel(listing);
    expect(again, isTrue);
    expect((await repo.getCreditBalance()).balance, before.balance - 1);
  });

  testWidgets('onboarding MarketIntelStep stays unblurred and unteased', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(body: MarketIntelStep(onContinue: () {})),
      ),
    );

    expect(find.text(mattersMarketIntelHeadline), findsOneWidget);
    expect(find.text(mattersMarketIntelSampleBadge), findsOneWidget);
    expect(find.text(mattersMarketIntelAskingPrice), findsOneWidget);
    expect(find.byType(ImageFiltered), findsNothing);
    expect(find.byType(MarketIntelGate), findsNothing);
    expect(find.text(KeySpend.marketIntelTeaser), findsNothing);
  });

  test('onboarding step-6 files do not import the VDP MI gate', () {
    const files = [
      'lib/features/onboarding/matters_v5.dart',
      'lib/features/onboarding/widgets/onboarding_steps.dart',
    ];
    for (final path in files) {
      final text = File(path).readAsStringSync();
      expect(text.contains('MarketIntelGate'), isFalse, reason: path);
      expect(text.contains('market_intel_gate'), isFalse, reason: path);
      expect(text.contains('ImageFiltered'), isFalse, reason: path);
      expect(
        text.contains(KeySpend.marketIntelTeaser),
        isFalse,
        reason: path,
      );
    }
  });
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}
