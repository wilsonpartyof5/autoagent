import 'package:flutter/material.dart';

import '../data/demo_desk.dart';
import '../theme/dealer_theme.dart';

class StageChip extends StatelessWidget {
  const StageChip({super.key, required this.stage});

  final ConversationStage stage;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (stage) {
      ConversationStage.newRequest => (DealerColors.lilacTint, DealerColors.lilac),
      ConversationStage.inConversation => (DealerColors.infoTint, DealerColors.info),
      ConversationStage.numbersShared => (DealerColors.honeyTint, DealerColors.honey),
      ConversationStage.closed => (DealerColors.closedTint, DealerColors.closed),
      ConversationStage.carSold => (DealerColors.soldTint, DealerColors.sold),
      ConversationStage.noReply => (DealerColors.endedTint, DealerColors.ended),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        stageLabels[stage]!,
        style: TextStyle(color: foreground, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class SlaText extends StatelessWidget {
  const SlaText({super.key, required this.sla});

  final SlaChip sla;

  @override
  Widget build(BuildContext context) {
    final color = switch (sla.tone) {
      SlaTone.waiting => DealerColors.honey,
      SlaTone.overdue => DealerColors.danger,
      SlaTone.replied => DealerColors.mint,
      SlaTone.ended => DealerColors.ended,
    };
    return Text(
      sla.label,
      style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700),
    );
  }
}

class StageStepper extends StatelessWidget {
  const StageStepper({super.key, required this.stage});

  final ConversationStage stage;

  @override
  Widget build(BuildContext context) {
    final ended = stageEnds.contains(stage);
    final currentIndex = stagePath.indexOf(stage);
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 4,
      children: [
        for (var index = 0; index < stagePath.length; index++) ...[
          if (index > 0)
            Text('→', style: TextStyle(color: DealerColors.mutedOf(context), fontSize: 11)),
          Text(
            stageLabels[stagePath[index]]!,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: !ended && stagePath[index] == stage
                  ? DealerColors.lilac
                  : !ended && currentIndex > index
                      ? DealerColors.inkOf(context)
                      : DealerColors.mutedOf(context),
            ),
          ),
        ],
        if (ended) ...[
          Text('·', style: TextStyle(color: DealerColors.mutedOf(context), fontSize: 11)),
          Text(
            stageLabels[stage]!,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: DealerColors.ended,
            ),
          ),
        ],
      ],
    );
  }
}

class PriceBlock extends StatelessWidget {
  const PriceBlock({super.key, required this.item});

  final InboxItem item;

  @override
  Widget build(BuildContext context) {
    final conversation = item.conversation;
    final stated = conversation.statedPriceCents;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          stated == null
              ? 'Advertised ${formatMoney(conversation.advertisedPriceCents)}'
              : 'Advertised ${formatMoney(conversation.advertisedPriceCents)} · Stated ${formatMoney(stated)}',
          style: TextStyle(color: DealerColors.mutedOf(context), fontSize: 12),
        ),
        if (item.priceDiffers)
          const Text(
            'Stated price differs from the advertised price.',
            style: TextStyle(color: DealerColors.honey, fontSize: 12, fontWeight: FontWeight.w700),
          ),
      ],
    );
  }
}
