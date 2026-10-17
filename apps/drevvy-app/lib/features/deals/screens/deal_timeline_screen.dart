import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/deal.dart';
import '../../../data/models/money_format.dart';
import '../../../data/repositories/demo_repository.dart';

/// Per-dealership timeline: rounds, itemized price drops, and out-the-door price.
class DealTimelineScreen extends StatefulWidget {
  const DealTimelineScreen({super.key, required this.dealId});

  final String dealId;

  @override
  State<DealTimelineScreen> createState() => _DealTimelineScreenState();
}

class _DealTimelineScreenState extends State<DealTimelineScreen> {
  final _repo = DemoRepository.instance;
  Deal? _deal;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final deal = await _repo.getDealById(widget.dealId);
    if (!mounted) return;
    setState(() {
      _deal = deal;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          if (_isLoading || _deal == null)
            const Center(child: CircularProgressIndicator())
          else
            CustomScrollView(
              slivers: [
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
                  title: Text('Timeline', style: text.title),
                  centerTitle: true,
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    DrevvySpace.gutter,
                    DrevvySpace.s2,
                    DrevvySpace.gutter,
                    DrevvySpace.s8,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: DealTimelineView(deal: _deal!),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// The timeline body. Demo deals supply [Deal.dealerTimelines]; other deals
/// fall back to that deal's own offers.
class DealTimelineView extends StatelessWidget {
  const DealTimelineView({super.key, required this.deal});

  final Deal deal;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final timelines = deal.timelines;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(deal.listing.title, style: text.headline),
        const SizedBox(height: DrevvySpace.s2),
        StatusChip(deal.status),
        const SizedBox(height: DrevvySpace.s4),
        Text(
          'A transparency view of each dealership\'s written quotes. Itemized price drops stay here, and fees they removed stay crossed off.',
          style: text.callout.copyWith(color: colors.muted),
        ),
        const SizedBox(height: DrevvySpace.s6),
        for (var index = 0; index < timelines.length; index++) ...[
          if (index > 0) const SizedBox(height: DrevvySpace.s4),
          _DealerBlock(dealer: timelines[index]),
        ],
      ],
    );
  }
}

class _DealerBlock extends StatelessWidget {
  const _DealerBlock({required this.dealer});

  final DealerTimeline dealer;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final latest = dealer.latestOtd;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(dealer.label, style: text.title)),
              const SizedBox(width: DrevvySpace.s2),
              StatusChip(dealer.status),
            ],
          ),
          const SizedBox(height: DrevvySpace.s3),
          if (latest == null)
            Text(
              'No written quote yet. Drevvy is still waiting on an itemized out-the-door price.',
              style: text.callout.copyWith(color: colors.muted),
            )
          else ...[
            Text(formatUsd(latest), style: text.figureM),
            Text(
              'out the door',
              style: text.callout.copyWith(color: colors.muted),
            ),
            const SizedBox(height: DrevvySpace.s4),
            for (var index = 0; index < dealer.rounds.length; index++) ...[
              if (index > 0) Divider(height: DrevvySpace.s6, color: colors.line),
              _RoundBlock(
                round: dealer.rounds[index],
                previous: index == 0 ? null : dealer.rounds[index - 1],
                isLatest: index == dealer.rounds.length - 1,
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _RoundBlock extends StatelessWidget {
  const _RoundBlock({
    required this.round,
    required this.previous,
    required this.isLatest,
  });

  final DealerQuoteRound round;
  final DealerQuoteRound? previous;
  final bool isLatest;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final drop = previous == null ? null : previous!.otd - round.otd;
    final when = DateFormat('MMM d, h:mm a').format(round.receivedAt);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Round ${round.round}',
              style: text.label.copyWith(color: colors.muted),
            ),
            if (isLatest) ...[
              const SizedBox(width: DrevvySpace.s2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.lilacTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  'Latest',
                  style: text.micro.copyWith(color: colors.violet),
                ),
              ),
            ],
            const Spacer(),
            Text(when, style: text.micro.copyWith(color: colors.muted)),
          ],
        ),
        const SizedBox(height: DrevvySpace.s1),
        Text(formatUsd(round.otd), style: text.figureS),
        if (drop != null && drop != 0) ...[
          const SizedBox(height: DrevvySpace.s1),
          Text(
            drop > 0
                ? 'Down ${formatUsd(drop)} from the last round'
                : 'Up ${formatUsd(-drop)} from the last round',
            style: text.callout.copyWith(
              color: drop > 0 ? colors.mint : colors.sold,
            ),
          ),
        ],
        if (round.lines.isNotEmpty) ...[
          const SizedBox(height: DrevvySpace.s3),
          for (final line in round.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(line.key, style: text.body),
                        if (line.subLine != null)
                          Text(
                            line.subLine!,
                            style: text.callout.copyWith(color: colors.mint),
                          ),
                      ],
                    ),
                  ),
                  Text(formatUsd(line.amount), style: text.body),
                ],
              ),
            ),
        ],
        if (round.removedFees.isNotEmpty) ...[
          const SizedBox(height: DrevvySpace.s1),
          Text('Removed', style: text.label.copyWith(color: colors.muted)),
          const SizedBox(height: DrevvySpace.s2),
          for (final fee in round.removedFees)
            Padding(
              padding: const EdgeInsets.only(bottom: DrevvySpace.s1),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      fee.key,
                      style: text.body.copyWith(
                        color: colors.muted,
                        decoration: TextDecoration.lineThrough,
                        decorationColor: colors.strike,
                      ),
                    ),
                  ),
                  Text(
                    formatUsd(fee.amount),
                    style: text.body.copyWith(
                      color: colors.mint,
                      decoration: TextDecoration.lineThrough,
                      decorationColor: colors.strike,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}
