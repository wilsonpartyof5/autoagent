import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/drevvy_theme.dart';
import '../theme/drevvy_tokens.dart';

class FloatingTabBar extends StatelessWidget {
  const FloatingTabBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _tabs = [
    (icon: LucideIcons.messageSquare, label: 'Shop'),
    (icon: LucideIcons.tag, label: 'Deals'),
    (icon: LucideIcons.user, label: 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Positioned(
      left: DrevvySpace.tabBarSideInset,
      right: DrevvySpace.tabBarSideInset,
      bottom: DrevvySpace.tabBarBottomInset + bottomPadding,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(DrevvyRadius.tab),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: DrevvyColors.glassBlur, sigmaY: DrevvyColors.glassBlur),
          child: Container(
            height: DrevvySpace.tabBarHeight,
            decoration: BoxDecoration(
              color: colors.tabBar,
              borderRadius: BorderRadius.circular(DrevvyRadius.tab),
              boxShadow: colors.elev2,
              border: Theme.of(context).brightness == Brightness.dark
                  ? Border.all(color: Colors.white.withValues(alpha: 0.08))
                  : null,
            ),
            padding: const EdgeInsets.all(DrevvySpace.s2),
            child: Row(
              children: List.generate(_tabs.length, (index) {
                final tab = _tabs[index];
                final isActive = index == currentIndex;

                return Expanded(
                  child: GestureDetector(
                    onTap: () => onTap(index),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: DrevvyMotion.tabSwitch.duration,
                      curve: DrevvyMotion.tabSwitch.curve,
                      decoration: BoxDecoration(
                        color: isActive ? colors.tabActiveFill : Colors.transparent,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      height: 48,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            tab.icon,
                            size: 22,
                            color: isActive ? Colors.white : colors.tabInactive,
                          ),
                          const SizedBox(width: 7),
                          Text(
                            tab.label,
                            style: text.bodyStrong.copyWith(
                              fontSize: 13,
                              color: isActive ? Colors.white : colors.tabInactive,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
