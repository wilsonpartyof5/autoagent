import 'dart:io';

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/data/models/deal.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/deals/screens/deal_timeline_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('demo deal timelines itemize each dealer on the seed book', () async {
    final repo = DemoRepository();
    final rav4 = await repo.getDealById('deal_001');
    expect(rav4.timelines, hasLength(3));
    expect(rav4.timelines.map((dealer) => dealer.label), [
      'Dealer A',
      'Dealer B',
      'Dealer C',
    ]);
    expect(rav4.timelines[0].status, DealStatus.offerReceived);
    expect(rav4.timelines[0].latestOtd, 33415);
    expect(rav4.timelines[0].rounds[1].removedFees.map((fee) => fee.key), [
      'Nitrogen fill',
    ]);
    expect(rav4.timelines[0].rounds[2].removedFees.map((fee) => fee.key), [
      'Paint protection',
      'Nitrogen fill',
    ]);
    expect(rav4.timelines[1].rounds, hasLength(2));
    expect(rav4.timelines[1].latestOtd, 34880);
    expect(rav4.timelines[2].rounds, isEmpty);
    expect(rav4.timelines[2].status, DealStatus.noResponse);

    final crv = await repo.getDealById('deal_002');
    expect(crv.timelines, hasLength(2));
    expect(crv.timelines.last.status, DealStatus.reachingOut);
    expect(crv.timelines.last.latestOtd, isNull);
  });

  test('a deal without per-dealer rows still shows its own rounds', () {
    final deal = _deal(timelines: const []);
    expect(deal.timelines, hasLength(1));
    expect(deal.timelines.single.label, 'Dealer A');
    expect(deal.timelines.single.latestOtd, 23100);
    expect(deal.timelines.single.rounds.single.lines.single.key, 'Vehicle price');
  });

  testWidgets('timeline shows rounds, crossed-off fees, OTD, and status', (
    tester,
  ) async {
    await tester.pumpWidget(_frame(DealTimelineView(deal: _multiDealer())));
    await tester.pumpAndSettle();

    expect(find.text('Dealer A'), findsOneWidget);
    expect(find.text('Dealer B'), findsOneWidget);
    expect(find.text('Dealer C'), findsOneWidget);
    expect(find.textContaining('transparency view'), findsOneWidget);
    expect(find.text('\$33,415'), findsWidgets);
    expect(find.text('out the door'), findsNWidgets(2));
    expect(find.text('Down \$1,705 from the last round'), findsOneWidget);
    expect(find.text('Down \$2,097 from the last round'), findsOneWidget);
    expect(find.text('Offer received'), findsWidgets);
    expect(find.text('Finding your best price'), findsOneWidget);
    expect(find.text('No response'), findsOneWidget);
    expect(
      find.text('No written quote yet. Drevvy is still waiting on an itemized out-the-door price.'),
      findsOneWidget,
    );
    expect(find.text('Vehicle price'), findsWidgets);
    expect(find.text('Down from \$31,200'), findsOneWidget);

    final struck = tester
        .widgetList<Text>(find.text('Nitrogen fill'))
        .where((text) => text.style?.decoration == TextDecoration.lineThrough);
    expect(struck, isNotEmpty);
    final paint = tester
        .widgetList<Text>(find.text('Paint protection'))
        .where((text) => text.style?.decoration == TextDecoration.lineThrough);
    expect(paint, isNotEmpty);

    expect(find.textContaining('negotiate'), findsNothing);
  });

  test('shopper timeline copy says transparency and never negotiate', () {
    const files = [
      'lib/features/deals/screens/deal_timeline_screen.dart',
      'lib/features/deals/screens/deal_detail_screen.dart',
      'lib/core/router/router.dart',
    ];
    final detail = File('lib/features/deals/screens/deal_detail_screen.dart').readAsStringSync();
    final router = File('lib/core/router/router.dart').readAsStringSync();
    expect(detail.contains('/deal/\${deal.id}/timeline'), isTrue);
    expect(detail.contains('Dealership timeline'), isTrue);
    expect(router.contains('/deal/:dealId/timeline'), isTrue);

    for (final path in files) {
      final text = File(path).readAsStringSync().toLowerCase();
      expect(text.contains('negotiate'), isFalse, reason: path);
    }
    final timeline = File(files.first).readAsStringSync().toLowerCase();
    expect(timeline.contains('transparency'), isTrue);
  });
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    ),
  );
}

