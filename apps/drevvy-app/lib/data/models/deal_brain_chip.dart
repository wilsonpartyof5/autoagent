import 'package:equatable/equatable.dart';

import 'listing.dart';
import 'market_context.dart';

/// One-click in-network message chip. T1–T12 from the middleman spec.
///
/// The shopper taps a chip to send it. Nothing here is sent on its own.
/// Live copy comes from `POST /api/consumer/deals/:id/chips`. Until that
/// call returns, the sheet shows the after-opener pair.
class DealBrainChip extends Equatable {
  const DealBrainChip({
    required this.templateId,
    required this.label,
    required this.message,
    this.sendsAutomatically = false,
  });

  final String templateId;
  final String label;
  final String message;
  final bool sendsAutomatically;

  static final _haggle = RegExp(
    r'\b(negotiat\w*|haggl\w*|bargain\w*|lowball\w*|counter-?offers?|come down|do better|best offer)\b',
    caseSensitive: false,
  );

  /// Safe to render: a body, no leftover tokens, no haggle copy, never auto-sent.
  bool get isSafe {
    if (sendsAutomatically) return false;
    if (templateId.isEmpty || label.isEmpty || message.isEmpty) return false;
    if (message.contains('{')) return false;
    if (_haggle.hasMatch(label) || _haggle.hasMatch(message)) return false;
    return true;
  }

  @override
  List<Object?> get props => [templateId, label, message, sendsAutomatically];

  factory DealBrainChip.fromJson(Map<String, dynamic> json) {
    final id = json['templateId'] ?? json['id'] ?? '';
    return DealBrainChip(
      templateId: id is String ? id : id.toString(),
      label: json['label'] is String ? json['label'] as String : '',
      message: json['message'] is String ? json['message'] as String : '',
      sendsAutomatically: json['sendsAutomatically'] == true,
    );
  }

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
    final stock = normalizeStockNumber(stockNumber);
    if (stock == null) return const [itemizedOtd];
    return [
      itemizedOtd,
      DealBrainChip(
        templateId: 'T1',
        label: 'Still available?',
        message: 'Hi, is stock #$stock still available?',
      ),
    ];
  }

  static String? normalizeStockNumber(String? raw) {
    if (raw == null) return null;
    final stock = raw.trim().replaceFirst(RegExp(r'^#'), '').toUpperCase();
    if (!RegExp(r'^[A-Z0-9-]{1,15}$').hasMatch(stock)) return null;
    return stock;
  }

  static List<DealBrainChip> safeOf(Iterable<DealBrainChip> chips) {
    return [for (final chip in chips) if (chip.isSafe) chip];
  }
}

/// Intel posted to `/api/consumer/deals/:id/chips`. Missing fields hide a chip.
class ChipIntel extends Equatable {
  const ChipIntel({
    this.stockNumber,
    this.listedPrice,
    this.fairPrice,
    this.compsCount,
    this.compsLowPrice,
    this.dom,
    this.feature,
    this.rep,
    this.visitDay,
    this.visitTime,
    this.itemizedOtdInThread,
  });

  final String? stockNumber;
  final int? listedPrice;
  final int? fairPrice;
  final int? compsCount;
  final int? compsLowPrice;
  final int? dom;
  final String? feature;
  final String? rep;
  final String? visitDay;
  final String? visitTime;
  final bool? itemizedOtdInThread;

  /// Market figures, listing feature, and visit window when the VDP has them.
  factory ChipIntel.fromDealContext({
    required Listing listing,
    MarketContext? market,
    String? rep,
    String? visitDay,
    String? visitTime,
    bool? itemizedOtdInThread,
  }) {
    final features = listing.extra?.highValueFeatures ?? listing.extra?.features;
    final feature = features == null || features.isEmpty ? null : features.first;
    return ChipIntel(
      stockNumber: DealBrainChip.normalizeStockNumber(listing.stockNo),
      listedPrice: listing.price,
      fairPrice: market?.fairVehiclePrice,
      compsCount: market?.comparablesCount,
      compsLowPrice: market?.lowPrice,
      dom: listing.domActive,
      feature: feature,
      rep: rep,
      visitDay: visitDay,
      visitTime: visitTime,
      itemizedOtdInThread: itemizedOtdInThread,
    );
  }

  Map<String, Object?> toJson() {
    return {
      if (stockNumber != null) 'stockNumber': stockNumber,
      if (listedPrice != null) 'listedPrice': listedPrice,
      if (fairPrice != null) 'fairPrice': fairPrice,
      if (compsCount != null) 'compsCount': compsCount,
      if (compsLowPrice != null) 'compsLowPrice': compsLowPrice,
      if (dom != null) 'dom': dom,
      if (feature != null) 'feature': feature,
      if (rep != null) 'rep': rep,
      if (visitDay != null) 'visitDay': visitDay,
      if (visitTime != null) 'visitTime': visitTime,
      if (itemizedOtdInThread != null) 'itemizedOtdInThread': itemizedOtdInThread,
    };
  }

  @override
  List<Object?> get props => [
        stockNumber,
        listedPrice,
        fairPrice,
        compsCount,
        compsLowPrice,
        dom,
        feature,
        rep,
        visitDay,
        visitTime,
        itemizedOtdInThread,
      ];
}

class ChipThreadMessage extends Equatable {
  const ChipThreadMessage({this.author, required this.body});

  final String? author;
  final String body;

  Map<String, Object?> toJson() {
    return {
      if (author != null) 'author': author,
      'body': body,
    };
  }

  factory ChipThreadMessage.fromJson(Map<String, dynamic> json) {
    return ChipThreadMessage(
      author: json['author'] is String ? json['author'] as String : null,
      body: json['body'] is String ? json['body'] as String : '',
    );
  }

  @override
  List<Object?> get props => [author, body];
}

/// Server suggestion set. [autoSend] is always false.
class ChipSuggestionSet extends Equatable {
  const ChipSuggestionSet({
    required this.stage,
    required this.chips,
    this.network = 'in_network',
    this.autoSend = false,
  });

  final String network;
  final String stage;
  final bool autoSend;
  final List<DealBrainChip> chips;

  factory ChipSuggestionSet.fromJson(Map<String, dynamic> json) {
    final rawChips = json['chips'];
    final chips = <DealBrainChip>[];
    if (rawChips is List) {
      for (final item in rawChips) {
        if (item is Map) {
          chips.add(DealBrainChip.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }
    return ChipSuggestionSet(
      network: json['network'] is String ? json['network'] as String : 'in_network',
      stage: json['stage'] is String ? json['stage'] as String : 'after_opener',
      autoSend: json['autoSend'] == true,
      chips: DealBrainChip.safeOf(chips),
    );
  }

  @override
  List<Object?> get props => [network, stage, autoSend, chips];
}
