import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/models/chat.dart';
import '../../data/models/user.dart';
import '../navigation/drevvy_nav_scope.dart';
import '../navigation/shopper_label.dart';
import '../theme/drevvy_theme.dart';
import '../theme/drevvy_tokens.dart';

/// Width is 82% of the short side (the handoff allows 80–85%).
double navDrawerWidth(Size size) {
  final shortSide = size.width < size.height ? size.width : size.height;
  return shortSide * 0.82;
}

class DrevvyNavDrawer extends StatelessWidget {
  const DrevvyNavDrawer({
    super.key,
    required this.selected,
    required this.recent,
    required this.recentReady,
    required this.keyCount,
    required this.user,
    required this.onDiscover,
    required this.onDeals,
    required this.onSaves,
    required this.onRecent,
    required this.onKeys,
    required this.onProfile,
  });

  final NavDestination selected;
  final List<ChatThread> recent;
  final bool recentReady;
  final int? keyCount;
  final User? user;
  final VoidCallback onDiscover;
  final VoidCallback onDeals;
  final VoidCallback onSaves;
  final ValueChanged<ChatThread> onRecent;
  final VoidCallback onKeys;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Material(
      color: colors.glassSolid,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: MediaQuery.paddingOf(context).top + 4),
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 4, 18, 14),
            child: DrevvyWordmark(fontSize: 18, markSize: 28),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Column(
              children: [
                _NavItem(
                  key: const Key('nav-destination-discover'),
                  icon: LucideIcons.sparkles,
                  label: 'Discover',
                  selected: selected == NavDestination.discover,
                  onTap: onDiscover,
                ),
                _NavItem(
                  key: const Key('nav-destination-deals'),
                  icon: LucideIcons.tag,
                  label: 'Deals',
                  selected: selected == NavDestination.deals,
                  onTap: onDeals,
                ),
                _NavItem(
                  key: const Key('nav-destination-saves'),
                  icon: LucideIcons.heart,
                  label: 'Saves',
                  selected: selected == NavDestination.saves,
                  onTap: onSaves,
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 16, 10, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                    child: Text(
                      'RECENT',
                      style: text.micro.copyWith(
                        color: colors.placeholder,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  Expanded(child: _recentList(context, colors, text)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: _KeysRow(count: keyCount, onTap: onKeys),
          ),
          _ProfileRow(user: user, onTap: onProfile),
          SizedBox(height: bottom > 0 ? bottom : 16),
        ],
      ),
    );
  }

  Widget _recentList(BuildContext context, DrevvyColors colors, DrevvyText text) {
    if (!recentReady) {
      return const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    if (recent.isEmpty) {
      return Padding(
        key: const Key('nav-recent-empty'),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Text(
          'No recent asks.',
          style: text.body.copyWith(color: colors.muted),
        ),
      );
    }
    return ListView.builder(
      padding: EdgeInsets.zero,
      itemCount: recent.length,
      itemBuilder: (context, index) {
        final chat = recent[index];
        final when = chat.updatedAt ?? chat.createdAt;
        return _RecentItem(
          title: chat.displayTitle,
          when: when == null ? null : relativeTimeLabel(when),
          onTap: () => onRecent(chat),
        );
      },
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final fg = selected ? colors.violet : colors.ink;
    return Material(
      color: selected ? const Color(0xFFECEAFE) : Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Icon(icon, size: 22, color: fg),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    style: text.bodyStrong.copyWith(
                      fontSize: 16,
                      color: fg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RecentItem extends StatelessWidget {
  const _RecentItem({
    required this.title,
    required this.when,
    required this.onTap,
  });

  final String title;
  final String? when;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.bodyStrong.copyWith(fontSize: 14),
              ),
              if (when != null)
                Text(
                  when!,
                  style: text.label.copyWith(color: colors.placeholder),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _KeysRow extends StatelessWidget {
  const _KeysRow({required this.count, required this.onTap});

  final int? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final label = count == null ? 'Keys' : '$count keys';
    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(14),
      elevation: 0,
      shadowColor: const Color(0x1428305A),
      child: InkWell(
        key: const Key('nav-drawer-keys'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Semantics(
          label: label,
          button: true,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: DrevvyBrand.gradient,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      LucideIcons.keyRound,
                      size: 15,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    label,
                    style: text.bodyStrong.copyWith(fontSize: 15),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({required this.user, required this.onTap});

  final User? user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final name = user == null ? 'Profile' : shopperFirstName(user!);
    final letter = user == null ? null : shopperAvatarLetter(user!);
    return InkWell(
      key: const Key('nav-profile'),
      onTap: onTap,
      child: Semantics(
        label: 'Profile',
        button: true,
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          margin: const EdgeInsets.fromLTRB(10, 0, 10, 0),
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: colors.line)),
          ),
          child: Row(
            children: [
              _Avatar(letter: letter),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodyStrong.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Icon(LucideIcons.chevronRight, color: colors.placeholder),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.letter});

  final String? letter;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: DrevvyBrand.gradient,
      ),
      alignment: Alignment.center,
      child: letter == null
          ? const Icon(LucideIcons.user, color: Colors.white, size: 18)
          : Text(
              letter!,
              style: text.bodyStrong.copyWith(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
    );
  }
}

class DrevvyWordmark extends StatelessWidget {
  const DrevvyWordmark({super.key, this.fontSize = 20, this.markSize = 26});

  final double fontSize;
  final double markSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: markSize,
          height: markSize,
          decoration: BoxDecoration(
            gradient: DrevvyBrand.gradient,
            borderRadius: BorderRadius.circular(markSize * 0.32),
            boxShadow: const [
              BoxShadow(
                color: Color(0x474650DC),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Icon(
            LucideIcons.sparkles,
            color: Colors.white,
            size: markSize * 0.54,
          ),
        ),
        const SizedBox(width: 8),
        ShaderMask(
          shaderCallback: (bounds) =>
              DrevvyBrand.gradient.createShader(bounds),
          child: Text(
            'Drevvy',
            style: TextStyle(
              fontFamily: DrevvyType.fontFamily,
              fontSize: fontSize,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}
