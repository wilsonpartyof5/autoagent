import 'package:drevvy_app/core/providers/app_services.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
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
    DemoRepository.instance
      ..resetDemoUser()
      ..resetDemoSearchProfile();
  });

  test('dollar prices and the packs offering stay on the catalog', () {
    expect(formatUsd(55), r'$55');
    expect(formatUsd(9.5, cents: true), r'$9.50');
    expect(CarPackType.bestValue.priceFormatted, r'$34.99');
    expect(CarPackType.bestValue.perKeyFormatted, r'$3.50');
    expect(CarPackType.bestValue.ctaText, r'Get 10 keys for $34.99');
    expect(keysOfferingId, 'keys');
    expect(onboardingPaywallPlacementName, 'onboarding_paywall');
    expect(
      selectPackPackages<String>(
        byOfferingId: {
          'default': ['other'],
          keysOfferingId: ['drevvy_keys_10'],
        },
        currentPackages: ['current'],
      ),
      ['drevvy_keys_10'],
    );
    expect(
      selectPackPackages<String>(
        byOfferingId: {
          'default': ['other'],
        },
        currentPackages: ['current'],
      ),
      ['current'],
    );
  });

  test(
    'onboarding answers land on the shopper as market preferences',
    () async {
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
      final budget = profile.items.firstWhere(
        (item) => item.kind == MemoryKind.budget,
      );
      expect(budget.value, 35000);
      expect(budget.source, MemorySource.onboarding);
      expect(budget.displayValue, r'$35,000');
    },
  );

  testWidgets('first run is Matters v5 and lands in Shop, not the paywall', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [localFlagsProvider.overrideWithValue(MemoryFlags())],
        child: const DrevvyApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Know the market'), findsOneWidget);
    expect(find.text('Discover'), findsOneWidget);
    expect(find.text('Know'), findsOneWidget);
    expect(find.text('Connect'), findsOneWidget);
    expect(find.text('Free'), findsWidgets);
    expect(find.text('1 key'), findsWidgets);
    expect(find.textContaining(r'$4.99'), findsNothing);
    expect(find.textContaining('first name only'), findsNothing);
    expect(find.textContaining('7-day'), findsNothing);
    expect(find.textContaining('unlimited follow'), findsNothing);

    await tester.tap(find.text('Let’s find your car'));
    await tester.pumpAndSettle();
    expect(find.text('What would you most like to avoid?'), findsOneWidget);

    await tester.tap(find.text('Surprise fees'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pumpAndSettle();
    expect(
      find.text('What would you want to know before going?'),
      findsOneWidget,
    );

    await tester.tap(find.text('Whole price'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pumpAndSettle();
    expect(find.text('How do you want to hear from dealers?'), findsOneWidget);

    await tester.tap(find.text('Keep texts in Drevvy'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pumpAndSettle();
    expect(find.textContaining('A better way to shop'), findsOneWidget);
    expect(find.text('Avoid surprise fees'), findsOneWidget);
    expect(find.text('Understand the whole price'), findsOneWidget);
    expect(find.text('Keep conversations private'), findsOneWidget);
    expect(find.text('See how Drevvy helps'), findsOneWidget);

    await tester.tap(find.text('See how Drevvy helps'));
    await tester.pumpAndSettle();
    expect(find.text('Know more than the asking price.'), findsOneWidget);
    expect(find.text(r'$24,900'), findsOneWidget);
    expect(find.textContaining('Good price'), findsOneWidget);
    expect(find.text('Unlock once. Keep access to this car.'), findsOneWidget);

    await tester.tap(find.text('Next · Meet the dealer'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Real dealers'), findsOneWidget);
    expect(find.text('Your phone and email stay private. No calls.'), findsOneWidget);

    await tester.tap(find.text('Whole price'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Draft saved'), findsOneWidget);
    await tester.tap(find.text('Save my question'));
    await tester.pumpAndSettle();
    expect(find.text('Where should we look?'), findsOneWidget);

    await tester.tap(find.text('Share my location'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('What kind of car?'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Your 3 free keys. Your choice.'), findsOneWidget);
    expect(find.text('3 free keys · No credit card'), findsOneWidget);
    expect(find.textContaining('Sign in later'), findsOneWidget);

    await tester.tap(find.text('Find my next car'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(find.text('Your 3 free keys. Your choice.'), findsNothing);
    expect(find.text('Deals'), findsOneWidget);
    expect(find.text('Saved'), findsOneWidget);
    expect(find.text('Shop'), findsWidgets);
    expect(find.text('Create your account'), findsNothing);
    expect(find.textContaining(r'$4.99'), findsNothing);
  });

  testWidgets('paywall screen keeps dollar packs when store keys are absent', (
    tester,
  ) async {
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

    expect(find.text(r'$4.99/key'), findsOneWidget);
    expect(find.text(r'$4.00/key'), findsOneWidget);
    expect(find.text(r'$3.50/key'), findsOneWidget);
    expect(find.text(r'$3.00/key'), findsOneWidget);
    expect(find.text('One-time · never expires'), findsOneWidget);
    expect(find.text('Save 19.9%/key'), findsOneWidget);
    expect(find.text('Save 29.9%/key'), findsOneWidget);
    expect(find.text('Save 39.9%/key'), findsOneWidget);
    expect(find.textContaining('negotiat'), findsNothing);
  });

  testWidgets('unlock with a zero balance shows the demo paywall', (
    tester,
  ) async {
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

    expect(find.text(KeySpend.packHeadline), findsOneWidget);
    expect(find.text(r'$3.50/key'), findsOneWidget);
    expect(find.text('Get 10 keys for \$34.99'), findsOneWidget);
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
    expect(find.text('RECOMMENDED'), findsNothing);
  });
}
