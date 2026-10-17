import 'package:flutter/widgets.dart';

import '../../data/analytics/product_analytics.dart';

/// Fires [screen_viewed] once when a sheet or panel is inserted.
class AnalyticsView extends StatefulWidget {
  const AnalyticsView({
    super.key,
    required this.screen,
    required this.child,
    this.properties,
    this.event,
    this.eventProperties,
  });

  final String screen;
  final Widget child;
  final Map<String, Object?>? properties;
  final String? event;
  final Map<String, Object?>? eventProperties;

  @override
  State<AnalyticsView> createState() => _AnalyticsViewState();
}

class _AnalyticsViewState extends State<AnalyticsView> {
  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen(widget.screen, widget.properties);
    final event = widget.event;
    if (event != null) {
      ProductAnalytics.instance.track(event, widget.eventProperties);
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
