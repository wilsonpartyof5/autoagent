import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/drevvy_theme.dart';
import '../theme/drevvy_tokens.dart';

/// Screen 42: Offline banner shown when connectivity is lost
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({
    super.key,
    this.onRetry,
    this.lastSyncedAt,
  });

  final VoidCallback? onRetry;
  final DateTime? lastSyncedAt;

  String _formatLastSynced() {
    if (lastSyncedAt == null) return '';
    final diff = DateTime.now().difference(lastSyncedAt!);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DrevvySpace.gutter,
        vertical: DrevvySpace.s3,
      ),
      decoration: BoxDecoration(
        color: colors.ink,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Row(
        children: [
          Icon(
            LucideIcons.wifiOff,
            size: 18,
            color: DrevvyColors.onBrand,
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'You\'re offline',
                  style: text.bodyStrong.copyWith(color: DrevvyColors.onBrand),
                ),
                if (lastSyncedAt != null)
                  Text(
                    'Last synced ${_formatLastSynced()}',
                    style: text.callout.copyWith(color: DrevvyColors.onBrandMuted),
                  ),
              ],
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                foregroundColor: DrevvyColors.onBrand,
                padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s3),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.refreshCw, size: 14),
                  const SizedBox(width: DrevvySpace.s1),
                  Text('Retry', style: text.label),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Inline banner for use within lists/screens
class OfflineInlineBanner extends StatelessWidget {
  const OfflineInlineBanner({
    super.key,
    this.onRetry,
  });

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: DrevvySpace.gutter,
        vertical: DrevvySpace.s3,
      ),
      child: OfflineBanner(onRetry: onRetry),
    );
  }
}
