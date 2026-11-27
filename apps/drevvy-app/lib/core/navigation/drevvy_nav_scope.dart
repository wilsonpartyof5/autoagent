import 'package:flutter/widgets.dart';

import 'discover_intent.dart';

/// Drawer controls shared by Discover, Deals, Saves, and Profile.
class DrevvyNavScope extends InheritedWidget {
  const DrevvyNavScope({
    super.key,
    required this.intent,
    required this.openDrawer,
    required this.closeDrawer,
    required this.drawerOpen,
    required super.child,
  });

  final DiscoverIntent intent;
  final VoidCallback openDrawer;
  final VoidCallback closeDrawer;
  final bool drawerOpen;

  static DrevvyNavScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<DrevvyNavScope>();
  }

  @override
  bool updateShouldNotify(DrevvyNavScope oldWidget) {
    return drawerOpen != oldWidget.drawerOpen || intent != oldWidget.intent;
  }
}

enum NavDestination { discover, deals, saves, profile, none }

NavDestination navDestinationFor(String path) {
  if (path == '/discover' || path == '/shop') return NavDestination.discover;
  if (path == '/deals' || path.startsWith('/deals/')) {
    return NavDestination.deals;
  }
  if (path == '/saves' || path == '/saved') return NavDestination.saves;
  if (path == '/profile') return NavDestination.profile;
  return NavDestination.none;
}

bool navPathIsDiscover(String path) {
  return path == '/discover' || path == '/shop';
}
