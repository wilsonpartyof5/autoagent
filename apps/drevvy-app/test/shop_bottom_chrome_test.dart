import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/widgets/shell_scaffold.dart';
import 'package:drevvy_app/core/widgets/shop_bottom_chrome.dart';
import 'package:drevvy_app/data/models/chat.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/features/shop/widgets/shop_composer_overlay.dart';
import 'package:drevvy_app/features/shop/widgets/shop_results.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ShopChromeScrollTracker', () {
    ShopChromeScrollTracker tracker() => ShopChromeScrollTracker();

    ShopChromeScrollDecision scroll(
      ShopChromeScrollTracker tracker, {
      required double delta,
      required double pixels,
      bool visible = true,
      double max = 2000,
      bool programmatic = false,
    }) {
      return tracker.consume(
        delta: delta,
        pixels: pixels,
        minScrollExtent: 0,
        maxScrollExtent: max,
        programmatic: programmatic,
        currentlyVisible: visible,
      );
    }

    test('tiny deltas do not accumulate or hide', () {
      final chrome = tracker();
      expect(
        scroll(chrome, delta: 20, pixels: 200),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 1.5, pixels: 201),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 3, pixels: 204),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 2, pixels: 206),
        ShopChromeScrollDecision.hide,
      );
    });

    test('downscroll hides only after 24px and below the top lock', () {
      final chrome = tracker();
      expect(
        scroll(chrome, delta: 20, pixels: 20),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 20, pixels: 40),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 16, pixels: 56),
        ShopChromeScrollDecision.hide,
      );
    });

    test('direction changes reset the accumulator', () {
      final chrome = tracker();
      expect(
        scroll(chrome, delta: 20, pixels: 120),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: -10, pixels: 110),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 20, pixels: 130),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: 10, pixels: 140),
        ShopChromeScrollDecision.hide,
      );
    });

    test('upscroll shows after 16px without reaching the top', () {
      final chrome = tracker();
      expect(
        scroll(chrome, delta: 30, pixels: 200),
        ShopChromeScrollDecision.hide,
      );
      expect(
        scroll(chrome, delta: -10, pixels: 190, visible: false),
        ShopChromeScrollDecision.none,
      );
      expect(
        scroll(chrome, delta: -8, pixels: 182, visible: false),
        ShopChromeScrollDecision.show,
      );
    });

    test('top, bottom, overscroll, and programmatic scrolls show', () {
      final chrome = tracker();
      expect(
        scroll(chrome, delta: 40, pixels: 0, visible: false),
        ShopChromeScrollDecision.show,
      );
      expect(
        scroll(chrome, delta: 8, pixels: -12, visible: false),
        ShopChromeScrollDecision.show,
      );
      expect(
        scroll(chrome, delta: 4, pixels: 400, max: 400, visible: false),
        ShopChromeScrollDecision.show,
      );
      expect(
        scroll(chrome, delta: 30, pixels: 80, programmatic: true),
        ShopChromeScrollDecision.show,
      );
    });
  });

  group('Shop bottom chrome', () {
    final listings = List<Listing>.generate(20, _listing);

    Future<GoRouter> pumpChrome(
      WidgetTester tester, {
      bool accessible = false,
      bool reduceMotion = false,
      double safeBottom = 34,
    }) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);

      final router = GoRouter(
        initialLocation: '/shop',
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (context, state, navigationShell) {
              return ShellScaffold(navigationShell: navigationShell);
            },
            branches: [
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/shop',
                    builder: (context, state) => _ShopProbe(listings: listings),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/deals',
                    builder: (context, state) => const _DealsProbe(),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/saved',
                    builder: (context, state) => const SizedBox.shrink(),
                  ),
                ],
              ),
            ],
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        MaterialApp.router(
          theme: drevvyTheme(Brightness.light),
          routerConfig: router,
          builder: (context, child) {
            final data = MediaQuery.of(context);
            return MediaQuery(
              data: data.copyWith(
                padding: EdgeInsets.only(
                  top: data.padding.top,
                  bottom: safeBottom,
                ),
                accessibleNavigation: accessible,
                disableAnimations: reduceMotion,
              ),
              child: child!,
            );
          },
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('2024 Honda Civic'), findsWidgets);
      return router;
    }

    testWidgets('list padding stays the full chrome height', (tester) async {
      await pumpChrome(tester);
      EdgeInsets paddingOf() {
        return tester
                .widget<ListView>(find.byKey(ShopBottomChromeMetrics.listKey))
                .padding!
            as EdgeInsets;
      }

      final before = paddingOf();
      expect(before.bottom, ShopBottomChromeMetrics.listBottomPadding(34));

      await _userScroll(tester, -180);
      expect(paddingOf().bottom, before.bottom);
    });

    testWidgets('downscroll hides the pill and tab bar as one unit', (
      tester,
    ) async {
      await pumpChrome(tester);
      final pillBefore = _top(tester, ShopBottomChromeMetrics.pillKey);
      final tabsBefore = _top(tester, ShopBottomChromeMetrics.tabsKey);

      await _userScroll(tester, -180);

      final pillDelta =
          _top(tester, ShopBottomChromeMetrics.pillKey) - pillBefore;
      final tabsDelta =
          _top(tester, ShopBottomChromeMetrics.tabsKey) - tabsBefore;
      final travel = ShopBottomChromeMetrics.travel(34);
      expect(pillDelta, closeTo(travel, 1));
      expect(tabsDelta, closeTo(pillDelta, 0.1));
      expect(
        _flag<ExcludeSemantics>(
          tester,
          ShopBottomChromeMetrics.tabsKey,
        ).excluding,
        isTrue,
      );
      expect(
        _flag<IgnorePointer>(tester, ShopBottomChromeMetrics.pillKey).ignoring,
        isTrue,
      );
    });

    testWidgets('a short move under the top lock does not hide', (
      tester,
    ) async {
      await pumpChrome(tester);
      final pill = _top(tester, ShopBottomChromeMetrics.pillKey);
      final tabs = _top(tester, ShopBottomChromeMetrics.tabsKey);
      await _userScroll(tester, -40);
      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(pill, 1));
      expect(_top(tester, ShopBottomChromeMetrics.tabsKey), closeTo(tabs, 1));
    });

    testWidgets('upscroll shows the chrome before the list reaches the top', (
      tester,
    ) async {
      await pumpChrome(tester);
      final shown = _top(tester, ShopBottomChromeMetrics.pillKey);
      await _userScroll(tester, -180);
      expect(
        _top(tester, ShopBottomChromeMetrics.pillKey),
        greaterThan(shown + 100),
      );

      await _userScroll(tester, 40);
      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(shown, 1));
      final position = _shopPosition(tester);
      expect(position.pixels, greaterThan(56));
    });

    testWidgets('the top of the list always shows the chrome', (tester) async {
      await pumpChrome(tester);
      final shown = _top(tester, ShopBottomChromeMetrics.pillKey);
      final tabsShown = _top(tester, ShopBottomChromeMetrics.tabsKey);
      await _userScroll(tester, -180);
      expect(
        _top(tester, ShopBottomChromeMetrics.pillKey),
        greaterThan(shown + 100),
      );

      _shopPosition(tester).jumpTo(0);
      await tester.pump();
      await tester.pumpAndSettle();

      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(shown, 1));
      expect(
        _top(tester, ShopBottomChromeMetrics.tabsKey),
        closeTo(tabsShown, 1),
      );
    });

    testWidgets('reaching the end of the list shows the chrome', (
      tester,
    ) async {
      await pumpChrome(tester);
      final shown = _top(tester, ShopBottomChromeMetrics.pillKey);
      await tester.fling(
        find.byKey(ShopBottomChromeMetrics.listKey),
        const Offset(0, -6000),
        4000,
      );
      await tester.pumpAndSettle();

      expect(_shopPosition(tester).pixels, greaterThan(100));
      expect(
        _shopPosition(tester).pixels,
        closeTo(_shopPosition(tester).maxScrollExtent, 1),
      );
      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(shown, 1));
    });

    testWidgets('focused search stays visible while the list scrolls', (
      tester,
    ) async {
      await pumpChrome(tester);
      await tester.tap(find.byType(TextField));
      await tester.pump();
      expect(FocusManager.instance.primaryFocus?.hasFocus, isTrue);

      final pill = _top(tester, ShopBottomChromeMetrics.pillKey);
      final tabs = _top(tester, ShopBottomChromeMetrics.tabsKey);
      await _userScroll(tester, -220);

      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(pill, 1));
      expect(_top(tester, ShopBottomChromeMetrics.tabsKey), closeTo(tabs, 1));
      expect(
        _flag<IgnorePointer>(tester, ShopBottomChromeMetrics.pillKey).ignoring,
        isFalse,
      );
    });

    testWidgets('keyboard docks the pill and hides only the tab bar', (
      tester,
    ) async {
      await pumpChrome(tester);
      await tester.tap(find.byType(TextField));
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: 280);
      await tester.pump();
      await tester.pumpAndSettle();

      final keyboardTop = tester.view.physicalSize.height - 280;
      final pill = _rect(tester, ShopBottomChromeMetrics.pillKey);
      final tabs = _rect(tester, ShopBottomChromeMetrics.tabsKey);
      expect(pill.bottom, lessThan(keyboardTop));
      expect(pill.top, greaterThan(keyboardTop - 160));
      expect(tabs.top, greaterThanOrEqualTo(keyboardTop - 1));

      final pillAfterFocus = pill.top;
      await _userScroll(tester, -220);
      expect(
        _top(tester, ShopBottomChromeMetrics.pillKey),
        closeTo(pillAfterFocus, 1),
      );
    });

    testWidgets('leaving Shop and coming back shows the chrome', (
      tester,
    ) async {
      await pumpChrome(tester);
      final shown = _top(tester, ShopBottomChromeMetrics.pillKey);
      await _userScroll(tester, -180);
      expect(
        _top(tester, ShopBottomChromeMetrics.pillKey),
        greaterThan(shown + 100),
      );

      final context = tester.element(find.byType(ShellScaffold));
      GoRouter.of(context).go('/deals');
      await tester.pumpAndSettle();
      expect(find.text('Deal row 0'), findsOneWidget);

      GoRouter.of(context).go('/shop');
      await tester.pumpAndSettle();
      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(shown, 1));
      expect(
        _flag<IgnorePointer>(tester, ShopBottomChromeMetrics.tabsKey).ignoring,
        isFalse,
      );
    });

    testWidgets('Deals keeps its own tab-bar hide across a Shop visit', (
      tester,
    ) async {
      await pumpChrome(tester);
      final context = tester.element(find.byType(ShellScaffold));
      GoRouter.of(context).go('/deals');
      await tester.pumpAndSettle();

      final before = tester.getTopLeft(find.text('Saved')).dy;
      await _userScroll(
        tester,
        -120,
        list: find.byKey(const Key('deals-scroll')),
      );
      final hidden = tester.getTopLeft(find.text('Saved')).dy;
      expect(hidden, greaterThan(before + 40));

      GoRouter.of(context).go('/shop');
      await tester.pumpAndSettle();
      expect(find.text('2024 Honda Civic'), findsWidgets);

      GoRouter.of(context).go('/deals');
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.text('Saved')).dy, closeTo(hidden, 1));
    });

    testWidgets('screen reader mode never auto-hides', (tester) async {
      await pumpChrome(tester, accessible: true);
      final pill = _top(tester, ShopBottomChromeMetrics.pillKey);
      final tabs = _top(tester, ShopBottomChromeMetrics.tabsKey);
      await _userScroll(tester, -240);
      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(pill, 1));
      expect(_top(tester, ShopBottomChromeMetrics.tabsKey), closeTo(tabs, 1));
      expect(
        _flag<ExcludeSemantics>(
          tester,
          ShopBottomChromeMetrics.tabsKey,
        ).excluding,
        isFalse,
      );
    });

    testWidgets('reduced motion crossfades instead of sliding', (tester) async {
      await pumpChrome(tester, reduceMotion: true);
      final before = _top(tester, ShopBottomChromeMetrics.pillKey);
      final list = find.byKey(ShopBottomChromeMetrics.listKey);
      final gesture = await tester.startGesture(tester.getCenter(list));
      await tester.pump(const Duration(milliseconds: 20));
      for (var step = 0; step < 4; step++) {
        await gesture.moveBy(const Offset(0, -20));
        await tester.pump(const Duration(milliseconds: 16));
      }

      expect(_shopPosition(tester).pixels, greaterThan(56));
      // Hide starts inside the drag's pump; the fade ticks on the next frame.
      await tester.pump(const Duration(milliseconds: 40));
      expect(_top(tester, ShopBottomChromeMetrics.pillKey), closeTo(before, 1));
      expect(_opacity(tester), lessThan(1));
      expect(_opacity(tester), greaterThan(0));

      await gesture.up();
      await tester.pumpAndSettle();
      expect(
        _top(tester, ShopBottomChromeMetrics.pillKey),
        greaterThan(before + 100),
      );
      expect(_opacity(tester), 0);
    });
  });
}

