import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/navigation/drevvy_nav_scope.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/core/widgets/nav_drawer.dart';
import 'package:drevvy_app/data/models/models.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/features/deals/screens/deal_chat_screen.dart';
import 'package:drevvy_app/features/deals/widgets/deal_summary_card.dart';
import 'package:drevvy_app/features/onboarding/onboarding_controller.dart';
import 'package:drevvy_app/features/profile/screens/profile_screen.dart';
import 'package:drevvy_app/features/saved/widgets/saved_car_card.dart';
import 'package:drevvy_app/features/shop/widgets/account_sheet.dart';
import 'package:drevvy_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [onboardingCompleteProvider.overrideWith((ref) => true)],
        child: const DrevvyApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
  }

  Future<void> openDrawer(WidgetTester tester) async {
    await tester.tap(find.byKey(const Key('nav-menu')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    // Opening the drawer reloads the shopper, which takes about 1.5s.
    await tester.pump(const Duration(seconds: 2));
  }

  Future<void> closeDrawer(WidgetTester tester) async {
    // The drawer covers the left 82%, so the scrim's center is not tappable.
    await tester.tapAt(const Offset(370, 120));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  testWidgets('Discover is the default and the drawer starts closed', (
    tester,
  ) async {
    await pumpApp(tester);

    expect(find.text('Ask me about cars'), findsOneWidget);
    expect(find.text('Is this a fair price?'), findsOneWidget);
    expect(find.text('Cars under \$25k'), findsOneWidget);
    expect(find.text('Best family SUV'), findsOneWidget);
    expect(find.byKey(const Key('nav-drawer')), findsNothing);
    expect(find.text('Deals'), findsNothing);
    expect(find.text('Saves'), findsNothing);
  });

  testWidgets('the drawer opens and closes', (tester) async {
    await pumpApp(tester);
    await openDrawer(tester);

    expect(find.byKey(const Key('nav-drawer')), findsOneWidget);
    expect(find.byKey(const Key('nav-destination-discover')), findsOneWidget);
    expect(find.byKey(const Key('nav-destination-deals')), findsOneWidget);
    expect(find.byKey(const Key('nav-destination-saves')), findsOneWidget);
    expect(find.byKey(const Key('nav-profile')), findsOneWidget);

    await closeDrawer(tester);

    expect(find.byKey(const Key('nav-drawer')), findsNothing);
    expect(find.text('Ask me about cars'), findsOneWidget);
  });

  testWidgets('each drawer destination opens only when tapped', (tester) async {
    await pumpApp(tester);

    await openDrawer(tester);
    await tester.tap(find.byKey(const Key('nav-destination-deals')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(
      find.text('Cars you are already talking about with a dealer.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('nav-drawer')), findsNothing);

    await openDrawer(tester);
    await tester.tap(find.byKey(const Key('nav-destination-saves')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Saves'), findsWidgets);
    expect(find.byKey(const Key('nav-drawer')), findsNothing);

    await openDrawer(tester);
    await tester.tap(find.byKey(const Key('nav-profile')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Get more'), findsOneWidget);
    expect(find.byKey(const Key('nav-drawer')), findsNothing);

    await openDrawer(tester);
    await tester.tap(find.byKey(const Key('nav-destination-discover')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    expect(find.text('Ask me about cars'), findsOneWidget);
    expect(find.byKey(const Key('nav-drawer')), findsNothing);
  });

  testWidgets('an empty recent list does not invent asks', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: DrevvyNavDrawer(
            selected: NavDestination.discover,
            recent: const [],
            recentReady: true,
            keyCount: null,
            user: null,
            onDiscover: () {},
            onDeals: () {},
            onSaves: () {},
            onRecent: (_) {},
            onKeys: () {},
            onProfile: () {},
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('nav-recent-empty')), findsOneWidget);
    expect(find.text('No recent asks.'), findsOneWidget);
    expect(find.text('RAV4 Hybrid under \$35k near me'), findsNothing);
  });

  testWidgets('live profile alerts and delete stay honest', (tester) async {
    tester.view.physicalSize = const Size(390, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = DemoRepository(
      config: const PurchaseConfig(mode: DrevvyDataMode.live),
      networkDelay: Duration.zero,
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: ProfileScreen(repository: repo),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('profile-alerts-unavailable')), findsOneWidget);
    expect(find.text('Alert settings are not available yet.'), findsOneWidget);
    for (final label in const [
      'Price drops',
      'New offers',
      'New texts from a dealer',
    ]) {
      final toggle = tester.widget<Switch>(
        find.descendant(
          of: find
              .ancestor(of: find.text(label), matching: find.byType(Row))
              .first,
          matching: find.byType(Switch),
        ),
      );
      expect(toggle.onChanged, isNull, reason: label);
    }

    await tester.scrollUntilVisible(find.text('Delete account'), 200);
    await tester.tap(find.text('Delete account'));
    await tester.pumpAndSettle();
    expect(find.text(accountDeletionUnavailableMessage), findsOneWidget);
    expect(find.text('Account deleted'), findsNothing);
  });

  testWidgets('deal chat stays empty without a stored thread', (tester) async {
    final repo = DemoRepository(networkDelay: Duration.zero);
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: DealChatScreen(dealId: 'missing-deal', repository: repo),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('This deal is not available.'), findsOneWidget);

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: DealChatScreen(dealId: 'deal_001', repository: repo),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('deal-chat-empty')), findsOneWidget);
    expect(find.text('No texts with this dealer yet.'), findsOneWidget);
    expect(find.text('You used 1 key to text this dealer.'), findsNothing);
  });

  testWidgets('demo deal chat can still send', (tester) async {
    final repo = DemoRepository(networkDelay: Duration.zero);
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: DealChatScreen(dealId: 'deal_001', repository: repo),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Dealer chat is coming soon.'), findsNothing);
    expect(find.byKey(const Key('deal-chat-composer')), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('deal-chat-composer')),
      'Is this still available?',
    );
    await tester.tap(find.byKey(const Key('deal-chat-send')));
    await tester.pump();

    expect(find.text('Is this still available?'), findsOneWidget);
    expect(repo.dealThread('deal_001').single.body, 'Is this still available?');
  });

  testWidgets('live deal chat hides send until a dealer can get it', (
    tester,
  ) async {
    final repo = DemoRepository(
      config: const PurchaseConfig(mode: DrevvyDataMode.live),
      networkDelay: Duration.zero,
    );
    await repo.addDeal(_listing, spend: false, id: 'deal_live_chat');
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: DealChatScreen(dealId: 'deal_live_chat', repository: repo),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Dealer chat is coming soon.'), findsOneWidget);
    expect(find.byKey(const Key('deal-chat-composer')), findsNothing);
    expect(find.byKey(const Key('deal-chat-send')), findsNothing);
    expect(repo.dealThread('deal_live_chat'), isEmpty);
  });

  testWidgets('a deal without savings does not invent a discount', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: DealSummaryCard(deal: _dealWithoutOffer(), onOpenChat: () {}),
        ),
      ),
    );

    expect(find.textContaining('less than listed'), findsNothing);
    expect(find.text('Open chat'), findsOneWidget);
  });

  testWidgets('a save without a fair price does not invent one', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: SavedCarCard(
            savedCar: SavedCar(
              id: 'saved_test',
              userId: 'user',
              listingId: _listing.id,
              vin: _listing.vin,
              savedAt: DateTime.utc(2026, 1, 1),
              savedPrice: _listing.price,
            ),
            listing: _listing,
            onRemove: () {},
            onUnlock: () {},
            onFindSimilar: () {},
          ),
        ),
      ),
    );

    expect(find.text('See the fair price · 1 key'), findsOneWidget);
    expect(find.textContaining('Fair price'), findsNothing);
    expect(find.textContaining('more than when you saved'), findsNothing);
  });
}

const _listing = Listing(
  id: 'listing_test',
  vin: 'VINTEST',
  price: 32995,
  miles: 1000,
  build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
  media: ListingMedia(photoLinks: []),
);

Deal _dealWithoutOffer() {
  return Deal(
    id: 'deal_plain',
    listingId: _listing.id,
    letter: 'A',
    status: DealStatus.reachingOut,
    listedAtStart: 32995,
    addedAt: DateTime.utc(2026, 1, 1),
    listing: _listing,
  );
}
