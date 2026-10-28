import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/providers/app_services.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/cars_balance_placement.dart';
import '../../../data/services/purchase_config.dart';
import '../../../data/services/superwall_placement.dart';
import '../../deals/widgets/notification_preprompt_sheet.dart';
import '../widgets/dealer_chat_sheet.dart';
import '../widgets/market_intel_sheet.dart';
import '../widgets/market_price_bar.dart';
import '../widgets/new_car_market_card.dart';
import '../widgets/otd_request_sheet.dart';
import '../widgets/unlock_paywall.dart';
import '../widgets/vdp_cta_bar.dart';

/// Screens 12, 13, 16, 44: VDP (Vehicle Detail Page) - used and new car variants.
/// v1.7: Uses key balance instead of a monthly subscription.
class VdpScreen extends ConsumerStatefulWidget {
  const VdpScreen({super.key, required this.listingId});

  final String listingId;

  @override
  ConsumerState<VdpScreen> createState() => _VdpScreenState();
}

class _VdpScreenState extends ConsumerState<VdpScreen> {
  final _repo = DemoRepository.instance;
  final CarsBalancePlacement _carsBalancePlacement = carsBalancePlacementFor(
    PurchaseConfig.fromEnvironment(),
  );
  Listing? _listing;
  MarketContext? _market;
  CarCreditBalance? _creditBalance;
  AvgSavingsConfig? _avgSavings;
  bool _isLoading = true;

  /// v1.8: Track if car is saved (heart state)
  bool _isSaved = false;

  /// v1.8: Track if car is already in Deals (hide heart if so)
  bool _isInDeals = false;

  RooftopMatch? _rooftopMatch;
  bool _marketIntelUnlocked = false;
  bool _conversationOpen = false;
  bool _otdRequested = false;
  String _shopperFirstName = 'Dana';

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
    final match = await _repo.getRooftopMatch(listing);
    final user = await _repo.getCurrentUser();
    if (!mounted) return;

