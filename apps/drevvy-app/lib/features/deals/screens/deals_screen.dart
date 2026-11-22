import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/nav_top_bar.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/deal_summary_card.dart';
import '../widgets/stat_hero.dart';

/// Screens 20-25: Deals list with stat hero
/// v1.8: Added avatar button to header.
class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key, this.repository});

  final DemoRepository? repository;

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  late final DemoRepository _repo =
      widget.repository ?? DemoRepository.instance;
  List<Deal>? _deals;
  DealStats? _stats;
  bool _isLoading = true;
  String? _dismissedBannerId;

  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    _repo.savedDealsTick.addListener(_loadData);
    _loadData();
  }

  @override
  void dispose() {
    _repo.savedDealsTick.removeListener(_loadData);
    super.dispose();
  }

  Future<void> _loadData() async {
    final generation = ++_loadGeneration;
    final deals = await _repo.getDeals();
    final stats = await _repo.getDealStats();
    if (!mounted || generation != _loadGeneration) return;
    setState(() {
      _deals = deals;
      _stats = stats;
      _isLoading = false;
    });
    if (deals.isEmpty) {
      ProductAnalytics.instance.track(AnalyticsEvents.emptyStateViewed, {
        'surface': 'deals',
      });
    }
  }

  void _dismissBanner(String dealId) {
    final deal = _deals?.where((item) => item.id == dealId).firstOrNull;
    ProductAnalytics.instance.track(AnalyticsEvents.dealBannerDismissed, {
      'status': deal?.status.name ?? 'unknown',
    });
    setState(() => _dismissedBannerId = dealId);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final deals = _deals ?? [];
    final endedDeal = deals
        .where((deal) => deal.status.isEnded && deal.id != _dismissedBannerId)
        .firstOrNull;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          NavTopBar(title: 'Deals', repository: _repo),
          Expanded(
            child: deals.isEmpty
                ? _EmptyDeals(stats: _stats, loadError: _repo.dealsLoadError)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(
                      DrevvySpace.gutter,
                      DrevvySpace.s2,
                      DrevvySpace.gutter,
                      DrevvySpace.s6,
                    ),
                    children: [
                      Text(
                        'Cars you are already talking about with a dealer.',
                        style: context.drevvyText.body.copyWith(
                          color: colors.muted,
                        ),
                      ),
                      if (_repo.dealsLoadError != null) ...[
                        const SizedBox(height: DrevvySpace.s3),
                        Text(
                          _repo.dealsLoadError!,
                          style: context.drevvyText.body.copyWith(
                            color: colors.ink,
                          ),
                        ),
                      ],
                      if (endedDeal != null) ...[
                        const SizedBox(height: DrevvySpace.s4),
                        _EndedBanner(
                          deal: endedDeal,
                          onDismiss: () => _dismissBanner(endedDeal.id),
                        ),
                      ],
                      const SizedBox(height: DrevvySpace.s4),
                      for (final deal in deals) ...[
                        DealSummaryCard(
                          deal: deal,
                          dealerPreview: latestDealerPreview(
                            _repo.dealThread(deal.id),
                          ),
                          onOpenDeal: () =>
                              context.push('/deals/${deal.id}/chat'),
                          onOpenChat: () =>
                              context.push('/deals/${deal.id}/chat'),
                        ),
                        const SizedBox(height: DrevvySpace.s3),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _EmptyDeals extends StatelessWidget {
  const _EmptyDeals({this.stats, this.loadError});

  final DealStats? stats;
  final String? loadError;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return ListView(
      padding: const EdgeInsets.all(DrevvySpace.gutter),
      children: [
          Text(
            'Cars you are already talking about with a dealer.',
            style: text.body.copyWith(color: colors.muted),
          ),
          if (loadError != null) ...[
            const SizedBox(height: DrevvySpace.s3),
            Text(loadError!, style: text.body.copyWith(color: colors.ink)),
          ],
          const SizedBox(height: DrevvySpace.s6),

          // Mini stat hero (0/10)
          if (stats != null) StatHero(stats: stats!, isEmpty: true),

          const SizedBox(height: DrevvySpace.s6),

          // Empty state card
          GlassCard(
            padding: const EdgeInsets.all(DrevvySpace.s5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Get started', style: text.title),
                const SizedBox(height: DrevvySpace.s4),

                _StepRow(number: '1', text: 'Find a car you like'),
                _StepRow(number: '2', text: 'Add it to Drevvy'),
                _StepRow(number: '3', text: 'Drevvy finds your best price'),

                const SizedBox(height: DrevvySpace.s5),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.go('/discover'),
                        icon: Icon(LucideIcons.search, size: 18),
                        label: const Text('Discover'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.ink,
                          side: BorderSide(color: colors.line),
                          padding: const EdgeInsets.symmetric(
                            vertical: DrevvySpace.s3,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: DrevvySpace.s3),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.go('/discover'),
                        icon: Icon(LucideIcons.messageCircle, size: 18),
                        label: const Text('Ask'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.ink,
                          side: BorderSide(color: colors.line),
                          padding: const EdgeInsets.symmetric(
                            vertical: DrevvySpace.s3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.number, required this.text});

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: colors.lilacTint,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: textStyle.label.copyWith(
                  color: colors.violet,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Text(text, style: textStyle.body),
        ],
      ),
    );
  }
}

class _EndedBanner extends StatelessWidget {
  const _EndedBanner({required this.deal, required this.onDismiss});

  final Deal deal;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final isNoLongerListed = deal.status == DealStatus.noLongerListed;
    final listing = deal.listing;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        color: colors.soldTint,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isNoLongerListed ? LucideIcons.circleX : LucideIcons.clock,
            size: 20,
            color: colors.sold,
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isNoLongerListed
                      ? 'This ${listing.build.make} ${listing.build.model} is no longer listed (likely sold)'
                      : 'No response from Dealer ${deal.letter}',
                  style: text.bodyStrong.copyWith(color: colors.sold),
                ),
                const SizedBox(height: DrevvySpace.s1),
                Text(
                  'You got your conversation key back.',
                  style: text.callout.copyWith(color: colors.sold),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onDismiss,
            icon: Icon(LucideIcons.x, size: 18),
            color: colors.sold,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}
