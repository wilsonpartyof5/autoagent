import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/ask_drevvy_sheet.dart';
import '../widgets/outcome_sheet.dart';
import '../widgets/remove_sheet.dart';

/// Screens 27-32: Deal detail with offer card, breakdown, and actions
class DealDetailScreen extends StatefulWidget {
  const DealDetailScreen({
    super.key,
    required this.dealId,
    this.openDidYouBuy = false,
  });

  final String dealId;

  /// Set by the `did_you_buy` push deep link.
  final bool openDidYouBuy;

  @override
  State<DealDetailScreen> createState() => _DealDetailScreenState();
}

class _DealDetailScreenState extends State<DealDetailScreen> {
  final _repo = DemoRepository.instance;
  Deal? _deal;
  bool _isLoading = true;
  bool _didOpenOutcome = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final deal = await _repo.getDealById(widget.dealId);
    setState(() {
      _deal = deal;
      _isLoading = false;
    });
    if (widget.openDidYouBuy && !_didOpenOutcome) {
      _didOpenOutcome = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showOutcomeSheet();
      });
    }
  }

  Future<void> _acceptOffer() async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AcceptSheet(deal: _deal!),
    );
    
    if (confirmed == true && mounted) {
      await _repo.acceptOffer(_deal!.id);
      await _loadData();
    }
  }

  Future<void> _keepGoing() async {
    await _repo.keepGoing(_deal!.id);
    await _loadData();
  }

  void _showAskDrevvySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AskDrevvySheet(deal: _deal!),
    );
  }

  Future<void> _showOutcomeSheet() async {
    if (!mounted) return;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => OutcomeSheet(
        deal: _deal!,
        onSubmit: (outcome) {
          Navigator.pop(context);
          // TODO: Handle outcome submission
        },
      ),
    );
  }

  Future<void> _showRemoveSheet() async {
    final user = await _repo.getCurrentUser();
    if (!mounted) return;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RemoveSheet(
        deal: _deal!,
        user: user,
        onRemove: () async {
          Navigator.pop(context);
          await _repo.removeDeal(_deal!.id);
          if (mounted && context.mounted) context.pop();
        },
        onKeep: () => Navigator.pop(context),
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
    final listing = deal.listing;
    final offer = deal.latestOffer;
    final hasOffer = offer != null;
    final showActions = deal.status == DealStatus.offerReceived;

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
                pinned: true,
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
                title: Text(
                  deal.status.dealerRevealed
                      ? deal.dealer?.name ?? 'Dealer ${deal.letter}'
                      : 'Dealer ${deal.letter}',
                  style: text.title,
                ),
                centerTitle: true,
                actions: [
                  // Ask Drevvy button
                  TextButton.icon(
                    onPressed: _showAskDrevvySheet,
                    icon: Icon(LucideIcons.messageCircle, size: 18),
                    label: const Text('Ask'),
                    style: TextButton.styleFrom(
                      foregroundColor: colors.violet,
                    ),
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
                      // Hero photo + chip
                      Stack(
                        children: [
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
                          Positioned(
                            left: DrevvySpace.s3,
                            bottom: DrevvySpace.s3,
                            child: StatusChip(deal.status),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: DrevvySpace.s4),
                      
                      // Car info
                      Text(listing.title, style: text.headline),
                      Text(
                        listing.milesFormatted,
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // OTD card (if has offer)
                      if (hasOffer) ...[
                        _OtdCard(
                          deal: deal,
                          offer: offer,
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Itemized breakdown
                        _ItemizedBreakdown(offer: offer),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Offer history (if multiple offers)
                        if (deal.offers.length > 1) ...[
                          _OfferHistory(offers: deal.offers),
                          const SizedBox(height: DrevvySpace.s6),
                        ],
                      ],
                      
                      // Activity timeline
                      _ActivityTimeline(events: deal.events),
                      
                      const SizedBox(height: DrevvySpace.s6),
                      
                      // Communications summary
                      _CommunicationsSummary(comms: deal.comms),
                      
                      // Demo actions for sheets
                      const SizedBox(height: DrevvySpace.s4),
                      Text('Demo actions', style: text.label.copyWith(color: colors.muted)),
                      const SizedBox(height: DrevvySpace.s2),
                      Wrap(
                        spacing: DrevvySpace.s2,
                        runSpacing: DrevvySpace.s2,
                        children: [
                          TextButton(
                            onPressed: _showOutcomeSheet,
                            child: const Text('Did you buy?'),
                          ),
                          TextButton(
                            onPressed: _showRemoveSheet,
                            child: const Text('Remove'),
                          ),
                        ],
                      ),
                      
                      // Space for sticky CTA
                      SizedBox(height: showActions ? 160 + bottomPadding : 80),
                    ],
                  ),
                ),
              ),
            ],
          ),
          
          // Sticky CTA (for Offer received status)
          if (showActions)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _StickyActions(
                onAccept: _acceptOffer,
                onKeepGoing: _keepGoing,
              ),
            ),
        ],
      ),
    );
  }
}

class _OtdCard extends StatelessWidget {
  const _OtdCard({
    required this.deal,
    required this.offer,
  });

