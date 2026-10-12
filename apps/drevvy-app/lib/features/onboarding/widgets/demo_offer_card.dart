import 'package:flutter/material.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';

class DemoOfferCard extends StatelessWidget {
  const DemoOfferCard({
    super.key,
    required this.otd,
    required this.underListed,
    required this.title,
    required this.subtitle,
  });

  final int otd;
  final int underListed;
  final String title;
  final String subtitle;

  String _formatNumber(int n) {
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: DrevvyColors.brandGradient,
                  borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                ),
                child: const Icon(
                  Icons.directions_car,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: DrevvySpace.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: text.cardTitle),
                    Text(subtitle, style: text.callout.copyWith(color: colors.muted)),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s4),
          
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '\$${_formatNumber(otd)}',
                    style: text.figureS,
                  ),
                  Text(
                    'OTD offer',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colors.mintTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  '\$${_formatNumber(underListed)} under listed',
                  style: text.label.copyWith(
                    color: colors.mint,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
