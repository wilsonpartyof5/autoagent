import 'json_values.dart';

/// One shopper line from market intel v1.
class MarketIntelLine {
  const MarketIntelLine({
    required this.key,
    required this.shown,
    required this.title,
    this.text,
    this.detail,
    this.tone,
  });

  final String key;
  final bool shown;
  final String title;
  final String? text;
  final String? detail;
  final String? tone;

  static MarketIntelLine? tryParse(Map<String, dynamic> row) {
    final key = jsonString(row['key']);
    final title = jsonString(row['title']);
    if (key == null || title == null) return null;
    return MarketIntelLine(
      key: key,
      shown: row['shown'] == true,
      title: title,
      text: jsonString(row['text']),
      detail: jsonString(row['detail']),
      tone: jsonString(row['tone']),
    );
  }
}

/// A cheaper car in the nearby sheet. Listed prices only.
class CheaperCar {
  const CheaperCar({
    this.year,
    this.make,
    this.model,
    this.trim,
    this.price,
    this.miles,
    this.distance,
  });

  final int? year;
  final String? make;
  final String? model;
  final String? trim;
  final int? price;
  final int? miles;
  final double? distance;

  String get name {
    return [
      if (year != null) '$year',
      if (make != null) make,
      if (model != null) model,
      if (trim != null) trim,
    ].join(' ');
  }

  static CheaperCar? tryParse(Object? value) {
    if (value is! Map) return null;
    final row = Map<String, dynamic>.from(value);
    final price = jsonInt(row['price']);
    if (price == null || price <= 0) return null;
    return CheaperCar(
      year: jsonInt(row['year']),
      make: jsonString(row['make']),
      model: jsonString(row['model']),
      trim: jsonString(row['trim']),
      price: price,
      miles: jsonInt(row['miles']),
      distance: jsonDouble(row['distance']),
    );
  }
}

/// Shopper fair-price card. Built from `market.v1` on the unlock payload.
///
/// v1 does not invent a whole-price number, so this type has no fair OTD.
class MarketIntelBrief {
  const MarketIntelBrief({
    required this.lines,
    this.fairPrice,
    this.rangeLow,
    this.rangeHigh,
    this.mileMatched = false,
    this.askingPrice,
    this.verdict,
    this.verdictTone,
    this.fairPriceLine,
    this.cheaper = const [],
    this.cheaperCount = 0,
  });

  final List<MarketIntelLine> lines;
  final int? fairPrice;
  final int? rangeLow;
  final int? rangeHigh;
  final bool mileMatched;
  final int? askingPrice;
  final String? verdict;
  final String? verdictTone;
  final String? fairPriceLine;
  final List<CheaperCar> cheaper;
  final int cheaperCount;

  bool get showsRange =>
      mileMatched &&
      rangeLow != null &&
      rangeHigh != null &&
      rangeHigh! > rangeLow!;

  List<MarketIntelLine> get shownLines => [
    for (final line in lines)
      if (line.shown && line.text != null && line.text!.isNotEmpty) line,
  ];

  /// Accepts the stored market object (`{ source, v1 }`) or a bare v1 card.
  static MarketIntelBrief? tryParse(Object? value) {
    if (value is! Map) return null;
    final root = Map<String, dynamic>.from(value);
    final nested = root['v1'];
    final card = nested is Map ? Map<String, dynamic>.from(nested) : root;
    if (card['version'] != 'v1') return null;
    final rawLines = card['lines'];
    final lines = <MarketIntelLine>[];
    MarketIntelLine? deal;
    Map<String, dynamic>? dealSource;
    final cheaper = <CheaperCar>[];
    var cheaperCount = 0;
    if (rawLines is List) {
      for (final item in rawLines) {
        if (item is! Map) continue;
        final row = Map<String, dynamic>.from(item);
        final line = MarketIntelLine.tryParse(row);
        if (line == null) continue;
        lines.add(line);
        if (line.key == 'deal_score' && line.shown) {
          deal = line;
          final source = row['source'];
          if (source is Map) dealSource = Map<String, dynamic>.from(source);
        }
        if (line.key == 'cheaper_nearby') {
          final source = row['source'];
          if (source is Map) {
            final sourceMap = Map<String, dynamic>.from(source);
            cheaperCount = jsonInt(sourceMap['numFound']) ?? 0;
            final rows = sourceMap['rows'];
            if (rows is List) {
              for (final raw in rows) {
                final car = CheaperCar.tryParse(raw);
                if (car != null) cheaper.add(car);
              }
            }
          }
        }
      }
    }
    if (lines.isEmpty) return null;
    final similar = card['similar'] is Map
        ? Map<String, dynamic>.from(card['similar'] as Map)
        : const <String, dynamic>{};
    return MarketIntelBrief(
      lines: lines,
      fairPrice:
          jsonInt(card['fairPrice']) ??
          jsonInt(dealSource?['fairPrice']) ??
          jsonInt(similar['median']),
      rangeLow: jsonInt(similar['low']),
      rangeHigh: jsonInt(similar['high']),
      mileMatched: similar['mileMatched'] == true,
      askingPrice: jsonInt(card['askingPrice']),
      verdict: deal?.text,
      verdictTone: deal?.tone,
      fairPriceLine: deal?.detail,
      cheaper: cheaper,
      cheaperCount: cheaperCount > 0 ? cheaperCount : cheaper.length,
    );
  }
}
