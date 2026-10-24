import 'package:flutter/foundation.dart';

/// Local copy of the web demo in `apps/drevvy-backend/src/lib/dealer/mock.ts`.
/// No shopper phone, email, or address.

enum ConversationStage {
  newRequest,
  inConversation,
  numbersShared,
  closed,
  carSold,
  noReply,
}

enum InboxFilter { needsReply, allOpen, closed }

enum MessageAuthor { shopper, salesperson }

enum SlaTone { waiting, overdue, replied, ended }

class VehicleSummary {
  const VehicleSummary({
    required this.year,
    required this.make,
    required this.model,
    required this.trim,
  });

  final int year;
  final String make;
  final String model;
  final String trim;

  String get title => '$year $make $model $trim';
}

class ThreadMessage {
  ThreadMessage({
    required this.id,
    required this.author,
    required this.body,
    required this.sentAt,
  });

  final String id;
  final MessageAuthor author;
  final String body;
  final DateTime sentAt;
}

class Conversation {
  Conversation({
    required this.id,
    required this.shopperFirstName,
    required this.stage,
    required this.vehicle,
    required this.stockNumber,
    required this.advertisedPriceCents,
    required this.statedPriceCents,
    required this.writtenOtdCents,
    required this.openedAt,
    required this.firstReplyAt,
    required this.replyDueAt,
    required this.messages,
  });

  final String id;
  final String? shopperFirstName;
  ConversationStage stage;
  final VehicleSummary vehicle;
  final String stockNumber;
  final int advertisedPriceCents;
  int? statedPriceCents;
  int? writtenOtdCents;
  final DateTime openedAt;
  DateTime? firstReplyAt;
  final DateTime replyDueAt;
  final List<ThreadMessage> messages;

  static const buyerLabel = 'Buyer via Drevvy';
}

class SlaChip {
  const SlaChip(this.label, this.tone);
  final String label;
  final SlaTone tone;
}

class ReplyTemplate {
  const ReplyTemplate(this.id, this.label, this.text);
  final String id;
  final String label;
  final String text;
}

class InboxItem {
  const InboxItem({
    required this.conversation,
    required this.needsReply,
    required this.snippet,
    required this.sla,
    required this.priceDiffers,
  });

  final Conversation conversation;
  final bool needsReply;
  final String snippet;
  final SlaChip sla;
  final bool priceDiffers;
}

const shareNumbersDisclaimer =
    'Informational for this anonymous shopper. Not a binding offer.';

const demoRooftopName = 'Demo Rooftop';
const demoDocFeeDollars = 499;

const stageLabels = {
  ConversationStage.newRequest: 'New request',
  ConversationStage.inConversation: 'In conversation',
  ConversationStage.numbersShared: 'Numbers shared',
  ConversationStage.closed: 'Closed',
  ConversationStage.carSold: 'Car sold',
  ConversationStage.noReply: 'No reply',
};

const stagePath = [
  ConversationStage.newRequest,
  ConversationStage.inConversation,
  ConversationStage.numbersShared,
];

const stageEnds = [
  ConversationStage.closed,
  ConversationStage.carSold,
  ConversationStage.noReply,
];

bool isOpenStage(ConversationStage stage) {
  return stage == ConversationStage.newRequest ||
      stage == ConversationStage.inConversation ||
      stage == ConversationStage.numbersShared;
}

String shopperDisplayName(String? firstName) {
  final trimmed = firstName?.trim() ?? '';
  return trimmed.isEmpty ? 'Anonymous shopper' : trimmed;
}

String formatMoney(int cents) {
  final negative = cents < 0;
  final absolute = cents.abs();
  final dollars = absolute ~/ 100;
  final remainder = absolute % 100;
  final digits = dollars.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  final sign = negative ? '-' : '';
  if (remainder == 0) return '$sign\$$buffer';
  return '$sign\$$buffer.${remainder.toString().padLeft(2, '0')}';
}

String formatDuration(int minutes) {
  final rounded = minutes < 0 ? 0 : minutes;
  if (rounded < 60) return '${rounded}m';
  final hours = (rounded / 60).round();
  if (hours < 48) return '${hours}h';
  return '${(hours / 24).round()}d';
}

bool conversationNeedsReply(Conversation conversation) {
  if (!isOpenStage(conversation.stage)) return false;
  if (conversation.messages.isEmpty) return false;
  return conversation.messages.last.author == MessageAuthor.shopper;
}

bool pricesDiffer(int advertised, int? stated) {
  return stated != null && stated != advertised;
}

String snippetOf(Conversation conversation) {
  if (conversation.messages.isEmpty) return '';
  final flat = conversation.messages.last.body.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (flat.length <= 140) return flat;
  return '${flat.substring(0, 139)}…';
}

