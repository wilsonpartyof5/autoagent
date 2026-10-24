import 'package:drevvy_dealer_app/data/demo_desk.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime.utc(2026, 10, 24, 15);

  test('needs-reply inbox hides contact details and flags a stated price', () {
    final desk = DealerDesk(now: now);
    final needs = desk.inbox(InboxFilter.needsReply);
    expect(needs.map((item) => item.conversation.id), ['conv_rav4', 'conv_f150']);
    expect(shopperDisplayName(needs.first.conversation.shopperFirstName), 'Alex');
    expect(needs.first.sla.label, '20m left');
    expect(needs[1].sla.label, '12m over');
    expect(needs[1].conversation.shopperFirstName, isNull);

    final tucson = desk.inbox(InboxFilter.allOpen).firstWhere((item) => item.conversation.id == 'conv_tucson');
    expect(tucson.priceDiffers, isTrue);
    expect(tucson.sla.label, 'Replied in 35m');

    final closed = desk.inbox(InboxFilter.closed);
    expect(closed.map((item) => item.conversation.stage), [
      ConversationStage.carSold,
      ConversationStage.closed,
      ConversationStage.noReply,
    ]);
    expect(
      closed.firstWhere((item) => item.conversation.id == 'conv_tahoe').sla.label,
      'No reply yet',
    );

    final encoded = needs.map((item) => item.snippet).join(' ');
    expect(encoded.contains('@'), isFalse);
    expect(encoded.toLowerCase().contains('negotiat'), isFalse);
  });

  test('a reply starts the conversation and share numbers stays informational', () {
    final desk = DealerDesk(now: now);
    expect(desk.sendMessage('conv_rav4', '  Yes, stock #R44118 is still here.  '), isNull);
    final rav4 = desk.conversation('conv_rav4')!;
    expect(rav4.stage, ConversationStage.inConversation);
    expect(conversationNeedsReply(rav4), isFalse);

    expect(
      desk.shareNumbers(
        id: 'conv_f150',
        statedPriceCents: 4050000,
        writtenOtdCents: 4420000,
        note: 'Informational total only.',
      ),
      isNull,
    );
    final truck = desk.conversation('conv_f150')!;
    expect(truck.stage, ConversationStage.numbersShared);
    expect(truck.messages.last.body.contains('not a binding offer'), isTrue);
    expect(desk.shareNumbers(id: 'conv_outback', statedPriceCents: 2844000, writtenOtdCents: null, note: ''), 'conversation_closed');
    expect(dollarsToCents(r'$35,400.50'), 3540050);
    expect(dollarsToCents('0'), isNull);
  });
}
