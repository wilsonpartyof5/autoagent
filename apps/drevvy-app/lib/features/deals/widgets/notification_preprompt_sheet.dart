import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/widgets/analytics_view.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';

/// Screen 19: Notification pre-prompt (after first Add)
class NotificationPrepromptSheet extends StatelessWidget {
  const NotificationPrepromptSheet({
    super.key,
    required this.onAllow,
    required this.onNotNow,
  });

  final VoidCallback onAllow;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return AnalyticsView(
      screen: 'notification_prompt',
      event: AnalyticsEvents.notificationPermissionAsked,
      eventProperties: const {'surface': 'add_car'},
      child: Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: DrevvySpace.s3),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.track,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              children: [
                const SizedBox(height: DrevvySpace.s4),

                // Icon orb
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: DrevvyBrand.gradient,
                    shape: BoxShape.circle,
                    boxShadow: colors.elevBrand,
                  ),
                  child: Icon(
                    LucideIcons.bell,
                    size: 36,
                    color: DrevvyColors.onBrand,
                  ),
                ),

                const SizedBox(height: DrevvySpace.s5),

                Text(
                  'Stay in the loop',
                  style: text.headline,
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: DrevvySpace.s2),

                Text(
                  'Get notified when Drevvy receives an offer or needs your input.',
                  style: text.body.copyWith(color: colors.muted),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Notification preview
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  decoration: BoxDecoration(
                    color: colors.tile,
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                    border: Border.all(color: colors.line),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          gradient: DrevvyBrand.gradient,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          LucideIcons.sparkles,
                          size: 20,
                          color: DrevvyColors.onBrand,
                        ),
                      ),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Drevvy', style: text.bodyStrong),
                                Text(
                                  'now',
                                  style: text.micro.copyWith(color: colors.muted),
                                ),
                              ],
                            ),
                            Text(
                              'New offer on RAV4: \$33,415 OTD',
                              style: text.callout.copyWith(color: colors.muted),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: DrevvySpace.s4),

                // Lock screen disclosure
                Row(
                  children: [
                    Icon(LucideIcons.eyeOff, size: 16, color: colors.muted),
                    const SizedBox(width: DrevvySpace.s2),
                    Expanded(
                      child: Text(
                        'Prices can be hidden on your lock screen in Settings.',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: DrevvySpace.s6),

                // CTAs
                DrevvyPrimaryButton(
                  label: 'Turn on notifications',
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.notificationPermissionGranted,
                      {'surface': 'add_car'},
                    );
                    onAllow();
                  },
                ),

                const SizedBox(height: DrevvySpace.s3),

                DrevvyGhostButton(
                  label: 'Not now',
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.notificationPermissionDenied,
                      {'surface': 'add_car'},
                    );
                    onNotNow();
                  },
                ),
              ],
            ),
          ),

          SizedBox(height: bottomPadding),
        ],
      ),
      ),
    );
  }
}
