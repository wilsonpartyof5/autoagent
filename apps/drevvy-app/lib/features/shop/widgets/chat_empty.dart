import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';

/// Screen 07: Shop empty state
class ChatEmpty extends StatelessWidget {
  const ChatEmpty({
    super.key,
    required this.userName,
    required this.onPromptTap,
    required this.onShopTap,
  });

  final String userName;
  final ValueChanged<String> onPromptTap;
  final ValueChanged<String> onShopTap;

  static const _prompts = [
    (icon: LucideIcons.car, title: 'Best hybrid SUVs', query: 'What are the best hybrid SUVs under \$40k?'),
    (icon: LucideIcons.dollarSign, title: 'Value picks', query: 'What cars hold their value best?'),
    (icon: LucideIcons.users, title: 'Family friendly', query: 'Best family cars with good safety ratings?'),
    (icon: LucideIcons.zap, title: 'Electric options', query: 'What electric cars have the best range?'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
      child: Column(
        children: [
          const SizedBox(height: DrevvySpace.s8),
          
          // Gradient orb
          Container(
            width: 92,
            height: 92,
            decoration: BoxDecoration(
              gradient: DrevvyColors.brandGradient,
              shape: BoxShape.circle,
              boxShadow: colors.elevBrand,
            ),
            child: const Icon(
              LucideIcons.sparkles,
              color: Colors.white,
              size: 40,
            ),
          ),
          
          const SizedBox(height: DrevvySpace.s6),
          
          Text(
            'Hi $userName,\nwhat are you shopping for?',
            style: text.headline,
            textAlign: TextAlign.center,
          ),
          
          const SizedBox(height: DrevvySpace.s8),
          
          // 2x2 prompt cards
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: DrevvySpace.s3,
            crossAxisSpacing: DrevvySpace.s3,
            childAspectRatio: 1.1,
            children: _prompts.map((prompt) {
              return _PromptCard(
                icon: prompt.icon,
                title: prompt.title,
                onTap: () => onPromptTap(prompt.query),
              );
            }).toList(),
          ),
          
          const SizedBox(height: DrevvySpace.s8),
          
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
          
          const SizedBox(height: DrevvySpace.s8),
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
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: GlassCard(
        padding: const EdgeInsets.all(DrevvySpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.lilacTint,
                borderRadius: BorderRadius.circular(DrevvyRadius.xs),
              ),
              child: Icon(icon, color: colors.violet, size: 20),
            ),
            const Spacer(),
            Text(title, style: text.bodyStrong),
          ],
        ),
      ),
    );
  }
}
