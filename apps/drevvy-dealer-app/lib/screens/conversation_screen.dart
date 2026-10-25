import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/demo_desk.dart';
import '../desk_scope.dart';
import '../theme/dealer_theme.dart';
import '../widgets/primary_button.dart';
import '../widgets/stage_widgets.dart';

class ConversationScreen extends StatefulWidget {
  const ConversationScreen({super.key, required this.id});

  final String id;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _draft = TextEditingController();
  final _stated = TextEditingController();
  final _otd = TextEditingController();
  final _note = TextEditingController();
  var _showNumbers = false;
  var _confirmSold = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _draft.addListener(_onDraft);
  }

  void _onDraft() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _draft.removeListener(_onDraft);
    _draft.dispose();
    _stated.dispose();
    _otd.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final desk = DeskScope.of(context);
    final conversation = desk.conversation(widget.id);
    if (conversation == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackButton()),
        body: const Center(child: Text('That conversation is not in the demo.')),
      );
    }
    final open = isOpenStage(conversation.stage);
    final item = InboxItem(
      conversation: conversation,
      needsReply: conversationNeedsReply(conversation),
      snippet: snippetOf(conversation),
      sla: slaFor(conversation, desk.now),
      priceDiffers: pricesDiffer(
        conversation.advertisedPriceCents,
        conversation.statedPriceCents,
      ),
    );

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: const Text('Conversation', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            color: DealerColors.card,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      Conversation.buyerLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                        color: DealerColors.muted,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        conversation.shopperRef,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                    ),
                    StageChip(stage: conversation.stage),
                  ],
                ),
                const SizedBox(height: 4),
                SlaText(sla: item.sla),
                const SizedBox(height: 8),
                Text(conversation.vehicle.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(
                  'Stock #${conversation.stockNumber}',
                  style: const TextStyle(color: DealerColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 4),
                PriceBlock(item: item),
                const SizedBox(height: 8),
                StageStepper(stage: conversation.stage),
                const SizedBox(height: 8),
                const Text(
                  'Templated Get Best Price opener, then freeform chat. Share numbers is informational. No text, email, or call.',
                  style: TextStyle(color: DealerColors.muted, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: conversation.messages.length,
              itemBuilder: (context, index) {
                final message = conversation.messages[index];
                if (message.kind == MessageKind.numbers) {
                  return Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: DealerColors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: DealerColors.line),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 4,
                          decoration: const BoxDecoration(gradient: DealerColors.brandGradient),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Share numbers · Informational card',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: DealerColors.muted,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(message.body, style: const TextStyle(height: 1.35)),
                              const SizedBox(height: 8),
                              const Text(
                                'Informational for this anonymous shopper. Not a binding offer.',
                                style: TextStyle(fontSize: 11, color: DealerColors.muted, height: 1.35),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }
                final mine = message.author == MessageAuthor.salesperson;
                return Align(
                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    constraints: const BoxConstraints(maxWidth: 320),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: mine ? DealerColors.brandGradient : null,
                      color: mine ? null : DealerColors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: mine ? null : Border.all(color: DealerColors.line),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          mine
                              ? 'You'
                              : message.author == MessageAuthor.drevvy
                                  ? 'Drevvy · Templated opener'
                                  : conversation.shopperRef,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: mine ? Colors.white70 : DealerColors.muted,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          message.body,
                          style: TextStyle(
                            color: mine ? Colors.white : DealerColors.ink,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            color: DealerColors.card,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_confirmSold && open) _soldConfirm(desk, conversation),
                if (_showNumbers && open) _numbersCard(desk, conversation),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final template in replyTemplatesFor(conversation))
                      ActionChip(
                        label: Text(template.label),
                        onPressed: () => setState(() => _draft.text = template.text),
                      ),
                    ActionChip(
                      label: const Text('Share numbers'),
                      onPressed: open
                          ? () => setState(() {
                                _confirmSold = false;
                                _showNumbers = !_showNumbers;
                              })
                          : null,
                    ),
                    ActionChip(
                      label: const Text('Mark as sold'),
                      onPressed: open
                          ? () => setState(() {
                                _showNumbers = false;
                                _confirmSold = !_confirmSold;
                              })
                          : null,
                    ),
                  ],
                ),
                if (!open)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Closed conversations stay closed in this demo. You can still reply in the thread.',
                      style: TextStyle(color: DealerColors.muted, fontSize: 12),
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: DealerColors.danger, fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        key: const Key('chat-composer'),
                        controller: _draft,
                        minLines: 2,
                        maxLines: 4,
                        decoration: const InputDecoration(hintText: 'Reply in this chat'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 96,
                      child: PrimaryButton(
                        buttonKey: const Key('send-message'),
                        label: 'Send',
                        onPressed: _draft.text.trim().isEmpty
                            ? null
                            : () {
                                final error = desk.sendMessage(conversation.id, _draft.text);
                                if (error == null) _draft.clear();
                                setState(() => _error = _errorCopy(error));
                              },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _soldConfirm(DealerDesk desk, Conversation conversation) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DealerColors.canvas,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: DealerColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Mark as sold', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text(
            markSoldConfirm,
            style: TextStyle(color: DealerColors.muted, fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  label: 'Mark sold',
                  onPressed: () {
                    final error = desk.markSold(conversation.id);
                    setState(() {
                      _error = _errorCopy(error);
                      if (error == null) _confirmSold = false;
                    });
                  },
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => setState(() => _confirmSold = false),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _numbersCard(DealerDesk desk, Conversation conversation) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: DealerColors.canvas,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: DealerColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 4,
            decoration: const BoxDecoration(gradient: DealerColors.brandGradient),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Share numbers', style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                const Text(
                  '$shareNumbersDisclaimer Where a written total becomes the record is still an open question.',
                  style: TextStyle(color: DealerColors.muted, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 8),
                Text(
                  'Advertised ${formatMoney(conversation.advertisedPriceCents)}',
                  style: const TextStyle(color: DealerColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 8),
                const Text('Price you state', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                TextField(
                  controller: _stated,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(hintText: '35400'),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Written out-the-door total (optional)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                TextField(
                  controller: _otd,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(hintText: '38950'),
                ),
                const SizedBox(height: 8),
                const Text('Note (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                TextField(controller: _note, minLines: 1, maxLines: 3),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () {
                    final stated = dollarsToCents(_stated.text);
                    if (stated == null) {
                      setState(() => _error = 'Enter a price in dollars, at least \$1.');
                      return;
                    }
                    int? written;
                    if (_otd.text.trim().isNotEmpty) {
                      written = dollarsToCents(_otd.text);
                      if (written == null) {
                        setState(() => _error = 'Enter a price in dollars, at least \$1.');
                        return;
                      }
                    }
                    final error = desk.shareNumbers(
                      id: conversation.id,
                      statedPriceCents: stated,
                      writtenOtdCents: written,
                      note: _note.text,
                    );
                    setState(() {
                      _error = _errorCopy(error);
                      if (error == null) {
                        _stated.clear();
                        _otd.clear();
                        _note.clear();
                        _showNumbers = false;
                      }
                    });
                  },
                  child: const Text('Share in chat'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String? _errorCopy(String? code) {
  return switch (code) {
    null => null,
    'empty_message' => 'Write a message first.',
    'message_too_long' => 'That message is too long for this demo.',
    'invalid_price' => 'Enter a price in dollars, at least \$1.',
    'conversation_closed' => 'Closed conversations stay closed in this demo.',
    _ => 'That conversation is not in the demo.',
  };
}
