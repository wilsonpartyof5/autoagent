import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/discover/discover_query_parser.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('the shopper sentence from the sim', () {
    test('"150s under \$45k in fort mill South Carolina"', () {
      final parsed = parseDiscoverQuery(
        '150s under \$45k in fort mill South Carolina',
      );
      expect(parsed.make, 'Ford');
      expect(parsed.model, 'F-150');
      expect(parsed.priceMax, 45000);
      expect(parsed.priceMin, isNull);
      expect(parsed.place, 'fort mill South Carolina');
      expect(parsed.condition, isNull);
      expect(parsed.bodyType, isNull);
    });

    test('withQuery never sends 150s as a make', () {
      final filters = const DiscoverFilters().withQuery(
        '150s under \$45k in fort mill South Carolina',
      );
      expect(filters.make, 'Ford');
      expect(filters.model, 'F-150');
      expect(filters.priceMax, 45000);
      expect(filters.validate(), isNull);
      expect(filters.toJson(), {
        'make': 'Ford',
        'model': 'F-150',
        'price_max': 45000,
      });
    });
  });

  group('F-150 spellings', () {
    for (final text in [
      'F-150',
      'f150',
      'f150s',
      'F150s',
      'ford f-150',
      'Ford F150',
      '150s',
    ]) {
      test(text, () {
        final parsed = parseDiscoverQuery(text);
        expect(parsed.make, 'Ford', reason: text);
        expect(parsed.model, 'F-150', reason: text);
      });
    }
  });

  group('price phrases', () {
    test('under 45,000', () {
      expect(parseDiscoverQuery('F-150 under 45,000').priceMax, 45000);
    });
    test('less than \$45k', () {
      expect(parseDiscoverQuery('trucks less than \$45k').priceMax, 45000);
    });
    test('below 30 grand', () {
      expect(parseDiscoverQuery('civic below 30 grand').priceMax, 30000);
    });
    test('over \$20k is a minimum', () {
      final parsed = parseDiscoverQuery('tacoma over \$20k');
      expect(parsed.priceMin, 20000);
      expect(parsed.priceMax, isNull);
    });
    test('range \$30k-\$45k', () {
      final parsed = parseDiscoverQuery('rav4 \$30k-\$45k');
      expect(parsed.priceMin, 30000);
      expect(parsed.priceMax, 45000);
    });
    test('a lone \$35k is a max', () {
      expect(parseDiscoverQuery('camry \$35k').priceMax, 35000);
    });
    test('a small bare number is not a price', () {
      expect(parseDiscoverQuery('under 45').priceMax, isNull);
    });
  });

  group('other parts', () {
    test('years, condition, and miles', () {
      final parsed = parseDiscoverQuery(
        'used 2019-2022 tacoma under 60k miles under \$35k',
      );
      expect(parsed.make, 'Toyota');
      expect(parsed.model, 'Tacoma');
      expect(parsed.condition, 'used');
      expect(parsed.yearMin, 2019);
      expect(parsed.yearMax, 2022);
      expect(parsed.milesMax, 60000);
      expect(parsed.priceMax, 35000);
    });
    test('2021 or newer', () {
      final parsed = parseDiscoverQuery('2021 or newer civic');
      expect(parsed.yearMin, 2021);
      expect(parsed.yearMax, isNull);
    });
    test('body type words', () {
      final parsed = parseDiscoverQuery('cheap suv near Charlotte, NC');
      expect(parsed.bodyType, 'SUV');
      expect(parsed.make, isNull);
      expect(parsed.place, 'Charlotte, NC');
    });
    test('near a ZIP is a place, not a price', () {
      final parsed = parseDiscoverQuery('silverado near 29715');
      expect(parsed.place, '29715');
      expect(parsed.priceMax, isNull);
      expect(parsed.make, 'Chevrolet');
    });
    test('make then model word', () {
      final parsed = parseDiscoverQuery('Honda Pilot');
      expect(parsed.make, 'Honda');
      expect(parsed.model, 'Pilot');
    });
    test('make alone clears the model', () {
      final filters = const DiscoverFilters(
        make: 'Honda',
        model: 'Civic',
      ).withQuery('Toyota');
      expect(filters.make, 'Toyota');
      expect(filters.model, isNull);
    });
    test('chevy is Chevrolet', () {
      expect(parseDiscoverQuery('chevy tahoe').make, 'Chevrolet');
    });
  });

  group('unknown words never become filters', () {
    test('a sentence with no car words', () {
      final filters = const DiscoverFilters().withQuery(
        'something fun for my weekend',
      );
      expect(filters.make, isNull);
      expect(filters.model, isNull);
      expect(filters.toJson(), isEmpty);
    });
    test('an unknown first word is not a make', () {
      final parsed = parseDiscoverQuery('blorp under \$20k');
      expect(parsed.make, isNull);
      expect(parsed.model, isNull);
      expect(parsed.priceMax, 20000);
    });
    test('filter-sheet make stays when the text has none', () {
      final filters = const DiscoverFilters(make: 'Honda')
          .withQuery('under \$25k');
      expect(filters.make, 'Honda');
      expect(filters.priceMax, 25000);
    });
    test('empty text keeps filters as they are', () {
      const base = DiscoverFilters(make: 'Ford', priceMax: 40000);
      final filters = base.withQuery('   ');
      expect(identical(filters, base), isTrue);
    });
  });
}
