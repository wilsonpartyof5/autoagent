import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// Screen 38: Did you buy it? (outcome sheet)
class OutcomeSheet extends StatefulWidget {
  const OutcomeSheet({
    super.key,
    required this.deal,
    required this.onSubmit,
  });

  final Deal deal;
  final Function(DealOutcome outcome) onSubmit;

  @override
  State<OutcomeSheet> createState() => _OutcomeSheetState();
}

class _OutcomeSheetState extends State<OutcomeSheet> {
  DealOutcomeType? _selectedType;
  final _priceController = TextEditingController();
  final _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('outcome', {'deal_id': widget.deal.id});
  }

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  void _submit() {
    if (_selectedType == null) return;

    final price = _selectedType == DealOutcomeType.boughtDifferentPrice
        ? int.tryParse(_priceController.text.replaceAll(',', ''))
        : null;
    final outcome = DealOutcome(
      type: _selectedType!,
      actualPrice: price,
      note: _noteController.text.isNotEmpty ? _noteController.text : null,
    );
    ProductAnalytics.instance.track(AnalyticsEvents.outcomeSubmitted, {
      'deal_id': widget.deal.id,
      'outcome': switch (_selectedType!) {
        DealOutcomeType.bought => 'bought',
        DealOutcomeType.boughtDifferentPrice => 'bought_different_price',
        DealOutcomeType.notYet => 'not_yet',
        DealOutcomeType.no => 'no',
      },
      'has_note': _noteController.text.trim().isNotEmpty,
      'has_price': price != null,
    });

    widget.onSubmit(outcome);
  }

  @override
  void dispose() {
    _priceController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = widget.deal.listing;

    return Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: SingleChildScrollView(
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
                  Text('Did you buy it?', style: text.headline),

                  const SizedBox(height: DrevvySpace.s4),

                  // Car row
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
                                  child: Icon(LucideIcons.car, color: colors.muted),
                                ),
                        ),
                      ),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(listing.shortTitle, style: text.bodyStrong),
                            if (widget.deal.latestOffer != null)
                              Text(
                                '${_formatPrice(widget.deal.latestOffer!.otd)} offer',
                                style: text.callout.copyWith(color: colors.muted),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: DrevvySpace.s5),

                  // Options
                  _OptionTile(
                    icon: LucideIcons.circleCheck,
                    title: 'Yes, at the offer price',
                    isSelected: _selectedType == DealOutcomeType.bought,
                    onTap: () => setState(() => _selectedType = DealOutcomeType.bought),
                  ),

                  _OptionTile(
                    icon: LucideIcons.dollarSign,
                    title: 'Yes, at a different price',
                    isSelected: _selectedType == DealOutcomeType.boughtDifferentPrice,
                    onTap: () => setState(() => _selectedType = DealOutcomeType.boughtDifferentPrice),
                  ),

                  if (_selectedType == DealOutcomeType.boughtDifferentPrice) ...[
                    const SizedBox(height: DrevvySpace.s3),
                    TextField(
                      controller: _priceController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(
                        prefixText: r'$ ',
                        hintText: 'Final price',
                        filled: true,
                        fillColor: colors.tile,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ],

                  _OptionTile(
                    icon: LucideIcons.clock,
                    title: 'Not yet',
                    isSelected: _selectedType == DealOutcomeType.notYet,
                    onTap: () => setState(() => _selectedType = DealOutcomeType.notYet),
                  ),

                  _OptionTile(
                    icon: LucideIcons.x,
                    title: 'No, I didn\'t buy',
                    isSelected: _selectedType == DealOutcomeType.no,
                    onTap: () => setState(() => _selectedType = DealOutcomeType.no),
                  ),

                  const SizedBox(height: DrevvySpace.s4),

                  // Note field
                  Text('Note (optional)', style: text.callout.copyWith(color: colors.muted)),
                  const SizedBox(height: DrevvySpace.s2),
                  TextField(
                    controller: _noteController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Any feedback?',
                      filled: true,
                      fillColor: colors.tile,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),

                  const SizedBox(height: DrevvySpace.s6),

                  DrevvyPrimaryButton(
                    label: 'Submit',
                    onPressed: _selectedType != null ? _submit : null,
                  ),
                ],
              ),
            ),

            SizedBox(height: bottomPadding),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.icon,
    required this.title,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
      child: Material(
        color: isSelected ? colors.lilacTint : colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          child: Container(
            padding: const EdgeInsets.all(DrevvySpace.s4),
            decoration: BoxDecoration(
              border: isSelected
                  ? Border.all(color: colors.violet, width: 2)
                  : null,
              borderRadius: BorderRadius.circular(DrevvyRadius.md),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  color: isSelected ? colors.violet : colors.muted,
                  size: 22,
                ),
                const SizedBox(width: DrevvySpace.s3),
                Text(
                  title,
                  style: text.body.copyWith(
                    color: isSelected ? colors.violet : colors.ink,
                  ),
                ),
                const Spacer(),
                if (isSelected)
                  Icon(LucideIcons.check, color: colors.violet, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
