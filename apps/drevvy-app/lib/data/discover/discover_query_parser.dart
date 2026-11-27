/// Turns a shopper's typed sentence into Discover filters.
///
/// The public Discover search API has no free-text parameter, so the app reads
/// the sentence itself. Only known words become filters:
/// - a known make or model alias (`150s`, `f150`, `F-150` -> Ford F-150),
/// - a model word right after a known make (`Honda Pilot`),
/// - a price phrase (`under $45k`, `$30k-$40k`, `over 20,000`),
/// - a year or year range (`2020`, `2019-2022`, `2021 or newer`),
/// - a condition (`new`, `used`, `certified`/`cpo`) and body type (`truck`).
///
/// A place phrase (`in fort mill South Carolina`, `near 29715`) is returned in
/// [ParsedDiscoverQuery.place]. It never becomes a make or model. Every other
/// word is ignored. An unknown first word is never sent as `make`.
class ParsedDiscoverQuery {
  const ParsedDiscoverQuery({
    this.make,
    this.model,
    this.priceMin,
    this.priceMax,
    this.yearMin,
    this.yearMax,
    this.condition,
    this.bodyType,
    this.milesMax,
    this.place,
  });

  final String? make;
  final String? model;
  final int? priceMin;
  final int? priceMax;
  final int? yearMin;
  final int? yearMax;
  final String? condition;
  final String? bodyType;
  final int? milesMax;
  final String? place;

  bool get isEmpty =>
      make == null &&
      model == null &&
      priceMin == null &&
      priceMax == null &&
      yearMin == null &&
      yearMax == null &&
      condition == null &&
      bodyType == null &&
      milesMax == null &&
      place == null;

  @override
  String toString() =>
      'ParsedDiscoverQuery(make: $make, model: $model, priceMin: $priceMin, '
      'priceMax: $priceMax, yearMin: $yearMin, yearMax: $yearMax, '
      'condition: $condition, bodyType: $bodyType, milesMax: $milesMax, '
      'place: $place)';
}

class _Model {
  const _Model(this.make, this.model);
  final String make;
  final String model;
}

const Map<String, String> _makeAliases = {
  'acura': 'Acura',
  'alfa romeo': 'Alfa Romeo',
  'audi': 'Audi',
  'bmw': 'BMW',
  'buick': 'Buick',
  'cadillac': 'Cadillac',
  'chevrolet': 'Chevrolet',
  'chevy': 'Chevrolet',
  'chrysler': 'Chrysler',
  'dodge': 'Dodge',
  'fiat': 'FIAT',
  'ford': 'Ford',
  'genesis': 'Genesis',
  'gmc': 'GMC',
  'honda': 'Honda',
  'hyundai': 'Hyundai',
  'infiniti': 'INFINITI',
  'jaguar': 'Jaguar',
  'jeep': 'Jeep',
  'kia': 'Kia',
  'land rover': 'Land Rover',
  'lexus': 'Lexus',
  'lincoln': 'Lincoln',
  'lucid': 'Lucid',
  'maserati': 'Maserati',
  'mazda': 'Mazda',
  'mercedes': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'mini': 'MINI',
  'mitsubishi': 'Mitsubishi',
  'nissan': 'Nissan',
  'polestar': 'Polestar',
  'porsche': 'Porsche',
  'ram': 'Ram',
  'rivian': 'Rivian',
  'subaru': 'Subaru',
  'tesla': 'Tesla',
  'toyota': 'Toyota',
  'volkswagen': 'Volkswagen',
  'vw': 'Volkswagen',
  'volvo': 'Volvo',
};

