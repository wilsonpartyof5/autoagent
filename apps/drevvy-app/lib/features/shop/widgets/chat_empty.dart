import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/search_profile.dart';
import 'account_sheet.dart';

/// Screen 07, 51: Shop empty state with personalized starters (v1.6.1)
/// Per spec §6.5a: scrollable content with computed bottom padding
class ChatEmpty extends StatelessWidget {
  const ChatEmpty({
    super.key,
    required this.userName,
    required this.onPromptTap,
    required this.onShopTap,
    this.starters,
    this.hasHistory = false,
  });

  final String userName;
  final ValueChanged<String> onPromptTap;
  final ValueChanged<String> onShopTap;
  final List<StarterCard>? starters;
  final bool hasHistory;

  static const _genericPrompts = [
    (icon: LucideIcons.car, kicker: 'ASK DREVVY', title: 'Best hybrid SUVs', query: 'What are the best hybrid SUVs under \$40k?'),
    (icon: LucideIcons.dollarSign, kicker: 'FAIR PRICE', title: 'Value picks', query: 'What cars hold their value best?'),
    (icon: LucideIcons.users, kicker: 'FAMILY', title: 'Family friendly', query: 'Best family cars with good safety ratings?'),
    (icon: LucideIcons.zap, kicker: 'ELECTRIC', title: 'Electric options', query: 'What electric cars have the best range?'),
  ];
  
