import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/deal_card.dart';
import '../widgets/stat_hero.dart';

/// Screens 20-25: Deals list with stat hero
class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  final _repo = DemoRepository.instance;
  List<Deal>? _deals;
  DealStats? _stats;
  bool _isLoading = true;
  String? _dismissedBannerId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final deals = await _repo.getDeals();
    final stats = await _repo.getDealStats();
    setState(() {
      _deals = deals;
      _stats = stats;
      _isLoading = false;
    });
  }

  void _dismissBanner(String dealId) {
    setState(() => _dismissedBannerId = dealId);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final deals = _deals ?? [];
    final stats = _stats;

    // Check for newly ended deals to show banner
    final endedDeal = deals.firstWhere(
      (d) => d.status.isEnded && d.id != _dismissedBannerId,
      orElse: () => deals.isNotEmpty ? deals.first : deals.first,
    );
    final showEndedBanner = endedDeal.status.isEnded && 
        endedDeal.id != _dismissedBannerId;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: deals.isEmpty
            ? _EmptyDeals(stats: stats)
            : CustomScrollView(
                slivers: [
                  // Header
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      DrevvySpace.gutter,
                      DrevvySpace.s4,
                      DrevvySpace.gutter,
                      0,
                    ),
                    sliver: SliverToBoxAdapter(
                      child: Text('Deals', style: text.display),
                    ),
                  ),

                  // Ended deal banner
                  if (showEndedBanner)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        DrevvySpace.gutter,
                        DrevvySpace.s4,
                        DrevvySpace.gutter,
                        0,
                      ),
                      sliver: SliverToBoxAdapter(
                        child: _EndedBanner(
                          deal: endedDeal,
                          onDismiss: () => _dismissBanner(endedDeal.id),
                        ),
                      ),
                    ),

                  // Stat hero
                  if (stats != null)
                    SliverPadding(
                      padding: const EdgeInsets.all(DrevvySpace.gutter),
                      sliver: SliverToBoxAdapter(
                        child: StatHero(stats: stats),
                      ),
                    ),

                  // Deals list
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.gutter,
                    ),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final deal = deals[index];
                          return Padding(
                            padding: const EdgeInsets.only(
                              bottom: DrevvySpace.s3,
                            ),
                            child: DealCard(
                              deal: deal,
                              showUndoHint: deal.status == DealStatus.reachingOut,
                              onTap: () {
                                context.push('/deal/${deal.id}');
                              },
                              onFindSimilar: () {
                                // Switch to Shop tab and search
                                context.go('/shop');
                              },
                            ),
                          );
                        },
                        childCount: deals.length,
                      ),
                    ),
                  ),

                  // Bottom padding for tab bar
                  const SliverToBoxAdapter(
                    child: SizedBox(height: DrevvySpace.rootScrollBottomPadding),
                  ),
                ],
              ),
      ),
    );
  }
}

class _EmptyDeals extends StatelessWidget {
  const _EmptyDeals({this.stats});

  final DealStats? stats;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.all(DrevvySpace.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: DrevvySpace.s4),
          Text('Deals', style: text.display),
          
          const SizedBox(height: DrevvySpace.s6),
          
          // Mini stat hero (0/10)
          if (stats != null)
            StatHero(stats: stats!, isEmpty: true),
          
          const SizedBox(height: DrevvySpace.s6),
          
          // Empty state card
          GlassCard(
            padding: const EdgeInsets.all(DrevvySpace.s5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Get started',
                  style: text.title,
                ),
                const SizedBox(height: DrevvySpace.s4),
                
                _StepRow(number: '1', text: 'Find a car you like'),
                _StepRow(number: '2', text: 'Add it to Drevvy'),
                _StepRow(number: '3', text: 'Drevvy finds your best price'),
                
                const SizedBox(height: DrevvySpace.s5),
                
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.go('/shop'),
                        icon: Icon(LucideIcons.search, size: 18),
                        label: const Text('Shop'),
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
                        onPressed: () => context.go('/shop'),
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
      ),
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
  const _EndedBanner({
    required this.deal,
    required this.onDismiss,
  });

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
                  'This car has been returned to your monthly limit.',
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