/// Normalized model alias (lowercase, no spaces or dashes) -> make + model.
const Map<String, _Model> _modelAliases = {
  // Ford trucks. Shoppers say "150s" for F-150s.
  '150s': _Model('Ford', 'F-150'),
  'f150': _Model('Ford', 'F-150'),
  'f150s': _Model('Ford', 'F-150'),
  '250s': _Model('Ford', 'F-250'),
  'f250': _Model('Ford', 'F-250'),
  'f250s': _Model('Ford', 'F-250'),
  'f350': _Model('Ford', 'F-350'),
  'f350s': _Model('Ford', 'F-350'),
  'ranger': _Model('Ford', 'Ranger'),
  'maverick': _Model('Ford', 'Maverick'),
  'bronco': _Model('Ford', 'Bronco'),
  'explorer': _Model('Ford', 'Explorer'),
  'escape': _Model('Ford', 'Escape'),
  'expedition': _Model('Ford', 'Expedition'),
  'mustang': _Model('Ford', 'Mustang'),
  'edge': _Model('Ford', 'Edge'),
  // Chevrolet / GMC / Ram.
  'silverado': _Model('Chevrolet', 'Silverado 1500'),
  'silverados': _Model('Chevrolet', 'Silverado 1500'),
  'tahoe': _Model('Chevrolet', 'Tahoe'),
  'suburban': _Model('Chevrolet', 'Suburban'),
  'equinox': _Model('Chevrolet', 'Equinox'),
  'traverse': _Model('Chevrolet', 'Traverse'),
  'colorado': _Model('Chevrolet', 'Colorado'),
  'malibu': _Model('Chevrolet', 'Malibu'),
  'camaro': _Model('Chevrolet', 'Camaro'),
  'corvette': _Model('Chevrolet', 'Corvette'),
  'sierra': _Model('GMC', 'Sierra 1500'),
  'yukon': _Model('GMC', 'Yukon'),
  'acadia': _Model('GMC', 'Acadia'),
  'ram1500': _Model('Ram', '1500'),
  // Toyota.
  'tacoma': _Model('Toyota', 'Tacoma'),
  'tacomas': _Model('Toyota', 'Tacoma'),
  'tundra': _Model('Toyota', 'Tundra'),
  'tundras': _Model('Toyota', 'Tundra'),
  'rav4': _Model('Toyota', 'RAV4'),
  'rav4s': _Model('Toyota', 'RAV4'),
  'camry': _Model('Toyota', 'Camry'),
  'camrys': _Model('Toyota', 'Camry'),
  'corolla': _Model('Toyota', 'Corolla'),
  'highlander': _Model('Toyota', 'Highlander'),
  '4runner': _Model('Toyota', '4Runner'),
  'sienna': _Model('Toyota', 'Sienna'),
  'prius': _Model('Toyota', 'Prius'),
  // Honda.
  'civic': _Model('Honda', 'Civic'),
  'civics': _Model('Honda', 'Civic'),
  'accord': _Model('Honda', 'Accord'),
  'crv': _Model('Honda', 'CR-V'),
  'crvs': _Model('Honda', 'CR-V'),
  'hrv': _Model('Honda', 'HR-V'),
  'pilot': _Model('Honda', 'Pilot'),
  'odyssey': _Model('Honda', 'Odyssey'),
  'ridgeline': _Model('Honda', 'Ridgeline'),
  // Others.
  'wrangler': _Model('Jeep', 'Wrangler'),
  'wranglers': _Model('Jeep', 'Wrangler'),
  'gladiator': _Model('Jeep', 'Gladiator'),
  'cherokee': _Model('Jeep', 'Cherokee'),
  'grandcherokee': _Model('Jeep', 'Grand Cherokee'),
  'altima': _Model('Nissan', 'Altima'),
  'rogue': _Model('Nissan', 'Rogue'),
  'frontier': _Model('Nissan', 'Frontier'),
  'outback': _Model('Subaru', 'Outback'),
  'forester': _Model('Subaru', 'Forester'),
  'crosstrek': _Model('Subaru', 'Crosstrek'),
  'cx5': _Model('Mazda', 'CX-5'),
  'cx50': _Model('Mazda', 'CX-50'),
  'cx90': _Model('Mazda', 'CX-90'),
  'tucson': _Model('Hyundai', 'Tucson'),
  'santafe': _Model('Hyundai', 'Santa Fe'),
  'elantra': _Model('Hyundai', 'Elantra'),
  'palisade': _Model('Hyundai', 'Palisade'),
  'telluride': _Model('Kia', 'Telluride'),
  'sorento': _Model('Kia', 'Sorento'),
  'sportage': _Model('Kia', 'Sportage'),
  'model3': _Model('Tesla', 'Model 3'),
  'modely': _Model('Tesla', 'Model Y'),
};