  /// v1.8: Show Account sheet instead of navigating to /profile
  void _showAccountSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const AccountSheet(),
    );
  }

  IconData _iconForKind(StarterKind kind) {
    return switch (kind) {
      StarterKind.backToSearch => LucideIcons.search,
      StarterKind.priceDrops => LucideIcons.trendingDown,
      StarterKind.newListings => LucideIcons.sparkles,
      StarterKind.fairPrice => LucideIcons.dollarSign,
      StarterKind.generic => LucideIcons.messageSquare,
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final usePersonalized = hasHistory && starters != null && starters!.isNotEmpty;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    final screenHeight = MediaQuery.of(context).size.height;
    
    // Computed bottom padding per spec §6.5a:
    // tabBarHeight + safeArea.bottom + composerHeight + 24
    final bottomPadding = DrevvySpace.contentBottomInset + safeBottom;
    
    // On screens shorter than 750, reduce orb to 64 and tighten spacing
    final isCompact = screenHeight < 750;
    final orbSize = isCompact ? 64.0 : 72.0;
    final orbIconSize = isCompact ? 28.0 : 32.0;
    final topSpacing = isCompact ? DrevvySpace.s2 : DrevvySpace.s4;
    final orbGreetingGap = isCompact ? DrevvySpace.s2 : DrevvySpace.s3;
    final greetingCardsGap = isCompact ? DrevvySpace.s2 : DrevvySpace.s3;

    return SingleChildScrollView(
      padding: EdgeInsets.only(
        left: DrevvySpace.gutter,
        right: DrevvySpace.gutter,
        bottom: bottomPadding,
      ),
      child: Column(
        children: [
          SizedBox(height: topSpacing),
          
          // Gradient orb - responsive size
          Container(
            width: orbSize,
            height: orbSize,
            decoration: BoxDecoration(
              gradient: DrevvyColors.brandGradient,
              shape: BoxShape.circle,
              boxShadow: colors.elevBrand,
            ),
            child: Icon(
              LucideIcons.sparkles,
              color: Colors.white,
              size: orbIconSize,
            ),
          ),
          
          SizedBox(height: orbGreetingGap),
          
          // Greeting - personalized vs generic
          Text(
            usePersonalized
                ? 'Welcome back, $userName'
                : 'Hi $userName,\nwhat are you shopping for?',
            style: text.headline,
            textAlign: TextAlign.center,
          ),
          
          if (usePersonalized) ...[
            const SizedBox(height: DrevvySpace.s1),
            Text(
              'Pick up where you left off, or ask anything.',
              style: text.body.copyWith(color: colors.muted),
              textAlign: TextAlign.center,
            ),
            // "Based on your past searches · Manage" link
            const SizedBox(height: DrevvySpace.s2),
            GestureDetector(
              onTap: () => _showAccountSheet(context),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Based on your past searches',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                  Text(
                    ' · ',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                  Text(
                    'Manage',
                    style: text.callout.copyWith(
                      color: colors.violet,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
          
          SizedBox(height: greetingCardsGap),
          
          // 2x2 prompt cards with 16pt gaps, min height 120, no fixed aspect ratio
          _StarterGrid(
            usePersonalized: usePersonalized,
            starters: starters,
            genericPrompts: _genericPrompts,
            iconForKind: _iconForKind,
            onPromptTap: onPromptTap,
            onShopTap: onShopTap,
          ),
          
          const SizedBox(height: DrevvySpace.s4),
          
          // Trust line
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.shieldCheck, color: colors.muted, size: 16),
              const SizedBox(width: DrevvySpace.s2),
              Text(
                'Dealers never see your contact info.',
                style: text.callout.copyWith(color: colors.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 2x2 grid with 16pt gaps, min card height 120, maxLines 2 with ellipsis
class _StarterGrid extends StatelessWidget {
  const _StarterGrid({
    required this.usePersonalized,
    required this.starters,
    required this.genericPrompts,
    required this.iconForKind,
    required this.onPromptTap,
    required this.onShopTap,
  });

  final bool usePersonalized;
  final List<StarterCard>? starters;
  final List<({IconData icon, String kicker, String title, String query})> genericPrompts;
  final IconData Function(StarterKind) iconForKind;
  final ValueChanged<String> onPromptTap;
  final ValueChanged<String> onShopTap;

  @override
  Widget build(BuildContext context) {
    final items = usePersonalized && starters != null
        ? starters!.take(4).toList()
        : genericPrompts.take(4).toList();

    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildCard(context, 0, items)),
            const SizedBox(width: DrevvySpace.gutter),
            Expanded(child: _buildCard(context, 1, items)),
          ],
        ),
        const SizedBox(height: DrevvySpace.gutter),
        Row(
          children: [
            Expanded(child: _buildCard(context, 2, items)),
            const SizedBox(width: DrevvySpace.gutter),
            Expanded(child: _buildCard(context, 3, items)),
          ],
        ),
      ],
    );
  }

  Widget _buildCard(BuildContext context, int index, List<dynamic> items) {
    if (index >= items.length) {
      return const SizedBox.shrink();
    }

    final item = items[index];
    
    if (item is StarterCard) {
      return _PromptCard(
        icon: iconForKind(item.kind),
        kicker: item.kicker,
        title: item.title,
        onTap: () {
          if (item.action.mode == 'shop') {
            onShopTap(item.action.prompt ?? '');
          } else {
            onPromptTap(item.action.prompt ?? item.title);
          }
        },
      );
    } else {
      final prompt = item as ({IconData icon, String kicker, String title, String query});
      return _PromptCard(
        icon: prompt.icon,
        kicker: prompt.kicker,
        title: prompt.title,
        onTap: () => onPromptTap(prompt.query),
      );
    }
  }
}

class _PromptCard extends StatelessWidget {
  const _PromptCard({
    required this.icon,
    required this.title,
    required this.onTap,
    this.kicker,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final String? kicker;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: GlassCard(
        padding: const EdgeInsets.all(DrevvySpace.s3),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.lilacTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.xs),
                ),
                child: Icon(icon, color: colors.violet, size: 18),
              ),
              const SizedBox(height: DrevvySpace.s3),
              // Uppercase kicker (v1.6.1)
              if (kicker != null) ...[
                Text(
                  kicker!,
                  style: text.micro.copyWith(
                    color: colors.muted,
                    fontWeight: FontWeight.w800,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
              ],
              Text(
                title, 
                style: text.bodyStrong,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
