import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/models.dart';
import '../../../data/services/purchase_service.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/market_price_bar.dart';
import '../widgets/new_car_market_card.dart';
import '../widgets/add_to_drevvy_sheet.dart';
import '../widgets/pack_picker_sheet.dart';
import '../widgets/out_of_cars_sheet.dart';

/// Screens 12, 13, 16, 44: VDP (Vehicle Detail Page) - used and new car variants.
/// v1.7: Uses car credit balance instead of Pro subscription.
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
  CarCreditBalance? _creditBalance;
  AvgSavingsConfig? _avgSavings;
  bool _isLoading = true;
  
  /// v1.8: Track if car is saved (heart state)
  bool _isSaved = false;
  /// v1.8: Track if car is already in Deals (hide heart if so)
  bool _isInDeals = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final listing = await _repo.getListingById(widget.listingId);
    final market = await _repo.getMarketContext(listing);
    final balance = await _repo.getCreditBalance();
    final avgSavings = await _repo.getAvgSavingsConfig();
    
    // v1.8: Check if listing is saved or in deals
    await _repo.getSavedCars(); // ensure initialized
    final isSaved = _repo.isListingSaved(listing.id);
    final isInDeals = _repo.isListingInDeals(listing.id);
    
    setState(() {
      _listing = listing;
      _market = market;
      _creditBalance = balance;
      _avgSavings = avgSavings;
      _isSaved = isSaved;
      _isInDeals = isInDeals;
      _isLoading = false;
    });
  }
  
  /// v1.8: Handle heart tap on VDP
  Future<void> _handleSaveToggle() async {
    if (_listing == null) return;
    
    HapticFeedback.lightImpact();
    
    if (_isSaved) {
      await _repo.unsaveByListingId(_listing!.id);
      setState(() => _isSaved = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Removed from Saved'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } else {
      await _repo.saveCar(_listing!);
      setState(() => _isSaved = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Saved for later'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  /// v1.7: Show AddToDrevvySheet when user has credits.
  void _showAddSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddToDrevvySheet(
        listing: _listing!,
        market: _market!,
        creditBalance: _creditBalance!,
        onAdd: () async {
          await _repo.addDeal(_listing!);
          if (mounted && context.mounted) {
            Navigator.pop(context);
            context.go('/deals');
          }
        },
      ),
    );
  }

  /// v1.7: Show PackPickerSheet when user has no credits (first-time paywall).
  void _showPackPickerSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => PackPickerSheet(
        listing: _listing!,
        avgSavings: _avgSavings,
        onPurchase: (packType) async {
          final result = await _repo.purchasePack(packType);
          if (result is PurchaseSuccess && mounted) {
            // Reload balance and show add sheet
            final newBalance = await _repo.getCreditBalance();
            setState(() => _creditBalance = newBalance);
            if (context.mounted) {
              Navigator.pop(context);
              _showAddSheet();
            }
          }
        },
        onRestore: () async {
          await _repo.restorePurchases();
          if (context.mounted) Navigator.pop(context);
        },
        onKeepShopping: () {
          Navigator.pop(context);
        },
      ),
    );
  }

  /// v1.7: Show OutOfCarsSheet when user's balance is 0.
  void _showOutOfCarsSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => OutOfCarsSheet(
        listing: _listing!,
        onPurchase: (packType) async {
          final result = await _repo.purchasePack(packType);
          if (result is PurchaseSuccess && mounted) {
            final newBalance = await _repo.getCreditBalance();
            setState(() => _creditBalance = newBalance);
            if (context.mounted) {
              Navigator.pop(context);
              _showAddSheet();
            }
          }
        },
        onNotNow: () {
          Navigator.pop(context);
        },
      ),
    );
  }

  /// v1.7: Determine which sheet to show based on credit balance.
  void _handleUnlockTap() {
    final balance = _creditBalance!;
    if (balance.canUnlock) {
      // Has credits: show add sheet directly
      _showAddSheet();
    } else if (balance.totalPurchased == 0) {
      // Never purchased: show pack picker (first-time paywall)
      _showPackPickerSheet();
    } else {
      // Had credits but used them all: show out of cars
      _showOutOfCarsSheet();
    }
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
    final creditBalance = _creditBalance!;
    final hasCredits = creditBalance.canUnlock;

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
                  // v1.8: Heart button (only show if not already in Deals)
                  if (!_isInDeals)
                    IconButton(
                      icon: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: colors.glassSolid,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          LucideIcons.heart,
                          color: _isSaved ? colors.danger : colors.ink,
                        ),
                      ),
                      onPressed: _handleSaveToggle,
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
                      
                      // Market card: different for new vs used cars (per spec §10.6)
                      if (listing.isNew)
                        NewCarMarketCard(listing: listing, market: market)
                      else
                        MarketPriceBar(listing: listing, market: market),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Market tiles (used cars only)
                      if (!listing.isNew)
                        _MarketTiles(listing: listing, market: market),
                      
                      if (!listing.isNew)
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
                      
                      // v1.7: How Drevvy works (show for users without credits)
                      if (!hasCredits) ...[
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
              creditBalance: creditBalance,
              onTap: _handleUnlockTap,
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

/// v1.7: Updated copy to reflect pack-based pricing.
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
          _Step(number: '1', text: 'You tap "Unlock my price"'),
          _Step(number: '2', text: 'Pick a car pack (3, 5, or 10 cars)'),
          _Step(number: '3', text: 'Drevvy asks the dealer for an itemized out-the-door price'),
          _Step(number: '4', text: 'You review each offer and decide'),
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

/// v1.7: Sticky CTA updated to use credit balance instead of Pro subscription.
class _StickyCta extends StatelessWidget {
  const _StickyCta({
    required this.listing,
    required this.creditBalance,
    required this.onTap,
  });

  final Listing listing;
  final CarCreditBalance creditBalance;
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
    final hasCredits = creditBalance.canUnlock;

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
          // v1.7: Show credit balance when user has credits
          if (hasCredits) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: colors.lilacTint,
                borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              ),
              child: Text(
                creditBalance.displayText,
                style: text.label.copyWith(
                  color: colors.violet,
                  fontWeight: FontWeight.w700,
                ),
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
                label: 'Unlock my price',
                icon: LucideIcons.sparkles,
                onPressed: onTap,
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s2),
          
          // v1.7: Updated copy - no more "Pro" or "/mo"
          Text(
            hasCredits
                ? 'Drevvy contacts Dealer A during business hours'
                : 'From \$9.70/car · Car packs never expire',
            style: text.callout.copyWith(color: colors.muted),
          ),
        ],
      ),
    );
  }
}
