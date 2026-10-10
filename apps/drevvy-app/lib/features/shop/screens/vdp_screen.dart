import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/market_price_bar.dart';
import '../widgets/add_to_drevvy_sheet.dart';

/// Screens 12, 13, 16: VDP (Vehicle Detail Page)
class VdpScreen extends StatefulWidget {
  const VdpScreen({super.key, required this.listingId});

  final String listingId;

  @override
  State<VdpScreen> createState() => _VdpScreenState();
}

class _VdpScreenState extends State<VdpScreen> {
  final _repo = DemoRepository.instance;
  Listing? _listing;
  MarketContext? _market;
  User? _user;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final listing = await _repo.getListingById(widget.listingId);
    final market = await _repo.getMarketContext(listing);
    final user = await _repo.getCurrentUser();
    setState(() {
      _listing = listing;
      _market = market;
      _user = user;
      _isLoading = false;
    });
  }

  void _showAddSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddToDrevvySheet(
        listing: _listing!,
        market: _market!,
        user: _user!,
        onAdd: (maxOtd) async {
          await _repo.addDeal(_listing!, maxOtd: maxOtd);
          if (mounted) {
            Navigator.pop(context);
            context.go('/deals');
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    if (_isLoading || _listing == null) {
      return Scaffold(
        body: Stack(
          children: [
            const CanvasBackground(),
            const Center(child: CircularProgressIndicator()),
          ],
        ),
      );
    }

    final listing = _listing!;
    final market = _market!;
    final user = _user!;
    final isPro = user.isPro;

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          CustomScrollView(
            slivers: [
              // App bar with back button
              SliverAppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                leading: IconButton(
                  icon: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: colors.glassSolid,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(LucideIcons.chevronLeft, color: colors.ink),
                  ),
                  onPressed: () => context.pop(),
                ),
                actions: [
                  IconButton(
                    icon: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: colors.glassSolid,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(LucideIcons.share, color: colors.ink),
                    ),
                    onPressed: () {
                      // TODO: Share
                    },
                  ),
                  IconButton(
                    icon: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: colors.glassSolid,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(LucideIcons.heart, color: colors.ink),
                    ),
                    onPressed: () {
                      // TODO: Favorite
                    },
                  ),
                  const SizedBox(width: DrevvySpace.s2),
                ],
              ),
              
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Gallery
                      ClipRRect(
                        borderRadius: BorderRadius.circular(DrevvyRadius.xl),
                        child: AspectRatio(
                          aspectRatio: 16 / 10,
                          child: listing.media.primaryPhoto != null
                              ? Image.asset(
                                  listing.media.primaryPhoto!,
                                  fit: BoxFit.cover,
                                )
                              : Container(
                                  color: colors.glassSolid,
                                  child: Icon(LucideIcons.imageOff, color: colors.muted, size: 48),
                                ),
                        ),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s4),
                      
                      // Title
                      Text(listing.title, style: text.headline),
                      Text(
                        listing.subtitle,
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s4),
                      
                      // Price
                      Row(
                        children: [
                          Text(listing.priceFormatted, style: text.figureM),
                          const SizedBox(width: DrevvySpace.s3),
                          Text(
                            'Listed by Dealer A',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                      
                      // Meta
                      Text(
                        '${listing.milesFormatted} · ${listing.distanceFormatted}',
                        style: text.body.copyWith(color: colors.muted),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Market price bar
                      MarketPriceBar(
                        listing: listing,
                        market: market,
                      ),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Market tiles
                      _MarketTiles(listing: listing, market: market),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Key specs (per audit: no cargo, no LATCH)
                      Text('Key specs', style: text.title),
                      const SizedBox(height: DrevvySpace.s3),
                      _KeySpecs(listing: listing),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // History (per audit: only "One owner (per dealer listing)")
                      if (listing.carfax1Owner == true) ...[
                        Text('History', style: text.title),
                        const SizedBox(height: DrevvySpace.s3),
                        _HistoryRow(
                          icon: LucideIcons.user,
                          text: 'One owner (per dealer listing)',
                        ),
                        const SizedBox(height: DrevvySpace.s6),
                      ],
                      
                      // Features
                      if (listing.extra?.highValueFeatures?.isNotEmpty == true) ...[
                        Text('Features', style: text.title),
                        const SizedBox(height: DrevvySpace.s3),
                        Wrap(
                          spacing: DrevvySpace.s2,
                          runSpacing: DrevvySpace.s2,
                          children: listing.extra!.highValueFeatures!.map((f) {
                            return Chip(
                              label: Text(f, style: text.label),
                              backgroundColor: colors.tile,
                              side: BorderSide.none,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: DrevvySpace.s6),
                      ],
                      
                      // How Drevvy works (for free users)
                      if (!isPro) ...[
                        _HowDrevvyWorks(),
                        const SizedBox(height: DrevvySpace.s6),
                      ],
                      
                      // Space for sticky CTA
                      SizedBox(height: 120 + bottomPadding),
                    ],
                  ),
                ),
              ),
            ],
          ),
          
          // Sticky CTA
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _StickyCta(
              listing: listing,
              user: user,
              onTap: isPro ? _showAddSheet : () => context.push('/paywall'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MarketTiles extends StatelessWidget {
  const _MarketTiles({
    required this.listing,
    required this.market,
  });

  final Listing listing;
  final MarketContext market;

  @override
  Widget build(BuildContext context) {
    // Per audit: "Days listed" not "Days on lot"
    return Wrap(
      spacing: DrevvySpace.s3,
      runSpacing: DrevvySpace.s3,
      children: [
        _Tile(
          label: 'Days listed',
          value: '${listing.domActive ?? "—"}',
          sub: 'Market avg ${market.daysListedMedian ?? 38}',
        ),
        _Tile(
          label: 'Price drops',
          value: '${market.priceDrops ?? 0}',
          sub: market.priceDrops != null && market.priceDrops! > 0
              ? 'Since listed'
              : 'None yet',
        ),
        _Tile(
          label: 'Comparables',
          value: '${market.comparablesCount}',
          sub: 'Within 50 mi',
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.label,
    required this.value,
    required this.sub,
  });

  final String label;
  final String value;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      width: 100,
      padding: const EdgeInsets.all(DrevvySpace.s3),
      decoration: BoxDecoration(
        color: colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: text.label.copyWith(color: colors.muted)),
          const SizedBox(height: DrevvySpace.s1),
          Text(value, style: text.figureS),
          Text(sub, style: text.micro.copyWith(color: colors.muted)),
        ],
      ),
    );
  }
}

class _KeySpecs extends StatelessWidget {
  const _KeySpecs({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final build = listing.build;

    final specs = <(IconData, String, String)>[
      if (build.engine != null)
        (LucideIcons.settings, 'Powertrain', build.engine!),
      if (build.drivetrain != null)
        (LucideIcons.gitBranch, 'Drivetrain', build.drivetrain!),
      if (build.cityMpg != null && build.highwayMpg != null)
        (LucideIcons.fuel, 'Fuel economy', '${build.cityMpg} / ${build.highwayMpg} mpg'),
      if (build.seatingCapacity != null)
        (LucideIcons.users, 'Seats', '${build.seatingCapacity}'),
      if (listing.colors?.exteriorColor != null)
        (LucideIcons.palette, 'Exterior', listing.colors!.exteriorColor!),
    ];

    return Column(
      children: specs.map((spec) {
        return Padding(
          padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
          child: Row(
            children: [
              Icon(spec.$1, color: colors.muted, size: 18),
              const SizedBox(width: DrevvySpace.s3),
              Text(spec.$2, style: text.body.copyWith(color: colors.muted)),
              const Spacer(),
              Text(spec.$3, style: text.bodyStrong),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyles = context.drevvyText;

    return Row(
      children: [
        Icon(icon, color: colors.mint, size: 18),
        const SizedBox(width: DrevvySpace.s3),
        Text(text, style: textStyles.body),
      ],
    );
  }
}

class _HowDrevvyWorks extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('How Drevvy works for you', style: text.title),
          const SizedBox(height: DrevvySpace.s4),
          _Step(number: '1', text: 'You tap "Get Best Price"'),
          _Step(number: '2', text: 'Drevvy asks the dealer for an itemized out-the-door price'),
          _Step(number: '3', text: 'You review each offer and decide'),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.text});

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyles = context.drevvyText;

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
                style: textStyles.label.copyWith(
                  color: colors.violet,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(child: Text(text, style: textStyles.body)),
        ],
      ),
    );
  }
}

class _StickyCta extends StatelessWidget {
  const _StickyCta({
    required this.listing,
    required this.user,
    required this.onTap,
  });

  final Listing listing;
  final User user;
  final VoidCallback onTap;

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
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final isPro = user.isPro;

    return Container(
      padding: EdgeInsets.fromLTRB(
        DrevvySpace.gutter,
        DrevvySpace.s3,
        DrevvySpace.gutter,
        DrevvySpace.s3 + bottomPadding,
      ),
      decoration: BoxDecoration(
        color: colors.glassSolid.withValues(alpha: 0.97),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(DrevvyRadius.sheetTop)),
        boxShadow: colors.elevSheet,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isPro) ...[
            // Pro banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: colors.lilacTint,
                borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              ),
              child: Row(
                children: [
                  Text(
                    'Pro',
                    style: text.label.copyWith(
                      color: colors.violet,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    ' · ${user.usage.formatted} · ${user.usage.resetsFormatted}',
                    style: text.label.copyWith(color: colors.onLilacTint),
                  ),
                ],
              ),
            ),
            const SizedBox(height: DrevvySpace.s3),
          ],
          
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '\$${_formatNumber(listing.price)}',
                    style: text.figureS,
                  ),
                  Text(
                    'Listed price',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ],
              ),
              const Spacer(),
              DrevvyButton(
                label: isPro ? 'Add to Drevvy' : 'Get Best Price',
                icon: isPro ? LucideIcons.plus : null,
                onPressed: onTap,
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s2),
          
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (!isPro)
                Icon(LucideIcons.lock, color: colors.muted, size: 12),
              const SizedBox(width: 4),
              Text(
                isPro
                    ? 'Drevvy contacts Dealer A during business hours'
                    : 'Drevvy Pro · \$97/mo · 10 cars a month',
                style: text.callout.copyWith(color: colors.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