SlaChip slaFor(Conversation conversation, DateTime now) {
  if (!conversationNeedsReply(conversation) && conversation.firstReplyAt != null) {
    final minutes = conversation.firstReplyAt!
            .difference(conversation.openedAt)
            .inMinutes;
    return SlaChip('Replied in ${formatDuration(minutes)}', SlaTone.replied);
  }
  if (!conversationNeedsReply(conversation)) {
    return const SlaChip('No reply yet', SlaTone.ended);
  }
  final delta = conversation.replyDueAt.difference(now).inMinutes;
  if (delta >= 0) {
    return SlaChip('${formatDuration(delta)} left', SlaTone.waiting);
  }
  return SlaChip('${formatDuration(-delta)} over', SlaTone.overdue);
}

List<ReplyTemplate> replyTemplatesFor(Conversation conversation) {
  return [
    ReplyTemplate(
      'available',
      'Still available',
      'Yes, stock #${conversation.stockNumber} is still here.',
    ),
    ReplyTemplate(
      'sold',
      'Car sold',
      'Stock #${conversation.stockNumber} has sold.',
    ),
    ReplyTemplate(
      'advertised',
      'Advertised price',
      'The advertised price is ${formatMoney(conversation.advertisedPriceCents)}. I can share a written out-the-door total in this chat.',
    ),
  ];
}

String numbersShareBody({
  required int advertisedPriceCents,
  required int statedPriceCents,
  required int? writtenOtdCents,
  required String note,
}) {
  final lines = [
    'Shared numbers in this chat. Informational, not a binding offer.',
    'Advertised price: ${formatMoney(advertisedPriceCents)}',
    'Price I state: ${formatMoney(statedPriceCents)}',
  ];
  if (writtenOtdCents != null) {
    lines.add('Written out-the-door total: ${formatMoney(writtenOtdCents)}');
  }
  final trimmed = note.trim();
  if (trimmed.isNotEmpty) lines.add(trimmed);
  return lines.join('\n');
}

DateTime _at(DateTime now, int minutes) => now.add(Duration(minutes: minutes));

