import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/analytics/analytics_route_observer.dart';
import '../../data/analytics/product_analytics.dart';
import '../../features/onboarding/onboarding_controller.dart';
import '../../features/onboarding/screens/create_account_screen.dart';
import '../../features/onboarding/screens/onboarding_flow_screen.dart';
import '../../features/onboarding/screens/paywall_screen.dart';
import '../../features/shop/screens/shop_screen.dart';
import '../../features/shop/screens/vdp_screen.dart';
import '../../features/deals/screens/deals_screen.dart';
import '../../features/deals/screens/deal_chat_screen.dart';
import '../../features/deals/screens/deal_detail_screen.dart';
import '../../features/deals/screens/deal_timeline_screen.dart';
import '../../features/deals/screens/official_offer_screen.dart';
import '../../features/deals/screens/done_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
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
    initialLocation: '/onboarding',
    observers: [AnalyticsRouteObserver()],
    redirect: (context, state) {
      ProductAnalytics.instance.captureLocation(state.uri.toString());
      final done = ref.read(onboardingCompleteProvider);
      final location = state.matchedLocation;
      if (location == '/open' || location == '/') {
        return done ? '/discover' : '/onboarding';
      }
      // Retired v4 first-run paths. Live flow is Matters v5 at /onboarding.
      if (location.startsWith('/onboarding/')) return '/onboarding';
      final inFirstRun =
          location == '/onboarding' || location == '/account/create';
      if (!done && !inFirstRun) return '/onboarding';
      if (done && location == '/onboarding') return '/discover';
      return null;
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlowScreen(),
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

      // Discover is the home. Deals, Saves, and Profile open from the drawer.
      // /shop and /saved stay so older links still land on those surfaces.
      ShellRoute(
        builder: (context, state, child) {
          final path = state.uri.path;
          return ShellScaffold(
            location: path,
            onShop: path == '/discover' || path == '/shop',
            child: child,
          );
        },
        routes: [
          GoRoute(
            path: '/discover',
            builder: (context, state) => const ShopScreen(),
          ),
          GoRoute(
            path: '/shop',
            builder: (context, state) => const ShopScreen(),
          ),
          GoRoute(
            path: '/deals',
            builder: (context, state) => const DealsScreen(),
          ),
          GoRoute(
            path: '/saves',
            builder: (context, state) => const SavedScreen(),
          ),
          GoRoute(
            path: '/saved',
            builder: (context, state) => const SavedScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),

      // Pushed routes (outside shell, no tab bar)
      GoRoute(
        path: '/deals/:dealId/chat',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final dealId = state.pathParameters['dealId']!;
          return DealChatScreen(dealId: dealId);
        },
      ),
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
    errorBuilder: (context, state) =>
        ErrorScreen(code: 'NAV-404', message: 'Page not found'),
  );
});
