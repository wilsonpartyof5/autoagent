import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';

/// Simulator stub for the dealer dashboard thread.
///
/// Locked rules: dealer UI shows the shopper first name only; $300 close is
/// paid by the dealer on shopper-confirmed purchase. Glass tokens stand in
/// until Design glass assets land.
class DealerInboxStub extends StatelessWidget {
  const DealerInboxStub({
    super.key,
    required this.shopperFirstName,
    required this.listing,
    this.message,
  });

  final String shopperFirstName;
  final Listing listing;
  final String? message;

  static String firstNameOnly(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return 'Shopper';
    return trimmed.split(RegExp(r'\s+')).first;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final name = firstNameOnly(shopperFirstName);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        // GLASS STUB: Design glass asset pending; use token fill.
        color: colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
        border: Border.all(color: colors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Dealer inbox preview',
            style: text.label.copyWith(color: colors.violet),
          ),
          const SizedBox(height: DrevvySpace.s2),
          Row(
            children: [
              Icon(LucideIcons.user, size: 16, color: colors.muted),
              const SizedBox(width: DrevvySpace.s2),
              Text(name, style: text.bodyStrong),
            ],
          ),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            listing.shortTitle,
            style: text.callout.copyWith(color: colors.muted),
          ),
          if (message != null) ...[
            const SizedBox(height: DrevvySpace.s2),
            Text(message!, style: text.body),
          ],
          const SizedBox(height: DrevvySpace.s3),
          Text(
            'Close fee stub: dealer pays \$${KeySpend.dealerCloseFeeUsd} when the shopper confirms the purchase.',
            style: text.callout.copyWith(color: colors.muted),
          ),
        ],
      ),
    );
  }
}
