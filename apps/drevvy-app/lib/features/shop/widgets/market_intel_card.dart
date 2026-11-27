import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';
import 'market_intel_gate.dart';

/// Fair-price card. The score line is the signal. Color is only extra.
class MarketIntelCard extends StatelessWidget {
  const MarketIntelCard({
    super.key,
    required this.unlocked,
    required this.onUnlock,
    this.brief,
    this.failed = false,
    this.askingPrice,
    this.isNew = false,
    this.model,
    this.failureMessage,
    this.failureAction,
    this.onRecheck,
  });

  final MarketIntelBrief? brief;
  final bool unlocked;
  final bool failed;
  final VoidCallback onUnlock;
  final int? askingPrice;
  final bool isNew;
  final String? model;
  final String? failureMessage;
  final String? failureAction;
  final VoidCallback? onRecheck;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final title = isNew ? 'Typical asking price' : 'Fair price';
    final count = brief?.similarCount;
    final modelName = (model ?? '').trim();
    final subline = isNew && count != null && count > 0 && modelName.isNotEmpty
        ? 'From $count new ${modelName}s for sale near you.'
        : null;
    if (failed && !unlocked) {
      final action = failureAction ?? KeySpend.marketIntelCheckAgain;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: text.label.copyWith(color: colors.muted)),
          const SizedBox(height: DrevvySpace.s2),
          GlassCard(
            padding: const EdgeInsets.all(DrevvySpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  failureMessage ?? KeySpend.marketIntelNotConfirmed,
                  style: text.body,
                ),
                const SizedBox(height: DrevvySpace.s3),
                DrevvyPrimaryButton(
                  label: action,
                  onPressed: action == KeySpend.marketIntelRetry
                      ? onUnlock
                      : (onRecheck ?? onUnlock),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: text.label.copyWith(color: colors.muted)),
        if (subline != null) ...[
          const SizedBox(height: DrevvySpace.s1),
          Text(subline, style: text.callout.copyWith(color: colors.muted)),
        ],
        const SizedBox(height: DrevvySpace.s2),
        MarketIntelGate(
          unlocked: unlocked,
          onUnlock: onUnlock,
          teaser: isNew ? KeySpend.typicalPriceTeaser : KeySpend.marketIntelTeaser,
          child: _CardBody(brief: brief, askingPrice: askingPrice),
        ),
      ],
    );
  }
}

class _CardBody extends StatelessWidget {
  const _CardBody({required this.brief, required this.askingPrice});

  final MarketIntelBrief? brief;
  final int? askingPrice;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;
    final lines = brief?.shownLines ?? const <MarketIntelLine>[];
    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (brief?.verdict != null) ...[
            _ScoreBadge(tone: brief?.verdictTone, label: brief!.verdict!),
            if (brief?.fairPriceLine != null) ...[
              const SizedBox(height: DrevvySpace.s2),
              Text(brief!.fairPriceLine!, style: text.body),
            ],
            if (brief!.showsRange) ...[
              const SizedBox(height: DrevvySpace.s3),
              _RangeBar(
                low: brief!.rangeLow!,
                high: brief!.rangeHigh!,
                asking: brief!.askingPrice ?? askingPrice,
              ),
            ],
          ],
          for (final line in lines)
            if (line.key != 'deal_score')
              _LineRow(
                line: line,
                cheaper: line.key == 'cheaper_nearby' ? brief!.cheaper : const [],
                cheaperCount: brief?.cheaperCount ?? 0,
              ),
        ],
      ),
    );
  }
}

class _ScoreBadge extends StatelessWidget {
  const _ScoreBadge({required this.label, this.tone});

  final String label;
  final String? tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final icon = switch (tone) {
      'good' => LucideIcons.circleCheck,
      'caution' => LucideIcons.arrowUp,
      _ => LucideIcons.equal,
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: DrevvySpace.s3,
          vertical: DrevvySpace.s3,
        ),
        child: Row(
          children: [
            Icon(icon, size: 22, color: colors.ink),
            const SizedBox(width: DrevvySpace.s2),
            Expanded(
              child: Text(
                label,
                style: text.title.copyWith(color: colors.ink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RangeBar extends StatelessWidget {
  const _RangeBar({required this.low, required this.high, this.asking});

  final int low;
  final int high;
  final int? asking;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final span = (high - low).toDouble();
    final pin = asking == null
        ? 0.5
        : ((asking! - low) / span).clamp(0.0, 1.0);
    final askingLabel = asking == null ? '' : ' This car ${_money(asking!)}.';
    return Semantics(
      label: 'Most cars like this: ${_money(low)} to ${_money(high)}.$askingLabel',
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          return SizedBox(
            height: 18,
            child: Stack(
              alignment: Alignment.centerLeft,
              children: [
                Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: colors.line,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                Positioned(
                  left: (width * pin - 6).clamp(0.0, width - 12),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: colors.ink,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({
    required this.line,
    required this.cheaper,
    required this.cheaperCount,
  });

  final MarketIntelLine line;
  final List<CheaperCar> cheaper;
  final int cheaperCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final tappable = line.key == 'cheaper_nearby';
    final body = Padding(
      padding: const EdgeInsets.symmetric(vertical: DrevvySpace.s3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.title, style: text.bodyStrong),
                const SizedBox(height: 2),
                Text(line.text!, style: text.callout),
                if (line.detail != null && line.detail!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(line.detail!, style: text.callout.copyWith(color: colors.ink)),
                ],
              ],
            ),
          ),
          if (tappable)
            Icon(LucideIcons.chevronRight, size: 18, color: colors.muted),
        ],
      ),
    );
    return Column(
      children: [
        Divider(height: 1, color: colors.line),
        if (tappable)
          Semantics(
            button: true,
            label: 'See $cheaperCount cheaper cars like this',
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44),
              child: InkWell(
                onTap: () => _openCheaper(context),
                child: body,
              ),
            ),
          )
        else
          body,
      ],
    );
  }

  void _openCheaper(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final text = context.drevvyText;
        final colors = context.drevvy;
        return SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              DrevvySpace.s4,
              0,
              DrevvySpace.s4,
              DrevvySpace.s4,
            ),
            children: [
              Text('Cheaper cars like this', style: text.title),
              const SizedBox(height: DrevvySpace.s3),
              if (cheaper.isEmpty)
                Text('None cheaper in this search.', style: text.body)
              else
                for (final car in cheaper)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: DrevvySpace.s2),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${car.name} · ${_miles(car.miles)} · ${_away(car.distance)}',
                            style: text.callout,
                          ),
                        ),
                        Text(_money(car.price ?? 0), style: text.bodyStrong),
                      ],
                    ),
                  ),
              const SizedBox(height: DrevvySpace.s3),
              Text(
                'These are listed prices, not the whole price.',
                style: text.callout.copyWith(color: colors.ink),
              ),
            ],
          ),
        );
      },
    );
  }
}

String _money(int dollars) => NumberFormat.simpleCurrency(decimalDigits: 0).format(dollars);

String _miles(int? miles) => miles == null ? 'miles unknown' : '${NumberFormat('#,###').format(miles)} mi';

String _away(double? miles) {
  if (miles == null) return 'distance unknown';
  final rounded = miles.round();
  return '$rounded mi away';
}