const Map<String, String> _bodyAliases = {
  'truck': 'Pickup',
  'trucks': 'Pickup',
  'pickup': 'Pickup',
  'pickups': 'Pickup',
  'suv': 'SUV',
  'suvs': 'SUV',
  'sedan': 'Sedan',
  'sedans': 'Sedan',
  'minivan': 'Minivan',
  'minivans': 'Minivan',
  'coupe': 'Coupe',
  'coupes': 'Coupe',
  'hatchback': 'Hatchback',
  'hatchbacks': 'Hatchback',
  'wagon': 'Wagon',
  'wagons': 'Wagon',
  'convertible': 'Convertible',
  'convertibles': 'Convertible',
};

const Map<String, String> _conditionAliases = {
  'new': 'new',
  'used': 'used',
  'preowned': 'used',
  'pre-owned': 'used',
  'certified': 'certified',
  'cpo': 'certified',
};

/// Words that can never be a model, even right after a make.
const Set<String> _stopWords = {
  'a',
  'an',
  'and',
  'any',
  'around',
  'at',
  'below',
  'between',
  'by',
  'car',
  'cars',
  'cheap',
  'cheaper',
  'deal',
  'deals',
  'find',
  'for',
  'from',
  'good',
  'i',
  'in',
  'is',
  'less',
  'like',
  'looking',
  'max',
  'me',
  'miles',
  'min',
  'more',
  'my',
  'near',
  'nearby',
  'newer',
  'of',
  'older',
  'or',
  'over',
  'show',
  'than',
  'that',
  'the',
  'to',
  'under',
  'up',
  'want',
  'with',
  'within',
};