Listing _listing(int index) {
  return Listing(
    id: 'car_$index',
    vin: 'VIN$index',
    price: 20000 + index * 100,
    miles: 12000,
    build: const ListingBuild(year: 2024, make: 'Honda', model: 'Civic'),
    media: const ListingMedia(photoLinks: []),
    dist: 4,
  );
}

class _ShopProbe extends StatelessWidget {
  const _ShopProbe({required this.listings});

  final List<Listing> listings;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ShopResults(listings: listings, isLoading: false, onListingTap: (_) {}),
        ShopComposerOverlay(mode: ChatMode.shop, onSend: (_) {}),
      ],
    );
  }
}

class _DealsProbe extends StatelessWidget {
  const _DealsProbe();

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollUpdateNotification>(
      onNotification: (notification) {
        final hideOnScroll = HideOnScroll.of(context);
        if (hideOnScroll != null && notification.scrollDelta != null) {
          hideOnScroll.setFromScroll(notification.scrollDelta!);
        }
        return false;
      },
      child: ListView(
        key: const Key('deals-scroll'),
        children: [
          for (var i = 0; i < 40; i++)
            SizedBox(height: 72, child: Text('Deal row $i')),
        ],
      ),
    );
  }
}

Finder _chromeText(Key key) {
  return find.descendant(of: find.byKey(key), matching: find.byType(Text));
}

