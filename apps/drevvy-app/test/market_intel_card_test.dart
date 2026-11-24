import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:drevvy_app/data/models/market_intel_brief.dart';
import 'package:drevvy_app/features/shop/widgets/market_intel_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

MarketIntelBrief _brief({required bool mileMatched}) {
  return MarketIntelBrief.tryParse({
    'version': 'v1',
    'fairPrice': 25151,
    'askingPrice': 26724,
    'similar': {
      'low': mileMatched ? 23779 : null,
      'high': mileMatched ? 29452 : null,
      'mileMatched': mileMatched,
    },
    'lines': [
      {
        'key': 'deal_score',
        'title': 'Deal score',
        'shown': true,
        'text': 'A bit high: \$1,573 over the fair price',
        'detail': mileMatched
            ? 'Fair price \$25,151. Most cars like this: \$23,779 to \$29,452.'
            : 'Fair price \$25,151.',
        'tone': 'caution',
      },
      {
        'key': 'how_fast',
        'title': 'How fast they sell',
        'shown': true,
        'text': 'About 45 days to sell.',
      },
      {
        'key': 'left_market',
        'title': 'Left the market',
        'shown': true,
        'text':
            '8 similar cars left the market in the last 90 days. Last asking prices were about \$24,000. These are not final sale prices.',
      },
      {
        'key': 'value_since_new',
        'title': 'When it was new',
        'shown': true,
        'text': 'It cost about \$51,875 new. They ask \$26,724 now.',
      },
    ],
  })!;
}

void main() {
  test('fair OTD stays empty when the payload has none', () {
    final market = MarketContext.fromJson({
      'fair_vehicle_price': 25151,
      'low_price': 23779,
      'median_price': 25151,
      'high_price': 29452,
      'comparables_count': 12,
    });
    expect(market.fairOtd, isNull);
  });

  test('a brief hides the range when the cars were not mile-matched', () {
    final hidden = _brief(mileMatched: false);
    expect(hidden.showsRange, isFalse);
    expect(hidden.fairPriceLine, 'Fair price \$25,151.');
    final shown = _brief(mileMatched: true);
    expect(shown.showsRange, isTrue);
  });

  testWidgets('locked card shows the teaser and not a readable score', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        MarketIntelCard(
          brief: _brief(mileMatched: true),
          unlocked: false,
          onUnlock: () {},
        ),
      ),
    );

    expect(find.text(KeySpend.marketIntelTeaser), findsOneWidget);
    expect(find.text('Fair price'), findsOneWidget);
    expect(find.byType(ImageFiltered), findsOneWidget);
    final filter = tester.widget<ImageFiltered>(find.byType(ImageFiltered));
    expect(filter.child, isA<ExcludeSemantics>());
  });

  testWidgets('unlocked card shows the score, the range, and no sold copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        MarketIntelCard(
          brief: _brief(mileMatched: true),
          unlocked: true,
          onUnlock: () {},
        ),
      ),
    );

    expect(find.text(KeySpend.marketIntelTeaser), findsNothing);
    expect(find.textContaining('A bit high'), findsOneWidget);
    expect(find.textContaining('Most cars like this'), findsOneWidget);
    expect(find.textContaining('About 45 days to sell.'), findsOneWidget);
    expect(find.textContaining('These are not final sale prices.'), findsOneWidget);
    expect(find.textContaining('It cost about'), findsOneWidget);
    expect(find.textContaining('sold'), findsNothing);
    expect(find.textContaining('days of supply'), findsNothing);
    expect(find.textContaining('%'), findsNothing);
  });

  testWidgets('a range that is not mile-matched stays off the card', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        MarketIntelCard(
          brief: _brief(mileMatched: false),
          unlocked: true,
          onUnlock: () {},
        ),
      ),
    );

    expect(find.textContaining('Fair price \$25,151.'), findsOneWidget);
    expect(find.textContaining('Most cars like this'), findsNothing);
  });

  testWidgets('a failed unlock offers retry and does not show an empty card', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      _frame(
        MarketIntelCard(
          unlocked: false,
          failed: true,
          failureMessage: KeySpend.marketIntelKeyBack,
          failureAction: KeySpend.marketIntelRetry,
          onUnlock: () => taps += 1,
        ),
      ),
    );

    expect(find.text(KeySpend.marketIntelKeyBack), findsOneWidget);
    expect(find.text(KeySpend.marketIntelTeaser), findsNothing);
    await tester.tap(find.text(KeySpend.marketIntelRetry));
    expect(taps, 1);
  });

  testWidgets('check again does not spend', (tester) async {
    var spends = 0;
    var checks = 0;
    await tester.pumpWidget(
      _frame(
        MarketIntelCard(
          unlocked: false,
          failed: true,
          isNew: true,
          failureMessage: KeySpend.marketIntelStillChecking,
          failureAction: KeySpend.marketIntelCheckAgain,
          onUnlock: () => spends += 1,
          onRecheck: () => checks += 1,
        ),
      ),
    );

    expect(find.text('Typical asking price'), findsOneWidget);
    expect(find.textContaining('key is back'), findsNothing);
    await tester.tap(find.text(KeySpend.marketIntelCheckAgain));
    expect(checks, 1);
    expect(spends, 0);
  });
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}
