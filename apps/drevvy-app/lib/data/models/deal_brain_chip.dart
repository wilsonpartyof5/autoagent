import 'package:equatable/equatable.dart';

/// One-click in-network message chip. T1–T12 from the middleman spec.
///
/// The shopper taps a chip to send it. Nothing here is sent on its own.
/// The sheet can show the after-opener pair. A later call to
/// `POST /api/consumer/deals/:id/chips` can pass a fuller list.
class DealBrainChip extends Equatable {
  const DealBrainChip({
    required this.templateId,
    required this.label,
    required this.message,
  });

  final String templateId;
  final String label;
  final String message;

  @override
  List<Object?> get props => [templateId, label, message];

  static const itemizedOtd = DealBrainChip(
    templateId: 'T6',
    label: 'Itemized OTD',
    message:
        'Could you share the itemized out-the-door price? Price, dealer fees, tax, title and reg.',
  );

  static const thanks = DealBrainChip(
    templateId: 'T7',
    label: 'Thanks',
    message: 'Thanks, that helps!',
  );

  static const thinking = DealBrainChip(
    templateId: 'T8',
    label: 'Got it, thinking',
    message: "Thanks! I'll look this over and get back to you.",
  );

  static const hours = DealBrainChip(
    templateId: 'T10',
    label: 'Your hours?',
    message: 'What are your hours this week?',
  );

  /// Labels and ids for the full set. Bodies that need intel stay on the server.
  static const catalog = <DealBrainChip>[
    DealBrainChip(templateId: 'T1', label: 'Still available?', message: ''),
    DealBrainChip(templateId: 'T2', label: 'Still this price?', message: ''),
    DealBrainChip(templateId: 'T3', label: 'Price vs market', message: ''),
    DealBrainChip(templateId: 'T4', label: 'Similar cars', message: ''),
    DealBrainChip(templateId: 'T5', label: 'Time on market', message: ''),
    itemizedOtd,
    thanks,
    thinking,
    DealBrainChip(templateId: 'T9', label: 'Ask about feature', message: ''),
    hours,
    DealBrainChip(templateId: 'T11', label: 'Trade-in question', message: ''),
    DealBrainChip(templateId: 'T12', label: 'Plan a visit', message: ''),
  ];

  /// After the desk opener, before a dealer reply. T1 needs a stock number.
  static List<DealBrainChip> suggestionsFor({String? stockNumber}) {
    final stock = stockNumber?.trim().replaceFirst(RegExp(r'^#'), '') ?? '';
    if (!RegExp(r'^[A-Za-z0-9-]{1,15}$').hasMatch(stock)) {
      return const [itemizedOtd];
    }
    return [
      itemizedOtd,
      DealBrainChip(
        templateId: 'T1',
        label: 'Still available?',
        message: 'Hi, is stock #$stock still available?',
      ),
    ];
  }
}
