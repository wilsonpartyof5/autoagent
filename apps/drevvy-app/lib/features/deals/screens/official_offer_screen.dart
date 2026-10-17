import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/location_pickup_sheet.dart';
import '../widgets/trade_in_financing_sheet.dart';
import '../widgets/left_dealership_sheet.dart';

/// Screen 33: Official offer with dealer reveal
class OfficialOfferScreen extends StatefulWidget {
  const OfficialOfferScreen({super.key, required this.dealId});

  final String dealId;

  @override
  State<OfficialOfferScreen> createState() => _OfficialOfferScreenState();
}

class _OfficialOfferScreenState extends State<OfficialOfferScreen> {
  final _repo = DemoRepository.instance;
  Deal? _deal;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final deal = await _repo.getDealById(widget.dealId);
    ProductAnalytics.instance.track(AnalyticsEvents.offerViewed, {
      'deal_id': deal.id,
      'surface': 'official_offer',
      'round_count': deal.offers.length,
    });
    setState(() {
      _deal = deal;
      _isLoading = false;
    });
  }

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  Future<void> _showLocationPickupSheet() async {
    final dealer = _deal?.dealer;
    if (dealer == null) return;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => LocationPickupSheet(
        dealerName: dealer.name,
        onAllow: () {
          Navigator.pop(context);
          // TODO: Request location permission
        },
        onNotNow: () => Navigator.pop(context),
      ),
    );
  }

  Future<void> _showTradeInFinancingSheet() async {
    final user = await _repo.getCurrentUser();
    if (!mounted || user.prefs == null) return;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => TradeInFinancingSheet(
        userPrefs: user.prefs!,
        onYes: () {
          Navigator.pop(context);
          // TODO: Continue with trade-in/financing flow
        },
        onNoThanks: () => Navigator.pop(context),
      ),
    );
  }

  void _showLeftDealershipSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => LeftDealershipSheet(
        deal: _deal!,
        onBought: () {
          Navigator.pop(context);
          context.push('/deal/${_deal!.id}/done');
        },
        onStillLooking: () => Navigator.pop(context),
        onDismiss: () => Navigator.pop(context),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    if (_isLoading || _deal == null) {
      return Scaffold(
        body: Stack(
          children: [
            const CanvasBackground(),
            const Center(child: CircularProgressIndicator()),
          ],
        ),
      );
    }

    final deal = _deal!;
    final dealer = deal.dealer;
    final official = deal.officialOffer;

    if (dealer == null || official == null) {
      return Scaffold(
        body: Stack(
          children: [
            const CanvasBackground(),
            Center(
              child: Text('No official offer yet', style: text.body),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          CustomScrollView(
            slivers: [
              // App bar
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
              ),
              
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(DrevvySpace.gutter),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Reveal card
                      GlassCard(
                        padding: const EdgeInsets.all(DrevvySpace.s5),
                        child: Column(
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: colors.mintTint,
                                shape: BoxShape.circle,
                              ),
                              child:                             Icon(
                                LucideIcons.circleCheck,
                                size: 32,
                                color: colors.mint,
                              ),
                            ),
                            const SizedBox(height: DrevvySpace.s4),
                            Text('Official offer received', style: text.headline),
                            const SizedBox(height: DrevvySpace.s2),
                            Text(
                              'Was Dealer ${deal.letter}',
                              style: text.callout.copyWith(color: colors.muted),
                            ),
                            const SizedBox(height: DrevvySpace.s1),
                            Text(
                              dealer.name,
                              style: text.title.copyWith(color: colors.mint),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Dealer contact
                      Text('Your contact', style: text.title),
                      const SizedBox(height: DrevvySpace.s3),
                      
                      GlassCard(
                        padding: const EdgeInsets.all(DrevvySpace.s4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (dealer.rep != null) ...[
                              Text(dealer.rep!.name, style: text.bodyStrong),
                              if (dealer.rep!.role != null)
                                Text(
                                  dealer.rep!.role!,
                                  style: text.callout.copyWith(color: colors.muted),
                                ),
                              const SizedBox(height: DrevvySpace.s4),
                            ],
                            
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () {
                                      ProductAnalytics.instance.track(
                                        AnalyticsEvents.contactTapped,
                                        {'channel': 'phone'},
                                      );
                                    },
                                    icon: Icon(LucideIcons.phone, size: 18),
                                    label: const Text('Call'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: colors.ink,
                                      side: BorderSide(color: colors.line),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: DrevvySpace.s3),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () {
                                      ProductAnalytics.instance.track(
                                        AnalyticsEvents.contactTapped,
                                        {'channel': 'email'},
                                      );
                                    },
                                    icon: Icon(LucideIcons.mail, size: 18),
                                    label: const Text('Email'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: colors.ink,
                                      side: BorderSide(color: colors.line),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Address + directions
                      Text('Dealership', style: text.title),
                      const SizedBox(height: DrevvySpace.s3),
                      
                      GlassCard(
                        padding: const EdgeInsets.all(DrevvySpace.s4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(dealer.name, style: text.bodyStrong),
                            Text(
                              dealer.formattedAddress,
                              style: text.body.copyWith(color: colors.muted),
                            ),
                            if (dealer.distance != null)
                              Text(
                                '${dealer.distanceFormatted} away',
                                style: text.callout.copyWith(color: colors.muted),
                              ),
                            const SizedBox(height: DrevvySpace.s3),
                            OutlinedButton.icon(
                              onPressed: () {
                                ProductAnalytics.instance.track(
                                  AnalyticsEvents.directionsTapped,
                                );
                              },
                              icon: Icon(LucideIcons.navigation, size: 18),
                              label: const Text('Get directions'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: colors.violet,
                                side: BorderSide(color: colors.violet),
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Offer summary
                      Text('Official offer', style: text.title),
                      const SizedBox(height: DrevvySpace.s3),
                      
                      GlassCard(
                        padding: const EdgeInsets.all(DrevvySpace.s4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Out the door', style: text.body),
                                Text(_formatPrice(official.otd), style: text.figureS),
                              ],
                            ),
                            const SizedBox(height: DrevvySpace.s2),
                            Text(
                              'VIN: ${official.vin}',
                              style: text.callout.copyWith(color: colors.muted),
                            ),
                            const SizedBox(height: DrevvySpace.s3),
                            Text(
                              'Forwarded to your email',
                              style: text.callout.copyWith(color: colors.mint),
                            ),
                          ],
                        ),
                      ),
                      
                      // Demo actions for sheets
                      const SizedBox(height: DrevvySpace.s4),
                      Text('Demo actions', style: text.label.copyWith(color: colors.muted)),
                      const SizedBox(height: DrevvySpace.s2),
                      Wrap(
                        spacing: DrevvySpace.s2,
                        runSpacing: DrevvySpace.s2,
                        children: [
                          TextButton(
                            onPressed: _showLocationPickupSheet,
                            child: const Text('Pickup check'),
                          ),
                          TextButton(
                            onPressed: _showTradeInFinancingSheet,
                            child: const Text('Trade-in'),
                          ),
                          TextButton(
                            onPressed: _showLeftDealershipSheet,
                            child: const Text('Left dealer'),
                          ),
                        ],
                      ),
                      
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
            child: Container(
              padding: EdgeInsets.fromLTRB(
                DrevvySpace.gutter,
                DrevvySpace.s4,
                DrevvySpace.gutter,
                DrevvySpace.s4 + bottomPadding,
              ),
              decoration: BoxDecoration(
                color: colors.glassSolid.withValues(alpha: 0.97),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(DrevvyRadius.sheetTop),
                ),
                boxShadow: colors.elevSheet,
              ),
              child: DrevvyPrimaryButton(
                label: "I'm all set",
                onPressed: () {
                  ProductAnalytics.instance.track(AnalyticsEvents.doneAction, {
                    'action': 'continue',
                  });
                  context.push('/deal/${deal.id}/done');
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
