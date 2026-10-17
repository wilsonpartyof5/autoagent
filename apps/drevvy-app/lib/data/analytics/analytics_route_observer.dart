import 'package:flutter/widgets.dart';

import 'product_analytics.dart';

/// Records screen views for named go_router locations. Sheets set their own names.
class AnalyticsRouteObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _record(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) _record(newRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (previousRoute != null) _record(previousRoute);
  }

  void _record(Route<dynamic> route) {
    final name = route.settings.name;
    if (name == null || name.isEmpty) return;
    ProductAnalytics.instance.recordLocation(name);
  }
}