Deal _multiDealer() {
  return _deal(
    timelines: [
      DealerTimeline(
        letter: 'A',
        status: DealStatus.offerReceived,
        rounds: [
          DealerQuoteRound(
            id: 'a1',
            round: 1,
            receivedAt: DateTime(2026, 10, 1, 9),
            otd: 36450,
            vehiclePrice: 32100,
            lines: const [
              OfferLine(key: 'Vehicle price', amount: 32100),
              OfferLine(key: 'Paint protection', amount: 895),
              OfferLine(key: 'Nitrogen fill', amount: 199),
            ],
          ),
          DealerQuoteRound(
            id: 'a2',
            round: 2,
            receivedAt: DateTime(2026, 10, 3, 9),
            otd: 35120,
            vehiclePrice: 31200,
            lines: const [OfferLine(key: 'Vehicle price', amount: 31200)],
            removedFees: const [OfferLine(key: 'Nitrogen fill', amount: 199)],
          ),
          DealerQuoteRound(
            id: 'a3',
            round: 3,
            receivedAt: DateTime(2026, 10, 5, 9),
            otd: 33415,
            vehiclePrice: 30700,
            lines: const [
              OfferLine(
                key: 'Vehicle price',
                amount: 30700,
                subLine: 'Down from \$31,200',
              ),
            ],
            removedFees: const [
              OfferLine(key: 'Paint protection', amount: 895),
              OfferLine(key: 'Nitrogen fill', amount: 199),
            ],
          ),
        ],
      ),
      DealerTimeline(
        letter: 'B',
        status: DealStatus.findingBestPrice,
        rounds: [
          DealerQuoteRound(
            id: 'b1',
            round: 1,
            receivedAt: DateTime(2026, 10, 2, 11),
            otd: 36977,
            vehiclePrice: 32950,
            lines: const [OfferLine(key: 'Vehicle price', amount: 32950)],
          ),
          DealerQuoteRound(
            id: 'b2',
            round: 2,
            receivedAt: DateTime(2026, 10, 4, 11),
            otd: 34880,
            vehiclePrice: 32100,
            lines: const [OfferLine(key: 'Vehicle price', amount: 32100)],
            removedFees: const [
              OfferLine(key: 'Paint protection', amount: 895),
              OfferLine(key: 'Nitrogen fill', amount: 199),
            ],
          ),
        ],
      ),
      const DealerTimeline(
        letter: 'C',
        status: DealStatus.noResponse,
      ),
    ],
  );
}

Deal _deal({List<DealerTimeline> timelines = const []}) {
  return Deal(
    id: 'deal_test',
    listingId: 'listing_001',
    letter: 'A',
    status: DealStatus.offerReceived,
    listedAtStart: 32995,
    addedAt: DateTime(2026, 10, 1),
    listing: const Listing(
      id: 'listing_001',
      vin: '2T3P1RFV8RW123456',
      price: 32995,
      miles: 18420,
      build: ListingBuild(
        year: 2024,
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE',
        bodyType: 'SUV',
        drivetrain: 'AWD',
      ),
      media: ListingMedia(photoLinks: []),
    ),
    offers: [
      Offer(
        id: 'offer_test',
        receivedAt: DateTime(2026, 10, 2),
        otd: 23100,
        vehiclePrice: 20500,
        lines: const [OfferLine(key: 'Vehicle price', amount: 20500)],
      ),
    ],
    dealerTimelines: timelines,
  );
}