/// Parses [text]. Pure and synchronous. Never throws.
ParsedDiscoverQuery parseDiscoverQuery(String text) {
  var rest = ' ${text.trim()} ';
  if (rest.trim().isEmpty) return const ParsedDiscoverQuery();

  int? priceMin;
  int? priceMax;
  int? yearMin;
  int? yearMax;
  String? place;

  int? milesMax;
  final yearCap = DateTime.now().year + 1;
  bool isYear(int value) => value >= 1990 && value <= yearCap;

  int? money(String number, String? suffix, {required bool dollar}) {
    final value = double.tryParse(number.replaceAll(',', ''));
    if (value == null || !value.isFinite) return null;
    final scaled = suffix != null ? value * 1000 : value;
    final rounded = scaled.round();
    // A bare small number is not a price unless it had "$" or "k".
    if (suffix == null && !dollar && rounded < 1000) return null;
    if (rounded < 0 || rounded > 500000) return null;
    return rounded;
  }

  const moneyPattern =
      r"""(\$)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|grand|thousand)?\b""";

  // Miles: "under 60k miles", "less than 60,000 mi". Runs before prices.
  rest = rest.replaceAllMapped(
    RegExp(
      r'\b(?:(?:under|below|less\s+than|max(?:imum)?|up\s+to)\s*)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\s*(?:miles|mi)\b',
      caseSensitive: false,
    ),
    (m) {
      final value = double.tryParse(m[1]!.replaceAll(',', ''));
      if (value == null || !value.isFinite) return m[0]!;
      final miles = (m[2] != null ? value * 1000 : value).round();
      if (miles <= 0 || miles > 400000) return m[0]!;
      milesMax = miles;
      return ' ';
    },
  );

  // Price range: "$30k-$45k", "between 30k and 45k", "30k to 45k".
  rest = rest.replaceAllMapped(
    RegExp(
      '(?:between\\s+)?$moneyPattern\\s*(?:-|to|and)\\s*$moneyPattern',
      caseSensitive: false,
    ),
    (m) {
      final low = money(
        m[2]!,
        m[3] ?? m[6],
        dollar: m[1] != null || m[4] != null,
      );
      final high = money(m[5]!, m[6], dollar: m[4] != null || m[1] != null);
      final bare = m[1] == null && m[3] == null && m[4] == null && m[6] == null;
      final isYears =
          bare && low != null && high != null && isYear(low) && isYear(high);
      if (low == null || high == null || isYears || low > high) return m[0]!;
      priceMin = low;
      priceMax = high;
      return ' ';
    },
  );

  // Max price: "under $45k", "below 45,000", "less than 45k", "max 45k".
  rest = rest.replaceAllMapped(
    RegExp(
      '\\b(?:under|below|less\\s+than|up\\s+to|max(?:imum)?|no\\s+more\\s+than|<)\\s*$moneyPattern',
      caseSensitive: false,
    ),
    (m) {
      final value = money(m[2]!, m[3], dollar: m[1] != null);
      if (value == null) return m[0]!;
      priceMax = value;
      return ' ';
    },
  );

  // Min price: "over $20k", "above 20,000", "at least 20k".
  rest = rest.replaceAllMapped(
    RegExp(
      '\\b(?:over|above|more\\s+than|at\\s+least|min(?:imum)?|>)\\s*$moneyPattern',
      caseSensitive: false,
    ),
    (m) {
      final value = money(m[2]!, m[3], dollar: m[1] != null);
      if (value == null) return m[0]!;
      priceMin = value;
      return ' ';
    },
  );

  // Year range "2019-2022" / "2019 to 2022".
  rest = rest.replaceAllMapped(
    RegExp(r'\b((?:19|20)\d{2})\s*(?:-|to)\s*((?:19|20)\d{2})\b'),
    (m) {
      final a = int.parse(m[1]!);
      final b = int.parse(m[2]!);
      if (!isYear(a) || !isYear(b) || a > b) return m[0]!;
      yearMin = a;
      yearMax = b;
      return ' ';
    },
  );
  rest = rest.replaceAllMapped(
    RegExp(
      r'\b((?:19|20)\d{2})\s*(?:or|and)\s*(newer|up|later|older|earlier)\b',
      caseSensitive: false,
    ),
    (m) {
      final a = int.parse(m[1]!);
      if (!isYear(a)) return m[0]!;
      final dir = m[2]!.toLowerCase();
      if (dir == 'older' || dir == 'earlier') {
        yearMax = a;
      } else {
        yearMin = a;
      }
      return ' ';
    },
  );

  // Place: "in fort mill South Carolina", "near 29715", "around Charlotte, NC".
  // Runs before the single-year and bare-price passes so a ZIP is not a price.
  rest = rest.replaceAllMapped(
    RegExp(r'\b(?:in|near|around|close\s+to)\s+(.+)$', caseSensitive: false),
    (m) {
      final raw = m[1]!.trim();
      final cleaned = raw.replaceAll(RegExp(r'[.?!]+$'), '').trim();
      final first = cleaned.split(RegExp(r'\s+')).first.toLowerCase();
      final looksLikePlace =
          cleaned.isNotEmpty &&
          !_stopWords.contains(first) &&
          !_conditionAliases.containsKey(first) &&
          !_bodyAliases.containsKey(first) &&
          !RegExp(r'^\$').hasMatch(cleaned) &&
          (RegExp(r'^\d{5}$').hasMatch(cleaned) ||
              !RegExp(
                r'^\d+\s*(k|grand|thousand)?$',
                caseSensitive: false,
              ).hasMatch(cleaned)) &&
          !RegExp(r'^(red|blue|black|white|silver|gray|grey|green)$')
              .hasMatch(first);
      if (!looksLikePlace) return m[0]!;
      place = cleaned;
      return ' ';
    },
  );

  // Single year.
  rest = rest.replaceAllMapped(RegExp(r'\b((?:19|20)\d{2})\b'), (m) {
    final a = int.parse(m[1]!);
    if (!isYear(a) || yearMin != null || yearMax != null) return m[0]!;
    yearMin = a;
    yearMax = a;
    return ' ';
  });

  // A lone "$45k" with no direction word is a max price.
  if (priceMax == null && priceMin == null) {
    rest = rest.replaceAllMapped(
      RegExp(
        r"""(\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|grand|thousand)?\b)|\b((\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|grand|thousand))\b""",
        caseSensitive: false,
      ),
      (m) {
        final number = m[2] ?? m[5]!;
        final suffix = m[3] ?? m[6];
        final value = money(number, suffix, dollar: m[1] != null);
        if (value == null || priceMax != null) return m[0]!;
        priceMax = value;
        return ' ';
      },
    );
  }
  // Word pass: make, model, condition, body type.
  final words = rest
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\- ]"), ' ')
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .toList();

  String? make;
  String? model;
  String? condition;
  String? bodyType;

  String norm(String w) => w.replaceAll('-', '');

  for (var i = 0; i < words.length; i++) {
    final word = words[i];
    final next = i + 1 < words.length ? words[i + 1] : null;

    // Two-word makes and models first.
    if (next != null) {
      final pair = '$word $next';
      if (make == null && _makeAliases.containsKey(pair)) {
        make = _makeAliases[pair];
        i++;
        continue;
      }
      final pairModel = _modelAliases[norm(word) + norm(next)];
      if (model == null &&
          pairModel != null &&
          (make == null || make == pairModel.make)) {
        make = pairModel.make;
        model = pairModel.model;
        i++;
        continue;
      }
    }

    if (_conditionAliases.containsKey(word)) {
      condition ??= _conditionAliases[word];
      continue;
    }
    if (_bodyAliases.containsKey(word)) {
      bodyType ??= _bodyAliases[word];
      continue;
    }
    final aliasModel = _modelAliases[norm(word)];
    if (aliasModel != null &&
        model == null &&
        (make == null || make == aliasModel.make)) {
      make = aliasModel.make;
      model = aliasModel.model;
      continue;
    }
    if (make == null && _makeAliases.containsKey(word)) {
      make = _makeAliases[word];
      // A plain word right after a known make is that make's model.
      if (next != null && model == null) {
        final nextAlias = _modelAliases[norm(next)];
        if (nextAlias != null && nextAlias.make == make) {
          model = nextAlias.model;
          i++;
        } else if (_looksLikeModelWord(next)) {
          model = _titleCase(next);
          i++;
        }
      }
      continue;
    }
    // Anything else is ignored. Unknown words never become filters.
  }

  return ParsedDiscoverQuery(
    make: make,
    model: model,
    priceMin: priceMin,
    priceMax: priceMax,
    yearMin: yearMin,
    yearMax: yearMax,
    condition: condition,
    bodyType: bodyType,
    milesMax: milesMax,
    place: place,
  );
}

bool _looksLikeModelWord(String word) {
  if (word.length < 2 || word.length > 20) return false;
  if (_stopWords.contains(word)) return false;
  if (_conditionAliases.containsKey(word)) return false;
  if (_bodyAliases.containsKey(word)) return false;
  if (_makeAliases.containsKey(word)) return false;
  if (RegExp(r'^\d+$').hasMatch(word) && word.length > 4) return false;
  return RegExp(r'^[a-z0-9][a-z0-9\-]*$').hasMatch(word);
}

String _titleCase(String word) {
  if (RegExp(r'\d').hasMatch(word)) return word.toUpperCase();
  return word[0].toUpperCase() + word.substring(1);
}