List<Conversation> buildSeed(DateTime now) {
  const tucsonAdvertised = 3618000;
  const tucsonStated = 3540000;
  const tucsonOtd = 3895000;
  final tucsonOpened = _at(now, -26 * 60);
  return [
    Conversation(
      id: 'conv_rav4',
      shopperFirstName: 'Alex',
      stage: ConversationStage.newRequest,
      vehicle: const VehicleSummary(
        year: 2024,
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE Premium',
      ),
      stockNumber: 'R44118',
      advertisedPriceCents: 3324000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: _at(now, -40),
      firstReplyAt: null,
      replyDueAt: _at(now, 20),
      messages: [
        ThreadMessage(
          id: 'rav4-1',
          author: MessageAuthor.shopper,
          body: 'Is stock #R44118 still available?',
          sentAt: _at(now, -40),
        ),
      ],
    ),
    Conversation(
      id: 'conv_f150',
      shopperFirstName: null,
      stage: ConversationStage.inConversation,
      vehicle: const VehicleSummary(year: 2023, make: 'Ford', model: 'F-150', trim: 'XLT'),
      stockNumber: 'F31802',
      advertisedPriceCents: 4150000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: _at(now, -180),
      firstReplyAt: _at(now, -150),
      replyDueAt: _at(now, -12),
      messages: [
        ThreadMessage(
          id: 'f150-1',
          author: MessageAuthor.shopper,
          body: 'Is stock #F31802 still on the lot?',
          sentAt: _at(now, -180),
        ),
        ThreadMessage(
          id: 'f150-2',
          author: MessageAuthor.salesperson,
          body: 'Yes, that truck is here.',
          sentAt: _at(now, -150),
        ),
        ThreadMessage(
          id: 'f150-3',
          author: MessageAuthor.shopper,
          body:
              'Can you share the advertised price and a written out-the-door total in this chat?',
          sentAt: _at(now, -20),
        ),
      ],
    ),
    Conversation(
      id: 'conv_tucson',
      shopperFirstName: 'Jordan',
      stage: ConversationStage.numbersShared,
      vehicle: const VehicleSummary(
        year: 2025,
        make: 'Hyundai',
        model: 'Tucson',
        trim: 'Limited',
      ),
      stockNumber: 'T55290',
      advertisedPriceCents: tucsonAdvertised,
      statedPriceCents: tucsonStated,
      writtenOtdCents: tucsonOtd,
      openedAt: tucsonOpened,
      firstReplyAt: _at(now, -26 * 60 + 35),
      replyDueAt: _at(now, 120),
      messages: [
        ThreadMessage(
          id: 'tucson-1',
          author: MessageAuthor.shopper,
          body: 'Is stock #T55290 available?',
          sentAt: tucsonOpened,
        ),
        ThreadMessage(
          id: 'tucson-2',
          author: MessageAuthor.salesperson,
          body: 'Yes. I can share numbers here.',
          sentAt: _at(now, -26 * 60 + 35),
        ),
        ThreadMessage(
          id: 'tucson-3',
          author: MessageAuthor.salesperson,
          body: numbersShareBody(
            advertisedPriceCents: tucsonAdvertised,
            statedPriceCents: tucsonStated,
            writtenOtdCents: tucsonOtd,
            note: 'Written total includes the doc fee I usually use at this rooftop.',
          ),
          sentAt: _at(now, -20 * 60),
        ),
      ],
    ),
    Conversation(
      id: 'conv_sportage',
      shopperFirstName: 'Riley',
      stage: ConversationStage.carSold,
      vehicle: const VehicleSummary(year: 2024, make: 'Kia', model: 'Sportage', trim: 'SX'),
      stockNumber: 'K44901',
      advertisedPriceCents: 3129000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: _at(now, -2 * 24 * 60),
      firstReplyAt: _at(now, -2 * 24 * 60 + 18),
      replyDueAt: _at(now, -2 * 24 * 60 + 60),
      messages: [
        ThreadMessage(
          id: 'sportage-1',
          author: MessageAuthor.shopper,
          body: 'Is stock #K44901 still available?',
          sentAt: _at(now, -2 * 24 * 60),
        ),
        ThreadMessage(
          id: 'sportage-2',
          author: MessageAuthor.salesperson,
          body: 'That Sportage has sold.',
          sentAt: _at(now, -2 * 24 * 60 + 18),
        ),
      ],
    ),
    Conversation(
      id: 'conv_outback',
      shopperFirstName: null,
      stage: ConversationStage.closed,
      vehicle: const VehicleSummary(
        year: 2022,
        make: 'Subaru',
        model: 'Outback',
        trim: 'Limited',
      ),
      stockNumber: 'S22014',
      advertisedPriceCents: 2844000,
      statedPriceCents: 2844000,
      writtenOtdCents: 3102000,
      openedAt: _at(now, -3 * 24 * 60),
      firstReplyAt: _at(now, -3 * 24 * 60 + 12),
      replyDueAt: _at(now, -3 * 24 * 60 + 60),
      messages: [
        ThreadMessage(
          id: 'outback-1',
          author: MessageAuthor.shopper,
          body: 'Is stock #S22014 available?',
          sentAt: _at(now, -3 * 24 * 60),
        ),
        ThreadMessage(
          id: 'outback-2',
          author: MessageAuthor.salesperson,
          body: 'Yes, it is here.',
          sentAt: _at(now, -3 * 24 * 60 + 12),
        ),
        ThreadMessage(
          id: 'outback-3',
          author: MessageAuthor.shopper,
          body: 'Thanks, that is what I needed for now.',
          sentAt: _at(now, -3 * 24 * 60 + 40),
        ),
        ThreadMessage(
          id: 'outback-4',
          author: MessageAuthor.salesperson,
          body: 'Glad we could talk here. I will leave this conversation closed.',
          sentAt: _at(now, -3 * 24 * 60 + 48),
        ),
      ],
    ),
    Conversation(
      id: 'conv_tahoe',
      shopperFirstName: null,
      stage: ConversationStage.noReply,
      vehicle: const VehicleSummary(
        year: 2021,
        make: 'Chevrolet',
        model: 'Tahoe',
        trim: 'LT',
      ),
      stockNumber: 'C19077',
      advertisedPriceCents: 4680000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: _at(now, -5 * 24 * 60),
      firstReplyAt: null,
      replyDueAt: _at(now, -5 * 24 * 60 + 30),
      messages: [
        ThreadMessage(
          id: 'tahoe-1',
          author: MessageAuthor.shopper,
          body: 'Is stock #C19077 still available?',
          sentAt: _at(now, -5 * 24 * 60),
        ),
      ],
    ),
  ];
}

class AnalyticsSummary {
  const AnalyticsSummary({
    required this.range,
    required this.rangeLabel,
    required this.replyRate,
    required this.medianFirstReplyMinutes,
    required this.conversationsStarted,
    required this.conversationsClosed,
    required this.numbersShared,
  });

  final String range;
  final String rangeLabel;
  final double replyRate;
  final int medianFirstReplyMinutes;
  final int conversationsStarted;
  final int conversationsClosed;
  final int numbersShared;
}

