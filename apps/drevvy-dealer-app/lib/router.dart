import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'data/demo_desk.dart';
import 'screens/analytics_screen.dart';
import 'screens/conversation_screen.dart';
import 'screens/inbox_screen.dart';
import 'screens/login_screen.dart';
import 'screens/settings_screen.dart';
import 'widgets/desk_scaffold.dart';

GoRouter buildDeskRouter(DealerDesk desk) {
  final rootKey = GlobalKey<NavigatorState>();

  return GoRouter(
    navigatorKey: rootKey,
    initialLocation: '/login',
    refreshListenable: desk,
    redirect: (context, state) {
      final loggingIn = state.matchedLocation == '/login';
      if (!desk.signedIn && !loggingIn) return '/login';
      if (desk.signedIn && loggingIn) return '/inbox';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return DeskScaffold(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/inbox',
                builder: (context, state) => const InboxScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/analytics',
                builder: (context, state) => const AnalyticsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/conversations/:id',
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          return ConversationScreen(id: state.pathParameters['id']!);
        },
      ),
    ],
  );
}