double _top(WidgetTester tester, Key key) {
  return tester.getTopLeft(_chromeText(key).first).dy;
}

Rect _rect(WidgetTester tester, Key key) {
  return tester.getRect(_chromeText(key).first);
}

double _opacity(WidgetTester tester) {
  final finder = find.descendant(
    of: find.byKey(ShopBottomChromeMetrics.pillKey),
    matching: find.byType(Opacity),
  );
  return tester.widget<Opacity>(finder.first).opacity;
}

T _flag<T extends Widget>(WidgetTester tester, Key key) {
  final finder = find.descendant(of: find.byKey(key), matching: find.byType(T));
  return tester.widget<T>(finder.first);
}

ScrollPosition _shopPosition(WidgetTester tester) {
  final finder = find.descendant(
    of: find.byKey(ShopBottomChromeMetrics.listKey),
    matching: find.byType(Scrollable),
  );
  return tester.state<ScrollableState>(finder).position;
}

/// Drag the list by [dy] logical pixels. Negative [dy] scrolls down the list.
Future<void> _userScroll(WidgetTester tester, double dy, {Finder? list}) async {
  final target = list ?? find.byKey(ShopBottomChromeMetrics.listKey);
  final gesture = await tester.startGesture(tester.getCenter(target));
  const step = 20.0;
  var moved = 0.0;
  final direction = dy.sign;
  final distance = dy.abs();
  while (moved < distance) {
    final chunk = (distance - moved) < step ? distance - moved : step;
    await gesture.moveBy(Offset(0, direction * chunk));
    await tester.pump(const Duration(milliseconds: 16));
    moved += chunk;
  }
  await tester.pump(const Duration(milliseconds: 80));
  await gesture.up();
  await tester.pumpAndSettle();
}
