import 'package:flutter/material.dart';

import '../data/demo_desk.dart';
import '../theme/dealer_theme.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  var _range = '7d';

  @override
  Widget build(BuildContext context) {
    final summary = analyticsSamples.firstWhere((item) => item.range == _range);
    final cards = [
      ('Reply rate', '${(summary.replyRate * 100).round()}%'),
      ('Median first reply', '${summary.medianFirstReplyMinutes} min'),
      ('Conversations started', '${summary.conversationsStarted}'),
      ('Conversations closed', '${summary.conversationsClosed}'),
      ('Numbers shared', '${summary.numbersShared}'),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        const SafeArea(
          bottom: false,
          child: Text('Analytics', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 6),
        const Text(
          'Sample counts for Demo Rooftop. Not live. Reply rate, time to first reply, conversations, and numbers shared.',
          style: TextStyle(color: DealerColors.muted, height: 1.4),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [
            for (final sample in analyticsSamples)
              ChoiceChip(
                label: Text(sample.rangeLabel),
                selected: sample.range == _range,
                onSelected: (_) => setState(() => _range = sample.range),
              ),
          ],
        ),
        const SizedBox(height: 16),
        for (final card in cards)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: DealerColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: DealerColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(card.$1, style: const TextStyle(color: DealerColors.muted, fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(card.$2, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
      ],
    );
  }
}
