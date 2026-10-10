import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// Screen 18: Add to Drevvy bottom sheet
class AddToDrevvySheet extends StatefulWidget {
  const AddToDrevvySheet({
    super.key,
    required this.listing,
    required this.market,
    required this.user,
    required this.onAdd,
  });

  final Listing listing;
  final MarketContext market;
  final User user;
  final Function(int? maxOtd) onAdd;

  @override
  State<AddToDrevvySheet> createState() => _AddToDrevvySheetState();
}

class _AddToDrevvySheetState extends State<AddToDrevvySheet> {
  final _maxOtdController = TextEditingController();
  bool _isLoading = false;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  void initState() {
    super.initState();
    // Pre-fill with fair OTD as suggestion
    _maxOtdController.text = widget.market.fairOtd.toString();
  }

  @override
  void dispose() {
    _maxOtdController.dispose();
    super.dispose();
  }

  Future<void> _handleAdd() async {
    setState(() => _isLoading = true);
    final maxOtd = int.tryParse(_maxOtdController.text.replaceAll(',', ''));
    await widget.onAdd(maxOtd);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = widget.listing;
    final user = widget.user;

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
                // Car row
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 80,
                        height: 60,
                        child: listing.media.primaryPhoto != null
                            ? Image.asset(
                                listing.media.primaryPhoto!,
                                fit: BoxFit.cover,
                              )
                            : Container(
                                color: colors.tile,
                                child: Icon(
                                  LucideIcons.imageOff,
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
                          Text(listing.shortTitle, style: text.cardTitle),
                          Text(
                            '${listing.milesFormatted} · ${_formatPrice(listing.price)}',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                Text('What Drevvy will do', style: text.title),
                const SizedBox(height: DrevvySpace.s3),
                
                _BulletPoint(
                  text: 'Ask Dealer A for their best itemized out-the-door price',
                ),
                _BulletPoint(
                  text: 'Keep going until you decide to accept or stop',
                ),
                _BulletPoint(
                  text: 'Only share your first name—never your phone or email',
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                // Max OTD field (optional)
                Text('Max out-the-door (optional)', style: text.callout),
                const SizedBox(height: DrevvySpace.s2),
                TextField(
                  controller: _maxOtdController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    prefixText: r'$ ',
                    hintText: 'e.g. ${widget.market.fairOtd}',
                    filled: true,
                    fillColor: colors.tile,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.s4,
                      vertical: DrevvySpace.s3,
                    ),
                  ),
                ),
                Text(
                  'Drevvy will try to get below this price',
                  style: text.callout.copyWith(color: colors.muted),
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                // CTA
                DrevvyPrimaryButton(
                  label: 'Find my best price',
                  onPressed: _isLoading ? null : _handleAdd,
                  isLoading: _isLoading,
                ),
                
                const SizedBox(height: DrevvySpace.s3),
                
                // Usage caption
                Center(
                  child: Text(
                    '${user.usage.used + 1} of ${user.usage.cap} cars · resets ${user.usage.resetsFormatted}',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
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

class _BulletPoint extends StatelessWidget {
  const _BulletPoint({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Icon(
              LucideIcons.check,
              size: 16,
              color: colors.mint,
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Text(text, style: textStyle.body),
          ),
        ],
      ),
    );
  }
}
