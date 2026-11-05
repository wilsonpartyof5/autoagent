import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/shop_bottom_chrome.dart';
import '../../../data/models/chat.dart';
import 'chat_composer.dart';

/// Search / ask pill pinned above the tab bar.
///
/// On Shop results, focus locks the pill. A visible keyboard docks it and
/// hides the tab bar. Scroll-hide translates this pill with the tab bar.
class ShopComposerOverlay extends StatelessWidget {
  const ShopComposerOverlay({
    super.key,
    required this.mode,
    required this.onSend,
    this.isLoading = false,
  });

  final ChatMode mode;
  final ValueChanged<String> onSend;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final model = ShopBottomChromeScope.maybeOf(context);
    final safeBottom = MediaQuery.of(context).padding.bottom;
    final composer = ChatComposer(
      mode: mode,
      onSend: onSend,
      isLoading: isLoading,
    );
    final child = model == null
        ? composer
        : ShopChromeMotion(
            key: ShopBottomChromeMetrics.pillKey,
            part: ShopChromePart.pill,
            lockOnFocus: mode == ChatMode.shop,
            child: composer,
          );
    if (model == null) {
      return AnimatedPositioned(
        duration: Duration.zero,
        left: DrevvySpace.gutter,
        right: DrevvySpace.gutter,
        bottom: ShopBottomChromeMetrics.restingComposerBottom(safeBottom),
        child: child,
      );
    }
    return AnimatedBuilder(
      animation: model,
      builder: (context, child) {
        final reduce =
            model.reduceMotion || MediaQuery.of(context).disableAnimations;
        return AnimatedPositioned(
          duration: reduce ? Duration.zero : const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          left: DrevvySpace.gutter,
          right: DrevvySpace.gutter,
          bottom: model.composerBottom(safeBottom),
          child: child!,
        );
      },
      child: child,
    );
  }
}
