import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/chat.dart';

/// Shop header per spec §6.5a (v1.6.1, updated v1.8):
/// - Left: hamburger (44pt) opens history drawer
/// - Center: Ask | Shop toggle
/// - Right: avatar button opens Account sheet (v1.8)
class ChatHeader extends StatelessWidget {
  const ChatHeader({
    super.key,
    required this.mode,
    required this.onModeChanged,
    this.onMenuTap,
    this.onAvatarTap,
  });

  final ChatMode mode;
  final ValueChanged<ChatMode> onModeChanged;
  final VoidCallback? onMenuTap;
  /// v1.8: Callback when avatar is tapped to open Account sheet.
  final VoidCallback? onAvatarTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final topPadding = MediaQuery.of(context).padding.top;

    return Container(
      height: DrevvySpace.chatHeaderHeight + topPadding,
      padding: EdgeInsets.only(
        top: topPadding,
        left: DrevvySpace.s2,
        right: DrevvySpace.s2,
      ),
      child: Row(
        children: [
          // Hamburger opens chat history drawer
          Semantics(
            label: 'Chat history',
            button: true,
            child: IconButton(
              icon: Icon(LucideIcons.menu, color: colors.ink),
              onPressed: onMenuTap,
              tooltip: 'Chat history',
            ),
          ),
          
          const Spacer(),
          
          _AskShopToggle(
            mode: mode,
            onChanged: onModeChanged,
          ),
          
          const Spacer(),
          
          // v1.8: Avatar button opens Account sheet
          if (onAvatarTap != null)
            GestureDetector(
              onTap: onAvatarTap,
              child: Semantics(
                label: 'Account',
                button: true,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: DrevvyBrand.gradient,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      'DW',
                      style: text.label.copyWith(
                        color: DrevvyColors.onBrand,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            )
          else
            const SizedBox(width: DrevvySpace.minTap),
        ],
      ),
    );
  }
}

class _AskShopToggle extends StatelessWidget {
  const _AskShopToggle({
    required this.mode,
    required this.onChanged,
  });

  final ChatMode mode;
  final ValueChanged<ChatMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.ink.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ToggleSegment(
            label: 'Ask',
            icon: LucideIcons.sparkles,
            isSelected: mode == ChatMode.ask,
            onTap: () => onChanged(ChatMode.ask),
          ),
          _ToggleSegment(
            label: 'Shop',
            icon: LucideIcons.messageSquare,
            isSelected: mode == ChatMode.shop,
            onTap: () => onChanged(ChatMode.shop),
          ),
        ],
      ),
    );
  }
}

class _ToggleSegment extends StatelessWidget {
  const _ToggleSegment({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: DrevvyMotion.segmentSlide.duration,
        curve: DrevvyMotion.segmentSlide.curve,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        constraints: const BoxConstraints(minWidth: 84),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? const Color(0xFF2A2E45) : Colors.white)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(DrevvyRadius.pill),
          boxShadow: isSelected
              ? [const BoxShadow(color: Colors.black12, blurRadius: 4)]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? colors.ink : colors.muted,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: text.label.copyWith(
                color: isSelected ? colors.ink : colors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
