import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/repositories/demo_repository.dart';
import '../../features/shop/widgets/get_more_keys.dart';
import '../navigation/drevvy_nav_scope.dart';
import '../theme/drevvy_theme.dart';
import '../theme/drevvy_tokens.dart';
import 'nav_drawer.dart';

enum NavLeading { menu, back }

/// Top bar for Discover, Deals, Saves, Profile, and Deals · chat.
///
/// The title is centered on the screen, not between the side buttons.
class NavTopBar extends StatelessWidget {
  const NavTopBar({
    super.key,
    this.title,
    this.leading = NavLeading.menu,
    this.showNewChat = false,
    this.onNewChat,
    this.onLeading,
    this.repository,
  });

  /// Null shows the Drevvy wordmark (Discover).
  final String? title;
  final NavLeading leading;
  final bool showNewChat;
  final VoidCallback? onNewChat;
  final VoidCallback? onLeading;
  final DemoRepository? repository;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final top = MediaQuery.paddingOf(context).top;

    return Padding(
      padding: EdgeInsets.only(top: top),
      child: SizedBox(
        height: 52,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  _RoundButton(
                    key: Key(
                      leading == NavLeading.back ? 'nav-back' : 'nav-menu',
                    ),
                    label: leading == NavLeading.back ? 'Back' : 'Menu',
                    icon: leading == NavLeading.back
                        ? LucideIcons.chevronLeft
                        : LucideIcons.menu,
                    onPressed: () => _onLeading(context),
                  ),
                  const Spacer(),
                  KeysPill(repository: repository),
                  if (showNewChat) ...[
                    const SizedBox(width: 8),
                    _RoundButton(
                      key: const Key('nav-new-chat'),
                      label: 'New chat',
                      icon: LucideIcons.squarePen,
                      onPressed: onNewChat,
                    ),
                  ],
                ],
              ),
            ),
            IgnorePointer(
              child: title == null
                  ? const DrevvyWordmark()
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 120),
                      child: Text(
                        title!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: text.title.copyWith(color: colors.ink),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _onLeading(BuildContext context) {
    if (onLeading != null) {
      onLeading!();
      return;
    }
    if (leading == NavLeading.back) {
      if (context.canPop()) context.pop();
      return;
    }
    DrevvyNavScope.maybeOf(context)?.openDrawer();
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    return Semantics(
      label: label,
      button: true,
      child: Material(
        color: colors.glassSolid,
        shape: const CircleBorder(),
        elevation: 1,
        shadowColor: const Color(0x1428305A),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 22, color: colors.ink),
          ),
        ),
      ),
    );
  }
}

/// Key icon plus the live count. Hidden number until the balance loads.
class KeysPill extends StatefulWidget {
  const KeysPill({super.key, this.repository});

  final DemoRepository? repository;

  @override
  State<KeysPill> createState() => _KeysPillState();
}

class _KeysPillState extends State<KeysPill> {
  late final DemoRepository _repo = widget.repository ?? DemoRepository.instance;
  int? _count;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final balance = await _repo.getCreditBalance();
      if (!mounted) return;
      setState(() => _count = balance.balance);
    } catch (_) {
      if (!mounted) return;
      setState(() => _count = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final count = _count;
    final semantics = count == null ? 'Keys' : '$count keys';
    return Semantics(
      label: semantics,
      button: true,
      child: Material(
        color: colors.glassSolid,
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        elevation: 1,
        shadowColor: const Color(0x1428305A),
        child: InkWell(
          key: const Key('nav-keys'),
          customBorder: const StadiumBorder(),
          onTap: () async {
            await showGetMoreKeys(context, repository: _repo);
            await _load();
          },
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 11),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.keyRound, size: 16, color: colors.violet),
                  if (count != null) ...[
                    const SizedBox(width: 5),
                    Text(
                      '$count',
                      style: text.bodyStrong.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