    setState(() {
      _listing = listing;
      _market = market;
      _creditBalance = balance;
      _avgSavings = avgSavings;
      _isSaved = isSaved;
      _isInDeals = isInDeals;
      _rooftopMatch = match;
      _marketIntelUnlocked = _repo.hasUnlockedMarketIntel(listing.id);
      _conversationOpen = _repo.hasStartedConversation(listing.id);
      _otdRequested = _repo.hasRequestedOtd(listing.id);
      _shopperFirstName = user.firstName;
      _isLoading = false;
    });
    ProductAnalytics.instance.track(AnalyticsEvents.carViewed, {
      'listing_id': listing.id,
      'inventory_type': listing.inventoryType,
    });
  }

  /// v1.8: Handle heart tap on VDP
  Future<void> _handleSaveToggle() async {
    if (_listing == null) return;

    HapticFeedback.lightImpact();

    if (_isSaved) {
      await _repo.unsaveByListingId(_listing!.id, source: 'car_detail');
      if (!mounted) return;
      setState(() => _isSaved = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Removed from Saved'),
          duration: Duration(seconds: 2),
        ),
      );
    } else {
      await _repo.saveCar(_listing!, source: 'car_detail');
      if (!mounted) return;
      setState(() => _isSaved = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Saved for later'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  /// Ask for notification permission the first time a conversation starts.
  Future<void> _maybePromptNotifications() async {
    final prompt = ref.read(notificationPromptProvider);
    final shouldAsk = await prompt.shouldPromptAfterAdd();
    if (!mounted || !shouldAsk) return;
    await prompt.markPrompted();
    if (!mounted) return;
    final allow = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => NotificationPrepromptSheet(
        onAllow: () => Navigator.pop(sheetContext, true),
        onNotNow: () => Navigator.pop(sheetContext, false),
      ),
    );
    if (allow == true) {
      await ref.read(pushNotificationServiceProvider).enable();
    }
  }

  Future<void> _refreshBalance() async {
    final next = await _repo.getCreditBalance();
    if (!mounted) return;
    setState(() => _creditBalance = next);
  }

  /// Key A: market intel + save. Paywall only when the key balance is 0.
  void _handleMarketIntelTap() {
    final listing = _listing;
    final balance = _creditBalance;
    if (listing == null || balance == null) return;
    unawaited(
      showUnlockPaywall(
        context: context,
        listing: listing,
        balance: balance,
        repo: _repo,
        avgSavings: _avgSavings,
        placement: _carsBalancePlacement,
        onCanUnlock: (next) async {
          if (!mounted) return;
          setState(() => _creditBalance = next);
          await showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (sheetContext) => MarketIntelSheet(
              listing: listing,
              creditBalance: next,
              onConfirm: () async {
                final ok = await _repo.unlockMarketIntel(listing);
                if (!mounted) return;
                await _refreshBalance();
                if (!ok) return;
                setState(() {
                  _marketIntelUnlocked = true;
                  _isSaved = true;
                });
              },
            ),
          );
        },
      ),
    );
  }

  /// Key B: in-network anonymous dealer chat.
  void _handleConversationTap() {
    final listing = _listing;
    final balance = _creditBalance;
    final match = _rooftopMatch;
    if (listing == null || balance == null || match == null) return;
    if (_conversationOpen || balance.canUnlock) {
      unawaited(_openConversationSheet(listing, match, balance));
      return;
    }
    unawaited(
      showUnlockPaywall(
        context: context,
        listing: listing,
        balance: balance,
        repo: _repo,
        avgSavings: _avgSavings,
        placement: _carsBalancePlacement,
        onCanUnlock: (next) async {
          if (!mounted) return;
          setState(() => _creditBalance = next);
          await _openConversationSheet(listing, match, next);
        },
      ),
    );
  }

  Future<void> _openConversationSheet(
    Listing listing,
    RooftopMatch match,
    CarCreditBalance balance,
  ) async {
    final dealId = _conversationOpen
        ? _repo.dealIdForListing(listing.id)
        : null;
    final inputs = _chipInputsFor(listing, dealId);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => DealerChatSheet(
        listing: listing,
        match: match,
        creditBalance: balance,
        alreadyOpen: _conversationOpen,
        shopperFirstName: _shopperFirstName,
        dealId: dealId,
        chipInputs: inputs,
        chipsEndpoint: _repo.dealChips,
        onSend: ({templateId, message}) async {
          final deal = await _repo.startDealerConversation(
            listing,
            match,
            templateId: templateId,
            message: message,
          );
          final threadId = _repo.dealIdForListing(listing.id) ?? deal?.id;
          if (threadId != null &&
              message != null &&
              message.trim().isNotEmpty) {
            _repo.rememberDealMessage(threadId, body: message);
          }
          if (!mounted) return;
          await _refreshBalance();
          setState(() => _conversationOpen = deal != null || _conversationOpen);
          if (deal != null) unawaited(_maybePromptNotifications());
        },
      ),
    );
  }

  /// Thread, market intel, feature, and visit time for [dealId].
  /// Visit day and time are loaded as absent until the shopper picks them.
  /// A brand-new conversation has no deal id yet, so the sheet keeps the
  /// after-opener pair until the thread exists.
  DealChipInputs? _chipInputsFor(Listing listing, String? dealId) {
    if (dealId == null) return null;
    return DealChipInputs.loaded(
      messages: _repo.dealThread(dealId),
      market: _market,
      feature: DealChipInputs.featureFromListing(listing),
      stockNumber: listing.stockNo,
      listedPrice: listing.price,
      dom: listing.domActive,
      shopperFirst: _shopperFirstName,
    );
  }

  /// Off-network: request an OTD number. Analytics only, not chat.
  void _handleOtdRequestTap() {
    final listing = _listing;
    if (listing == null) return;
    unawaited(
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (sheetContext) => OtdRequestSheet(
          listing: listing,
          alreadyRequested: _otdRequested,
          onConfirm: ({note}) async {
            await _repo.requestOtdNumber(listing, note: note);
            if (!mounted) return;
            setState(() => _otdRequested = true);
          },
        ),
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
                      tooltip: _isSaved ? 'Unsave car' : 'Save car',
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: DrevvySpace.gutter,
                  ),
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
                                  child: Icon(
                                    LucideIcons.imageOff,
                                    color: colors.muted,
                                    size: 48,
                                  ),
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
                      if (listing.extra?.highValueFeatures?.isNotEmpty ==
                          true) ...[
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
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                              ),
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

                      // Space for two-key sticky CTA
                      SizedBox(height: 280 + bottomPadding),
                    ],
                  ),
                ),
              ),
            ],
          ),

          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: VdpCtaBar(
              listing: listing,
              creditBalance: creditBalance,
              match: _rooftopMatch,
              marketIntelUnlocked: _marketIntelUnlocked,
              conversationOpen: _conversationOpen,
              otdRequested: _otdRequested,
              onMarketIntel: _handleMarketIntelTap,
              onConversation: _handleConversationTap,
              onOtdRequest: _handleOtdRequestTap,
            ),
          ),
        ],
      ),
    );
  }
}

class _MarketTiles extends StatelessWidget {
  const _MarketTiles({required this.listing, required this.market});

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
  const _Tile({required this.label, required this.value, required this.sub});

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
        (
          LucideIcons.fuel,
          'Fuel economy',
          '${build.cityMpg} / ${build.highwayMpg} mpg',
        ),
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
  const _HistoryRow({required this.icon, required this.text});

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
          _Step(number: '1', text: 'Unlock market intel and save this listing'),
          _Step(
            number: '2',
            text: 'Pick a key pack (1, 5, 10, or 25 keys) if your balance is 0',
          ),
          _Step(
            number: '3',
            text: 'If this listing URL matches an onboarded rooftop, ask the dealer anonymously with a second key. They see your first name only.',
          ),
          _Step(
            number: '4',
            text: 'If not, request the out-the-door number for free — analytics form, not chat, no key',
          ),
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