const analyticsSamples = [
  AnalyticsSummary(
    range: '7d',
    rangeLabel: '7 days',
    replyRate: 0.82,
    medianFirstReplyMinutes: 16,
    conversationsStarted: 11,
    conversationsClosed: 4,
    numbersShared: 6,
  ),
  AnalyticsSummary(
    range: '30d',
    rangeLabel: '30 days',
    replyRate: 0.76,
    medianFirstReplyMinutes: 21,
    conversationsStarted: 38,
    conversationsClosed: 17,
    numbersShared: 22,
  ),
  AnalyticsSummary(
    range: '90d',
    rangeLabel: '90 days',
    replyRate: 0.71,
    medianFirstReplyMinutes: 27,
    conversationsStarted: 104,
    conversationsClosed: 49,
    numbersShared: 61,
  ),
];

class DealerDesk extends ChangeNotifier {
  DealerDesk({DateTime? now}) : now = now ?? DateTime.now().toUtc() {
    _items = buildSeed(this.now);
  }

  final DateTime now;
  late final List<Conversation> _items;
  bool signedIn = false;
  int _sequence = 1;

  Conversation? conversation(String id) {
    for (final item in _items) {
      if (item.id == id) return item;
    }
    return null;
  }

  List<InboxItem> inbox(InboxFilter filter) {
    final items = _items.map((conversation) {
      return InboxItem(
        conversation: conversation,
        needsReply: conversationNeedsReply(conversation),
        snippet: snippetOf(conversation),
        sla: slaFor(conversation, now),
        priceDiffers: pricesDiffer(
          conversation.advertisedPriceCents,
          conversation.statedPriceCents,
        ),
      );
    }).toList()
      ..sort((a, b) => b.conversation.openedAt.compareTo(a.conversation.openedAt));

    return items.where((item) {
      switch (filter) {
        case InboxFilter.needsReply:
          return item.needsReply;
        case InboxFilter.allOpen:
          return isOpenStage(item.conversation.stage);
        case InboxFilter.closed:
          return !isOpenStage(item.conversation.stage);
      }
    }).toList();
  }

  void signInDemo() {
    signedIn = true;
    notifyListeners();
  }

  void signOut() {
    signedIn = false;
    notifyListeners();
  }

  String? sendMessage(String id, String body) {
    final conversation = this.conversation(id);
    if (conversation == null) return 'not_found';
    final text = body.trim();
    if (text.isEmpty) return 'empty_message';
    if (text.length > 2000) return 'message_too_long';
    conversation.messages.add(
      ThreadMessage(
        id: 'local-${_sequence++}',
        author: MessageAuthor.salesperson,
        body: text,
        sentAt: DateTime.now().toUtc(),
      ),
    );
    conversation.firstReplyAt ??= DateTime.now().toUtc();
    if (conversation.stage == ConversationStage.newRequest) {
      conversation.stage = ConversationStage.inConversation;
    }
    notifyListeners();
    return null;
  }

  String? shareNumbers({
    required String id,
    required int statedPriceCents,
    required int? writtenOtdCents,
    required String note,
  }) {
    final conversation = this.conversation(id);
    if (conversation == null) return 'not_found';
    if (!isOpenStage(conversation.stage)) return 'conversation_closed';
    if (!_validCents(statedPriceCents)) return 'invalid_price';
    if (writtenOtdCents != null && !_validCents(writtenOtdCents)) {
      return 'invalid_price';
    }
    if (note.trim().length > 280) return 'invalid_price';
    conversation.statedPriceCents = statedPriceCents;
    conversation.writtenOtdCents = writtenOtdCents;
    conversation.messages.add(
      ThreadMessage(
        id: 'local-${_sequence++}',
        author: MessageAuthor.salesperson,
        body: numbersShareBody(
          advertisedPriceCents: conversation.advertisedPriceCents,
          statedPriceCents: statedPriceCents,
          writtenOtdCents: writtenOtdCents,
          note: note,
        ),
        sentAt: DateTime.now().toUtc(),
      ),
    );
    conversation.firstReplyAt ??= DateTime.now().toUtc();
    if (conversation.stage == ConversationStage.newRequest ||
        conversation.stage == ConversationStage.inConversation) {
      conversation.stage = ConversationStage.numbersShared;
    }
    notifyListeners();
    return null;
  }
}

bool _validCents(int value) => value >= 100 && value <= 200000000;

int? dollarsToCents(String input) {
  final trimmed = input.trim().replaceAll(RegExp(r'[$,\s]'), '');
  final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(trimmed);
  if (match == null) return null;
  final dollars = int.parse(match.group(1)!);
  final fraction = (match.group(2) ?? '').padRight(2, '0');
  final cents = dollars * 100 + (fraction.isEmpty ? 0 : int.parse(fraction));
  if (!_validCents(cents)) return null;
  return cents;
}
