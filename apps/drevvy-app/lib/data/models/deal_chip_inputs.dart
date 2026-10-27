import 'package:equatable/equatable.dart';

import 'deal_brain_chip.dart';
import 'listing.dart';
import 'market_context.dart';

/// One line of the in-network deal thread sent with a chips request.
class DealThreadMessage extends Equatable {
  const DealThreadMessage({required this.body, this.author});

  /// `shopper`, `salesperson`, `dealer`, or `drevvy`.
  final String? author;
  final String body;

  @override
  List<Object?> get props => [author, body];

  Map<String, Object?> toJson() {
    return {
      if (author != null && author!.trim().isNotEmpty) 'author': author,
      'body': body,
    };
  }
}

/// Facts the chips route needs. A flag stays false until that fact has
/// finished loading. A loaded fact may still be null: missing intel hides
/// a chip on the server, and T3–T5 fall back without inventing a price.
class DealChipInputs extends Equatable {
  const DealChipInputs({
    this.threadLoaded = false,
    this.messages = const [],
    this.marketLoaded = false,
    this.fairPrice,
    this.compsCount,
    this.compsLowPrice,
    this.dom,
    this.listedPrice,
    this.stockNumber,
    this.featureLoaded = false,
    this.feature,
    this.visitLoaded = false,
    this.visitDay,
    this.visitTime,
    this.rep,
    this.itemizedOtdInThread = false,
    this.stage,
  });

  /// Thread, market intel, feature, and visit time have all been loaded.
  bool get ready =>
      threadLoaded && marketLoaded && featureLoaded && visitLoaded;

  final bool threadLoaded;
  final List<DealThreadMessage> messages;

  final bool marketLoaded;
  final int? fairPrice;
  final int? compsCount;
  final int? compsLowPrice;
  final int? dom;
  final int? listedPrice;
  final String? stockNumber;

  final bool featureLoaded;
  final String? feature;

  final bool visitLoaded;
  final String? visitDay;
  final String? visitTime;

  /// Salesperson first name, when the thread has one. Not the shopper.
  final String? rep;

  final bool itemizedOtdInThread;
  final String? stage;

  /// All four inputs are loaded. Null market, feature, or visit means the
  /// app looked and does not have that fact yet.
  factory DealChipInputs.loaded({
    List<DealThreadMessage> messages = const [],
    MarketContext? market,
    String? feature,
    String? visitDay,
    String? visitTime,
    String? stockNumber,
    int? listedPrice,
    int? dom,
    String? rep,
    bool itemizedOtdInThread = false,
    String? stage,
  }) {
    return DealChipInputs(
      threadLoaded: true,
      messages: messages,
      marketLoaded: true,
      fairPrice: _positive(market?.fairVehiclePrice),
      compsCount: _atLeastOne(market?.comparablesCount),
      compsLowPrice: _positive(market?.lowPrice),
      dom: _atLeastOne(dom),
      listedPrice: _positive(listedPrice),
      stockNumber: stockNumber,
      featureLoaded: true,
      feature: DealBrainChip.cleanPhrase(feature),
      visitLoaded: true,
      visitDay: DealBrainChip.cleanPhrase(visitDay),
      visitTime: DealBrainChip.cleanPhrase(visitTime),
      rep: DealBrainChip.cleanPhrase(rep),
      itemizedOtdInThread: itemizedOtdInThread,
      stage: stage,
    );
  }

  /// First listing feature the chips service can place in T9.
  static String? featureFromListing(Listing listing) {
    final candidates = <String>[
      ...?listing.extra?.highValueFeatures,
      ...?listing.extra?.features,
    ];
    for (final candidate in candidates) {
      final phrase = DealBrainChip.cleanPhrase(candidate);
      if (phrase != null) return phrase;
    }
    return null;
  }

  /// Body for `POST /api/consumer/deals/:id/chips`. Omitted intel lets the
  /// server use the vehicle snapshot and its spec fallbacks.
  Map<String, Object?> toRequestBody() {
    final intel = <String, Object?>{};
    final stock = stockNumber?.trim();
    if (stock != null && stock.isNotEmpty) intel['stockNumber'] = stock;
    _putPositive(intel, 'listedPrice', listedPrice);
    _putPositive(intel, 'fairPrice', fairPrice);
    _putCount(intel, 'compsCount', compsCount);
    _putPositive(intel, 'compsLowPrice', compsLowPrice);
    _putCount(intel, 'dom', dom);
    final featureText = DealBrainChip.cleanPhrase(feature);
    if (featureText != null) intel['feature'] = featureText;
    final repText = DealBrainChip.cleanPhrase(rep);
    if (repText != null) intel['rep'] = repText;
    final day = DealBrainChip.cleanPhrase(visitDay);
    if (day != null) intel['visitDay'] = day;
    final time = DealBrainChip.cleanPhrase(visitTime);
    if (time != null) intel['visitTime'] = time;
    if (itemizedOtdInThread) intel['itemizedOtdInThread'] = true;

    final stageText = stage?.trim();
    return {
      if (stageText != null && stageText.isNotEmpty) 'stage': stageText,
      'messages': [for (final message in messages) message.toJson()],
      'intel': intel,
    };
  }

  static int? _positive(int? value) =>
      value != null && value > 0 ? value : null;

  static int? _atLeastOne(int? value) =>
      value != null && value >= 1 ? value : null;

  static void _putPositive(Map<String, Object?> intel, String key, int? value) {
    final next = _positive(value);
    if (next != null) intel[key] = next;
  }

  static void _putCount(Map<String, Object?> intel, String key, int? value) {
    final next = _atLeastOne(value);
    if (next != null) intel[key] = next;
  }

  @override
  List<Object?> get props => [
    threadLoaded,
    messages,
    marketLoaded,
    fairPrice,
    compsCount,
    compsLowPrice,
    dom,
    listedPrice,
    stockNumber,
    featureLoaded,
    feature,
    visitLoaded,
    visitDay,
    visitTime,
    rep,
    itemizedOtdInThread,
    stage,
  ];
}

/// Live chip list for one in-network deal. [autoSend] stays false.
class DealChipSuggestionSet extends Equatable {
  const DealChipSuggestionSet({
    required this.network,
    required this.stage,
    required this.chips,
  }) : autoSend = false;

  final String network;
  final String stage;

  /// Chips never send themselves. A payload that says otherwise is ignored.
  final bool autoSend;
  final List<DealBrainChip> chips;

  static DealChipSuggestionSet? tryParse(Map<String, dynamic> json) {
    if (json['success'] == false) return null;
    final payload = json['data'] is Map
        ? Map<String, dynamic>.from(json['data'] as Map)
        : json;
    final rawChips = payload['chips'];
    if (rawChips is! List) return null;
    final network = payload['network'];
    final resolvedNetwork = network is String && network.isNotEmpty
        ? network
        : 'in_network';
    if (resolvedNetwork != 'in_network') return null;
    final stage = payload['stage'];
    final chips = <DealBrainChip>[];
    for (final item in rawChips) {
      if (item is! Map) continue;
      final chip = DealBrainChip.tryParse(Map<String, dynamic>.from(item));
      if (chip != null) chips.add(chip);
    }
    return DealChipSuggestionSet(
      network: resolvedNetwork,
      stage: stage is String && stage.isNotEmpty ? stage : 'after_opener',
      chips: chips,
    );
  }

  @override
  List<Object?> get props => [network, stage, autoSend, chips];
}
