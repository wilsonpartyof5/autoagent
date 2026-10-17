import 'package:flutter/material.dart';

import '../../core/theme/drevvy_theme.dart';
import '../../data/analytics/product_analytics.dart';

const analyticsPrivacyBody =
    'Drevvy can record product analytics, such as the screens you open, searches you run, cars you save, and packs you buy. '
    'A creator or campaign id from the link that opened the app is stored on this device and added to those events. '
    'Events never include your name, email, phone, address, or anything you type. '
    'You can turn analytics off in Profile. If no analytics key is configured, nothing is sent.';

void showAnalyticsPrivacy(BuildContext context) {
  ProductAnalytics.instance.track(AnalyticsEvents.privacyViewed);
  final text = context.drevvyText;
  showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: Text('Privacy', style: text.title),
        content: Text(analyticsPrivacyBody, style: text.body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
        ],
      );
    },
  );
}
