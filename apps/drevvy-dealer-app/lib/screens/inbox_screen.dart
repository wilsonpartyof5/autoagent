import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/demo_desk.dart';
import '../desk_scope.dart';
import '../theme/dealer_theme.dart';
import '../widgets/stage_widgets.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  var _filter = InboxFilter.needsReply;

  @override
  Widget build(BuildContext context) {
    final desk = DeskScope.of(context);
    final items = desk.inbox(_filter);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Inbox', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  'First name + conversation ref only. Never phone, email, or address.',
                  style: TextStyle(color: DealerColors.mutedOf(context), fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Wrap(
            spacing: 8,
            children: [
              for (final filter in const [
                InboxFilter.needsReply,
                InboxFilter.inChat,
                InboxFilter.all,
              ])
                _FilterChip(
                  label: _filterLabel(filter),
                  count: desk.inbox(filter).length,
                  selected: filter == _filter,
                  onTap: () => setState(() => _filter = filter),
                ),
            ],
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? Center(
                  child: Text(
                    'Nothing in this filter.',
                    style: TextStyle(color: DealerColors.mutedOf(context)),
                  ),
                )
              : ListView.separated(
                  itemCount: items.length,
                  separatorBuilder: (context, index) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    final conversation = item.conversation;
                    return InkWell(
                      onTap: () => context.push('/conversations/${conversation.id}'),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  conversation.deskLabel,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                ),
                                const Spacer(),
                                SlaText(sla: item.sla),
                              ],
                            ),
                            Text(conversation.vehicle.title),
                            Text(
                              'Stock #${conversation.stockNumber}',
                              style: TextStyle(color: DealerColors.mutedOf(context), fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            PriceBlock(item: item),
                            const SizedBox(height: 6),
                            StageChip(stage: conversation.stage),
                            const SizedBox(height: 6),
                            Text(
                              item.snippet,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: DealerColors.mutedOf(context)),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

String _filterLabel(InboxFilter filter) {
  return switch (filter) {
    InboxFilter.needsReply => 'Needs reply',
    InboxFilter.inChat => 'In chat',
    InboxFilter.all => 'All',
    InboxFilter.allOpen => 'All open',
    InboxFilter.closed => 'Closed',
  };
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? DealerColors.violet : DealerColors.cardOf(context),
      shape: StadiumBorder(
        side: BorderSide(color: selected ? DealerColors.inkOf(context) : DealerColors.lineOf(context)),
      ),
      child: InkWell(
        onTap: onTap,
        customBorder: const StadiumBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Text(
            '$label $count',
            style: TextStyle(
              color: selected ? Colors.white : DealerColors.inkOf(context),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
