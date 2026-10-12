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

/// Screen 36: Done / You're all set
class DoneScreen extends StatefulWidget {
  const DoneScreen({super.key, required this.dealId});

  final String dealId;

  @override
  State<DoneScreen> createState() => _DoneScreenState();
}

class _DoneScreenState extends State<DoneScreen> {
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
    setState(() {
      _deal = deal;
      _isLoading = false;
    });
  }

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
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
    final dealer = deal.dealer;

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              child: Column(
                children: [
                  const Spacer(),
                  
                  // Success orb
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      gradient: DrevvyBrand.gradient,
                      shape: BoxShape.circle,
                      boxShadow: colors.elevBrand,
                    ),
                    child: Icon(
                      LucideIcons.check,
                      size: 48,
                      color: DrevvyColors.onBrand,
                    ),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  Text("You're all set", style: text.display),
                  const SizedBox(height: DrevvySpace.s2),
                  Text(
                    'Good luck with your new car!',
                    style: text.body.copyWith(color: colors.muted),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s8),
                  
                  // Summary card
                  GlassCard(
                    padding: const EdgeInsets.all(DrevvySpace.s4),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                              child: SizedBox(
                                width: 60,
                                height: 45,
                                child: listing.media.primaryPhoto != null
                                    ? Image.asset(
                                        listing.media.primaryPhoto!,
                                        fit: BoxFit.cover,
                                      )
                                    : Container(
                                        color: colors.tile,
                                        child: Icon(
                                          LucideIcons.car,
                                          color: colors.muted,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(width: DrevvySpace.s3),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(listing.shortTitle, style: text.bodyStrong),
                                  if (dealer != null)
                                    Text(
                                      dealer.name,
                                      style: text.callout.copyWith(color: colors.muted),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        
                        const SizedBox(height: DrevvySpace.s4),
                        Divider(color: colors.line),
                        const SizedBox(height: DrevvySpace.s4),
                        
                        if (offer != null) ...[
                          _SummaryRow(
                            label: 'Out the door',
                            value: _formatPrice(offer.otd),
                          ),
                          if (deal.savings != null && deal.savings! > 0)
                            _SummaryRow(
                              label: 'Under listed',
                              value: _formatPrice(deal.savings!),
                              valueColor: colors.mint,
                            ),
                        ],
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  // Agent on call
                  GlassCard(
                    padding: const EdgeInsets.all(DrevvySpace.s4),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            gradient: DrevvyBrand.gradient,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            LucideIcons.messageCircle,
                            size: 20,
                            color: DrevvyColors.onBrand,
                          ),
                        ),
                        const SizedBox(width: DrevvySpace.s3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Drevvy is on call', style: text.bodyStrong),
                              Text(
                                'Need help with your trade-in or financing?',
                                style: text.callout.copyWith(color: colors.muted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  const Spacer(),
                  
                  // CTAs
                  DrevvyPrimaryButton(
                    label: 'Back to Deals',
                    onPressed: () {
                      context.go('/deals');
                    },
                  ),
                  const SizedBox(height: DrevvySpace.s3),
                  DrevvyGhostButton(
                    label: 'Find another car',
                    onPressed: () {
                      context.go('/shop');
                    },
                  ),
                  
                  SizedBox(height: bottomPadding + DrevvySpace.s4),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: text.body.copyWith(color: colors.muted)),
          Text(
            value,
            style: text.bodyStrong.copyWith(color: valueColor ?? colors.ink),
          ),
        ],
      ),
    );
  }
}
