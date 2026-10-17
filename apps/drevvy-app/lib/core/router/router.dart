import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/analytics/analytics_route_observer.dart';
import '../../data/analytics/product_analytics.dart';
import '../../features/onboarding/onboarding_controller.dart';
import '../../features/onboarding/screens/welcome_screen.dart';
import '../../features/onboarding/screens/how_it_works_screen.dart';
import '../../features/onboarding/screens/location_screen.dart';
import '../../features/onboarding/screens/preferences_screen.dart';
import '../../features/onboarding/screens/paywall_screen.dart';
import '../../features/onboarding/screens/create_account_screen.dart';
import '../../features/shop/screens/shop_screen.dart';
import '../../features/shop/screens/vdp_screen.dart';
import '../../features/deals/screens/deals_screen.dart';
import '../../features/deals/screens/deal_detail_screen.dart';
import '../../features/deals/screens/deal_timeline_screen.dart';
import '../../features/deals/screens/official_offer_screen.dart';
import '../../features/deals/screens/done_screen.dart';
import '../../features/saved/screens/saved_screen.dart';
import '../../features/common/screens/error_screen.dart';
import '../widgets/shell_scaffold.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.onDispose(refresh.dispose);
  ref.listen<bool>(onboardingCompleteProvider, (_, _) {
    refresh.value++;
  });

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    refreshListenable: refresh,
    initialLocation: '/onboarding/welcome',
    observers: [AnalyticsRouteObserver()],
    redirect: (context, state) {
      ProductAnalytics.instance.captureLocation(state.uri.toString());
      final done = ref.read(onboardingCompleteProvider);
      final location = state.matchedLocation;
      if (location == '/open' || location == '/') {
        return done ? '/shop' : '/onboarding/welcome';
      }
      final fromOnboarding = state.uri.queryParameters['from'] == 'onboarding';
      final inFirstRun = location.startsWith('/onboarding') ||
          location == '/account/create' ||
          (location == '/paywall' && fromOnboarding);
      if (!done && !inFirstRun) return '/onboarding/welcome';
      if (done && (location.startsWith('/onboarding') || location == '/account/create')) {
        return '/shop';
      }
      return null;
    },
    routes: [
      // Onboarding routes (outside shell)
      GoRoute(
        path: '/onboarding/welcome',
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: '/onboarding/how',
        builder: (context, state) => const HowItWorksScreen(),
      ),
      GoRoute(
        path: '/onboarding/location',
        builder: (context, state) => const LocationScreen(),
      ),
      GoRoute(
        path: '/onboarding/preferences',
        builder: (context, state) => const PreferencesScreen(),
      ),
      GoRoute(
        path: '/paywall',
        builder: (context, state) {
          final from = state.uri.queryParameters['from'];
          return PaywallScreen(from: from);
        },
      ),
      GoRoute(
        path: '/account/create',
        builder: (context, state) => const CreateAccountScreen(),
      ),

      // Main shell with tabs
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ShellScaffold(navigationShell: navigationShell);
        },
        branches: [
          // Shop tab
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/shop',
                builder: (context, state) => const ShopScreen(),
              ),
            ],
          ),
          // Deals tab
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/deals',
                builder: (context, state) => const DealsScreen(),
              ),
            ],
          ),
          // Saved tab (v1.8: replaces Profile)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/saved',
                builder: (context, state) => const SavedScreen(),
              ),
            ],
          ),
        ],
      ),

      // Pushed routes (outside shell, no tab bar)
      GoRoute(
        path: '/vdp/:listingId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final listingId = state.pathParameters['listingId']!;
          return VdpScreen(listingId: listingId);
        },
      ),
      GoRoute(
        path: '/deal/:dealId/timeline',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final dealId = state.pathParameters['dealId']!;
          return DealTimelineScreen(dealId: dealId);
        },
      ),
      GoRoute(
        path: '/deal/:dealId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final dealId = state.pathParameters['dealId']!;
          final prompt = state.uri.queryParameters['prompt'];
          return DealDetailScreen(
            dealId: dealId,
            openDidYouBuy: prompt == 'did_you_buy',
          );
        },
      ),
      GoRoute(
        path: '/deal/:dealId/official',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final dealId = state.pathParameters['dealId']!;
          return OfficialOfferScreen(dealId: dealId);
        },
      ),
      GoRoute(
        path: '/deal/:dealId/done',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final dealId = state.pathParameters['dealId']!;
          return DoneScreen(dealId: dealId);
        },
      ),
      GoRoute(
        path: '/error',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final code = state.uri.queryParameters['code'];
          return ErrorScreen(code: code);
        },
      ),
    ],
    errorBuilder: (context, state) => ErrorScreen(
      code: 'NAV-404',
      message: 'Page not found',
    ),
  );
});
