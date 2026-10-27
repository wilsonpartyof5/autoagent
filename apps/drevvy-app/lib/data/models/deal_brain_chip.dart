import 'package:equatable/equatable.dart';

/// One suggestion the shopper can place in the dealer composer.
///
/// T1–T12 come from the middleman spec. A tap fills the composer.
/// Nothing here is sent on its own. `POST /api/consumer/deals/:id/chips`
/// supplies the live list. The sheet keeps the after-opener pair until
/// that list arrives.
class DealBrainChip extends Equatable {
  const DealBrainChip({
    required this.templateId,
    required this.label,
    required this.message,
  });

  static const labelLimit = 18;
  static const bodyLimit = 160;

  /// Same haggle block the chips service uses. Chip copy never asks the
  /// dealer to negotiate, haggle, or bargain.
  static final hagglePattern = RegExp(
    r'\b(negotiat\w*|haggl\w*|bargain\w*|lowball\w*|counter-?offers?|come down|do better|best offer)\b',
    caseSensitive: false,
  );

  static final _phrasePattern = RegExp(
    r"^[A-Za-z0-9][A-Za-z0-9 '&./+-]{0,40}$",
  );

  final String templateId;
  final String label;
  final String message;

  @override
  List<Object?> get props => [templateId, label, message];

  /// Drops unfilled templates, over-long copy, and haggle wording.
  static bool copyAllowed(String label, String message) {
    final cleanLabel = label.trim();
    final cleanMessage = message.trim();
    if (cleanLabel.isEmpty || cleanMessage.isEmpty) return false;
    if (cleanLabel.length > labelLimit || cleanMessage.length > bodyLimit) {
      return false;
    }
    if (cleanLabel.contains('{') || cleanMessage.contains('{')) return false;
    if (hagglePattern.hasMatch(cleanLabel) ||
        hagglePattern.hasMatch(cleanMessage)) {
      return false;
    }
    return true;
  }

  /// Phrase the chips service will accept for a feature, visit, or rep name.
  static String? cleanPhrase(String? raw) {
    if (raw == null) return null;
    final text = raw.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (!_phrasePattern.hasMatch(text)) return null;
    if (hagglePattern.hasMatch(text)) return null;
    return text;
  }

  /// Parses one chip from the chips route. Returns null when the copy
  /// must not be shown. `sendsAutomatically` is ignored: the sheet never
  /// sends a chip on its own.
  static DealBrainChip? tryParse(Map<String, dynamic> json) {
    final templateRaw = json['templateId'] ?? json['id'];
    final label = json['label'];
    final message = json['message'];
    if (templateRaw is! String || label is! String || message is! String) {
      return null;
    }
    final templateId = templateRaw.trim();
    if (templateId.isEmpty || !copyAllowed(label, message)) return null;
    return DealBrainChip(
      templateId: templateId,
      label: label.trim(),
      message: message.trim(),
    );
  }

  static const itemizedOtd = DealBrainChip(
    templateId: 'T6',
    label: 'Itemized OTD',
    message: 'Could you share the itemized out-the-door price? Price, dealer fees, tax, title and reg.',
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
