import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// Off-network CTA: free request for the whole price.
/// Not chat, no key, and copy never says "talk to dealer".
class OtdRequestSheet extends StatefulWidget {
  const OtdRequestSheet({
    super.key,
    required this.listing,
    required this.alreadyRequested,
    required this.onConfirm,
  });

  final Listing listing;
  final bool alreadyRequested;
  final Future<void> Function({String? note}) onConfirm;

  @override
  State<OtdRequestSheet> createState() => _OtdRequestSheetState();
}

class _OtdRequestSheetState extends State<OtdRequestSheet> {
  final _note = TextEditingController();
  bool _isLoading = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('otd_request', {
      'listing_id': widget.listing.id,
    });
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() => _isLoading = true);
    final note = _note.text.trim();
    await widget.onConfirm(note: note.isEmpty ? null : note);
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _done = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final already = widget.alreadyRequested || _done;

    return Container(
      decoration: BoxDecoration(
        // GLASS STUB: Design glass asset pending; use token fill.
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          KeySpend.otdRequestCta,
                          style: text.headline,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: colors.mintTint,
                          borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                        ),
                        child: Text(
                          KeySpend.otdRequestFreeBadge,
                          style: text.label.copyWith(
                            color: colors.mint,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s2),
                  Text(
                    widget.listing.shortTitle,
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                  const SizedBox(height: DrevvySpace.s4),
                  Text(
                    already
                        ? 'We already have this request on file. No chat is opened and no key was used.'
                        : KeySpend.otdRequestNote,
                    style: text.body.copyWith(color: colors.muted),
                  ),
                  if (!already) ...[
                    const SizedBox(height: DrevvySpace.s4),
                    TextField(
                      controller: _note,
                      minLines: 2,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: 'Anything we should know about this listing? (optional)',
                        hintStyle: text.body.copyWith(color: colors.placeholder),
                        filled: true,
                        fillColor: colors.tile,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(DrevvyRadius.md),
                          borderSide: BorderSide(color: colors.line),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(DrevvyRadius.md),
                          borderSide: BorderSide(color: colors.line),
                        ),
                      ),
                    ),
                    const SizedBox(height: DrevvySpace.s4),
                    DrevvyPrimaryButton(
                      label: 'Submit request',
                      onPressed: _isLoading ? null : _confirm,
                      isLoading: _isLoading,
                    ),
                    const SizedBox(height: DrevvySpace.s3),
                    Row(
                      children: [
                        Icon(LucideIcons.info, size: 16, color: colors.muted),
                        const SizedBox(width: DrevvySpace.s2),
                        Expanded(
                          child: Text(
                            'This rooftop is not on Drevvy, so there is no inbox thread and no key.',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ),
                      ],
                    ),
                  ] else
                    DrevvyButton(
                      label: 'Done',
                      onPressed: () => Navigator.of(context).pop(true),
                      isFullWidth: true,
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
