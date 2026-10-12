import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/search_profile.dart';

/// Screen 07, 51: Shop empty state with personalized starters (v1.6.1)
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
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    
    // Bottom padding: composer (56) + gap (12) + tab bar (64) + tab bar inset (24) + safe area + buffer
    final totalBottomPadding = DrevvySpace.composerMinHeight + 12 + 
        DrevvySpace.tabBarHeight + DrevvySpace.tabBarBottomInset + bottomPadding + DrevvySpace.s4;

    return SingleChildScrollView(
      padding: EdgeInsets.only(
        left: DrevvySpace.gutter,
        right: DrevvySpace.gutter,
        bottom: totalBottomPadding,
      ),
      child: Column(
        children: [
          // Tighter top spacing per frame 51
          const SizedBox(height: DrevvySpace.s4),
          
          // Gradient orb - smaller per frame 51
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              gradient: DrevvyColors.brandGradient,
              shape: BoxShape.circle,
              boxShadow: colors.elevBrand,
            ),
            child: const Icon(
              LucideIcons.sparkles,
              color: Colors.white,
              size: 32,
            ),
          ),
          
          // Tighter gap between orb and greeting
          const SizedBox(height: DrevvySpace.s4),
          
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
            // "Based on your past searches · Manage" link - moved above cards
            const SizedBox(height: DrevvySpace.s2),
            GestureDetector(
              onTap: () => context.go('/profile'),
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
          
          // Tight gap before cards
          const SizedBox(height: DrevvySpace.s3),
          
          // 2x2 prompt cards - personalized or generic
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: DrevvySpace.s2,
            crossAxisSpacing: DrevvySpace.s2,
            childAspectRatio: 1.15,
            children: usePersonalized
                ? starters!.map((starter) {
                    return _PromptCard(
                      icon: _iconForKind(starter.kind),
                      kicker: starter.kicker,
                      title: starter.title,
                      onTap: () {
                        if (starter.action.mode == 'shop') {
                          onShopTap(starter.action.prompt ?? '');
                        } else {
                          onPromptTap(starter.action.prompt ?? starter.title);
                        }
                      },
                    );
                  }).toList()
                : _genericPrompts.map((prompt) {
                    return _PromptCard(
                      icon: prompt.icon,
                      kicker: prompt.kicker,
                      title: prompt.title,
                      onTap: () => onPromptTap(prompt.query),
                    );
                  }).toList(),
          ),
          
          const SizedBox(height: DrevvySpace.s3),
          
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
            const Spacer(),
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
              style: text.bodyStrong.copyWith(fontSize: 13, height: 1.3),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