  final Deal deal;
  final Offer offer;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    
    final market = deal.marketContext;
    final fairOtd = market?.fairOtd ?? offer.otd;
    final isBelowFair = offer.otd < fairOtd;
    final diff = fairOtd - offer.otd;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // OTD amount
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _formatPrice(offer.otd),
                style: text.figureL,
              ),
              const SizedBox(width: DrevvySpace.s2),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'out the door',
                  style: text.body.copyWith(color: colors.muted),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s4),
          
          // Price comparison bars
          _PriceBar(
            label: 'Listed',
            amount: deal.listedAtStart,
            maxAmount: deal.listedAtStart,
            color: colors.track,
          ),
          const SizedBox(height: DrevvySpace.s2),
          _PriceBar(
            label: 'This offer',
            amount: offer.vehiclePrice,
            maxAmount: deal.listedAtStart,
            color: colors.violet,
          ),
          
          const SizedBox(height: DrevvySpace.s4),
          
          // Savings badge
          if (deal.savings != null && deal.savings! > 0)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: DrevvySpace.s3,
                vertical: DrevvySpace.s2,
              ),
              decoration: BoxDecoration(
                color: colors.mintTint,
                borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.trendingDown, size: 16, color: colors.mint),
                  const SizedBox(width: DrevvySpace.s2),
                  Text(
                    '${_formatPrice(deal.savings!)} under listed',
                    style: text.bodyStrong.copyWith(color: colors.mint),
                  ),
                ],
              ),
            ),
          
          const SizedBox(height: DrevvySpace.s3),
          
          // Market comparison line
          Container(
            padding: const EdgeInsets.all(DrevvySpace.s3),
            decoration: BoxDecoration(
              color: isBelowFair ? colors.marketBelowFill : colors.marketAboveFill,
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
            ),
            child: Row(
              children: [
                Icon(
                  isBelowFair ? LucideIcons.trendingDown : LucideIcons.trendingUp,
                  size: 16,
                  color: isBelowFair ? colors.marketBelowText : colors.marketAboveText,
                ),
                const SizedBox(width: DrevvySpace.s2),
                Text(
                  isBelowFair
                      ? '${_formatPrice(diff)} below fair OTD'
                      : '${_formatPrice(-diff)} above fair OTD',
                  style: text.callout.copyWith(
                    color: isBelowFair ? colors.marketBelowText : colors.marketAboveText,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PriceBar extends StatelessWidget {
  const _PriceBar({
    required this.label,
    required this.amount,
    required this.maxAmount,
    required this.color,
  });

  final String label;
  final int amount;
  final int maxAmount;
  final Color color;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final fraction = maxAmount > 0 ? amount / maxAmount : 1.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: text.label.copyWith(color: colors.muted)),
            Text(_formatPrice(amount), style: text.bodyStrong),
          ],
        ),
        const SizedBox(height: DrevvySpace.s1),
        Container(
          height: 8,
          width: double.infinity,
          decoration: BoxDecoration(
            color: colors.track,
            borderRadius: BorderRadius.circular(4),
          ),
          child: FractionallySizedBox(
            widthFactor: fraction.clamp(0.0, 1.0),
            alignment: Alignment.centerLeft,
            child: Container(
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ItemizedBreakdown extends StatelessWidget {
  const _ItemizedBreakdown({required this.offer});

  final Offer offer;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
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
          Text('Itemized breakdown', style: text.title),
          const SizedBox(height: DrevvySpace.s4),
          
          ...offer.lines.map((line) => _LineRow(
            label: line.key,
            amount: line.amount,
            subLine: line.subLine,
          )),
          
          if (offer.removedAddOns.isNotEmpty) ...[
            const SizedBox(height: DrevvySpace.s3),
            Text(
              'Removed add-ons',
              style: text.label.copyWith(color: colors.muted),
            ),
            const SizedBox(height: DrevvySpace.s2),
            ...offer.removedAddOns.map((line) => _LineRow(
              label: line.key,
              amount: line.amount,
              isRemoved: true,
            )),
          ],
          
          Divider(height: DrevvySpace.s6, color: colors.line),
          
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total out the door', style: text.bodyStrong),
              Text(_formatPrice(offer.otd), style: text.figureS),
            ],
          ),
        ],
      ),
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({
    required this.label,
    required this.amount,
    this.subLine,
    this.isRemoved = false,
  });

  final String label;
  final int amount;
  final String? subLine;
  final bool isRemoved;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: text.body.copyWith(
                    color: isRemoved ? colors.muted : colors.ink,
                    decoration: isRemoved ? TextDecoration.lineThrough : null,
                  ),
                ),
                if (subLine != null)
                  Text(
                    subLine!,
                    style: text.callout.copyWith(color: colors.mint),
                  ),
              ],
            ),
          ),
          Text(
            isRemoved ? '-${_formatPrice(amount)}' : _formatPrice(amount),
            style: text.body.copyWith(
              color: isRemoved ? colors.mint : colors.ink,
              decoration: isRemoved ? TextDecoration.lineThrough : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferHistory extends StatelessWidget {
  const _OfferHistory({required this.offers});

  final List<Offer> offers;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
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
          Text('Offer history', style: text.title),
          const SizedBox(height: DrevvySpace.s4),
          
          Row(
            children: offers.asMap().entries.map((entry) {
              final i = entry.key;
              final offer = entry.value;
              final isLatest = i == offers.length - 1;
              
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < offers.length - 1 ? 8 : 0),
                  padding: const EdgeInsets.all(DrevvySpace.s3),
                  decoration: BoxDecoration(
                    color: isLatest ? colors.lilacTint : colors.tile,
                    borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    border: isLatest
                        ? Border.all(color: colors.violet, width: 2)
                        : null,
                  ),
                  child: Column(
                    children: [
                      Text(
                        'Offer ${i + 1}',
                        style: text.micro.copyWith(color: colors.muted),
                      ),
                      const SizedBox(height: DrevvySpace.s1),
                      Text(
                        _formatPrice(offer.otd),
                        style: text.bodyStrong.copyWith(
                          color: isLatest ? colors.violet : colors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _ActivityTimeline extends StatelessWidget {
  const _ActivityTimeline({required this.events});

  final List<DealEvent> events;

  String _formatDate(DateTime date) {
    return DateFormat('MMM d, h:mm a').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Activity', style: text.title),
        const SizedBox(height: DrevvySpace.s4),
        
        ...events.reversed.map((event) {
          return Padding(
            padding: const EdgeInsets.only(bottom: DrevvySpace.s4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 6),
                  decoration: BoxDecoration(
                    color: event.isLatest ? colors.violet : colors.muted,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: DrevvySpace.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.heading,
                        style: event.isLatest
                            ? text.bodyStrong
                            : text.body,
                      ),
                      if (event.detail != null)
                        Text(
                          event.detail!,
                          style: text.callout.copyWith(color: colors.muted),
                        ),
                      Text(
                        _formatDate(event.timestamp),
                        style: text.micro.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}

class _CommunicationsSummary extends StatelessWidget {
  const _CommunicationsSummary({required this.comms});

  final DealComms comms;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _CommStat(icon: LucideIcons.mail, count: comms.emails, label: 'Emails'),
          _CommStat(icon: LucideIcons.messageSquare, count: comms.texts, label: 'Texts'),
          _CommStat(icon: LucideIcons.phone, count: comms.calls, label: 'Calls'),
        ],
      ),
    );
  }
}

class _CommStat extends StatelessWidget {
  const _CommStat({
    required this.icon,
    required this.count,
    required this.label,
  });

  final IconData icon;
  final int count;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      children: [
        Icon(icon, size: 20, color: colors.muted),
        const SizedBox(height: DrevvySpace.s1),
        Text('$count', style: text.figureS),
        Text(label, style: text.micro.copyWith(color: colors.muted)),
      ],
    );
  }
}

class _StickyActions extends StatelessWidget {
  const _StickyActions({
    required this.onAccept,
    required this.onKeepGoing,
  });

  final VoidCallback onAccept;
  final VoidCallback onKeepGoing;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DrevvyButton(
            label: 'Accept this offer',
            icon: LucideIcons.check,
            onPressed: onAccept,
            variant: DrevvyButtonVariant.accept,
          ),
          const SizedBox(height: DrevvySpace.s3),
          DrevvyGhostButton(
            label: 'Ask Drevvy to keep going',
            onPressed: onKeepGoing,
          ),
        ],
      ),
    );
  }
}

class _AcceptSheet extends StatelessWidget {
  const _AcceptSheet({required this.deal});

  final Deal deal;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final offer = deal.latestOffer!;

    return Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: DrevvySpace.s3),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.track,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          
          Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Accept this offer?', style: text.headline),
                const SizedBox(height: DrevvySpace.s4),
                
                // Summary card
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  decoration: BoxDecoration(
                    color: colors.acceptTint,
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.car, color: colors.accept, size: 24),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              deal.listing.shortTitle,
                              style: text.bodyStrong,
                            ),
                            Text(
                              '${_formatPrice(offer.otd)} out the door',
                              style: text.callout.copyWith(color: colors.accept),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                Text('What happens next', style: text.title),
                const SizedBox(height: DrevvySpace.s3),
                
                _StepRow(number: '1', text: 'Drevvy requests an official written offer'),
                _StepRow(number: '2', text: 'The dealer emails the offer to Drevvy'),
                _StepRow(number: '3', text: 'Drevvy verifies and forwards it to you'),
                
                const SizedBox(height: DrevvySpace.s6),
                
                DrevvyButton(
                  label: 'Accept',
                  icon: LucideIcons.check,
                  onPressed: () => Navigator.pop(context, true),
                  variant: DrevvyButtonVariant.accept,
                ),
                const SizedBox(height: DrevvySpace.s3),
                DrevvyGhostButton(
                  label: 'Not yet',
                  onPressed: () => Navigator.pop(context, false),
                ),
              ],
            ),
          ),
          
          SizedBox(height: bottomPadding),
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
          Expanded(child: Text(text, style: textStyle.body)),
        ],
      ),
    );
  }
}
