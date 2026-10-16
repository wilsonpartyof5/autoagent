import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/money_format.dart';
import 'package:drevvy_app/data/models/search_profile.dart';
import 'package:drevvy_app/data/models/user.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/cars_balance_placement.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';
import 'package:drevvy_app/data/services/pack_offering.dart';
import 'package:drevvy_app/data/services/superwall_placement.dart';
import 'package:drevvy_app/features/onboarding/screens/paywall_screen.dart';
import 'package:drevvy_app/features/shop/widgets/unlock_paywall.dart';
import 'package:drevvy_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.physicalSize = const Size(800, 2000);
    view.devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
    DemoRepository.instance
      ..resetDemoUser()
      ..resetDemoSearchProfile();
  });

  test('dollar prices and the packs offering stay on the catalog', () {
    expect(formatUsd(47), r'$47');
    expect(formatUsd(9.7, cents: true), r'$9.70');
    expect(CarPackType.bestValue.priceFormatted, r'$97');
    expect(CarPackType.bestValue.perCarFormatted, r'$9.70');
    expect(CarPackType.bestValue.ctaText, r'Get 10 cars for $97');
    expect(packsOfferingId, 'packs');
    expect(onboardingPaywallPlacementName, 'onboarding_paywall');
    expect(
      selectPackPackages<String>(
        byOfferingId: {
          'default': ['other'],
          packsOfferingId: ['drevvy_pack_10'],
        },
        currentPackages: ['current'],
      ),
      ['drevvy_pack_10'],
    );
    expect(
      selectPackPackages<String>(
        byOfferingId: {'default': ['other']},
        currentPackages: ['current'],
      ),
      ['current'],
    );
  });

  test('onboarding answers land on the shopper as market preferences', () async {
    final repo = DemoRepository(networkDelay: Duration.zero);
    repo.resetDemoSearchProfile();
    addTearDown(() {
      repo.resetDemoUser();
      repo.resetDemoSearchProfile();
    });

    await repo.saveOnboardingAnswers(
      budgetOtd: 35000,
      bodyTypes: const ['SUV'],
      tradeIn: TradeInPref.no,
      payment: PaymentPref.cash,
      zip: '29730',
      locationGranted: false,
    );

    final user = await repo.getCurrentUser();
    expect(user.prefs?.budgetOtd, 35000);
    expect(user.prefs?.bodyTypes, ['SUV']);
    expect(user.prefs?.tradeIn, TradeInPref.no);
    expect(user.zipCode, '29730');
    expect(user.locationState, LocationState.zipFallback);

    final profile = await repo.getSearchProfile();
    final budget = profile.items.firstWhere((item) => item.kind == MemoryKind.budget);
    expect(budget.value, 35000);
    expect(budget.source, MemorySource.onboarding);
    expect(budget.displayValue, r'$35,000');
  });

  testWidgets('first run walks to the pack paywall and can shop free', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: DrevvyApp()));
    await tester.pumpAndSettle();

    expect(find.text('Get started'), findsOneWidget);
    expect(find.textContaining('transparency layer'), findsOneWidget);
    expect(find.textContaining('negotiat'), findsNothing);

    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(find.text('How Drevvy works'), findsOneWidget);
    expect(find.text('Compare with market data'), findsOneWidget);
    expect(find.textContaining('Unlock my price'), findsWidgets);
    expect(find.textContaining('negotiat'), findsNothing);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Where are you'), findsOneWidget);

    await tester.tap(find.text('Allow location'));
    await tester.pumpAndSettle();
    expect(find.text('What are you looking for?'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('Market data, then a written price.'), findsOneWidget);
    expect(find.text(r'$47'), findsOneWidget);
    expect(find.text(r'$67'), findsOneWidget);
    expect(find.text(r'$97'), findsOneWidget);
    expect(find.text(r'$9.70/car'), findsOneWidget);
    expect(find.text('BEST VALUE'), findsOneWidget);
    expect(find.text('Get 10 cars for \$97'), findsOneWidget);
    expect(find.textContaining('free and unlimited'), findsOneWidget);
    expect(find.textContaining('negotiat'), findsNothing);

    await tester.tap(find.text('Start shopping free'));
    await tester.pumpAndSettle();
    expect(find.text('Create your account'), findsOneWidget);
  });

  testWidgets('paywall screen keeps dollar packs when store keys are absent', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: PaywallScreen(
            from: 'onboarding',
            repository: DemoRepository(
              networkDelay: Duration.zero,
              purchaseService: FakePurchaseService(
                simulateDelay: Duration.zero,
                offeringsDelay: Duration.zero,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text(r'$15.67/car'), findsOneWidget);
    expect(find.text(r'$13.40/car'), findsOneWidget);
    expect(find.text(r'$9.70/car'), findsOneWidget);
    expect(find.text('One-time · never expires'), findsOneWidget);
    expect(find.textContaining('negotiat'), findsNothing);
  });

  testWidgets('unlock with a zero balance shows the demo paywall', (tester) async {
    const listing = Listing(
      id: 'listing_1',
      vin: 'VIN123',
      price: 27990,
      build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
      media: ListingMedia(photoLinks: []),
    );
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.empty(),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () {
                showUnlockPaywall(
                  context: context,
                  listing: listing,
                  balance: const CarCreditBalance.empty(),
                  repo: repo,
                  placement: const LocalCarsBalancePlacement(),
                  onCanUnlock: (_) async {},
                );
              },
              child: const Text('Unlock my price'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Unlock my price'));
    await tester.pumpAndSettle();

    expect(find.text('Let Drevvy handle this dealer.'), findsOneWidget);
    expect(find.text(r'$9.70/car'), findsOneWidget);
    expect(find.text('Get 10 cars for \$97'), findsOneWidget);
    expect(find.textContaining('negotiat'), findsNothing);
  });

  testWidgets('unlock with cars left skips the paywall', (tester) async {
    const listing = Listing(
      id: 'listing_1',
      vin: 'VIN123',
      price: 27990,
      build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
      media: ListingMedia(photoLinks: []),
    );
    var unlocked = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () {
                showUnlockPaywall(
                  context: context,
                  listing: listing,
                  balance: const CarCreditBalance.withBalance(3),
                  repo: DemoRepository(networkDelay: Duration.zero),
                  placement: const LocalCarsBalancePlacement(),
                  onCanUnlock: (_) async {
                    unlocked = true;
                  },
                );
              },
              child: const Text('Unlock my price'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Unlock my price'));
    await tester.pumpAndSettle();

    expect(unlocked, isTrue);
    expect(find.text('BEST VALUE'), findsNothing);
  });
}
