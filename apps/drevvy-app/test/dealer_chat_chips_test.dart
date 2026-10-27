import 'dart:async';

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/deal_brain_chip.dart';
import 'package:drevvy_app/data/models/deal_chip_inputs.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/services/deal_chips_endpoint.dart';
import 'package:drevvy_app/features/shop/widgets/dealer_chat_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const listing = Listing(
    id: 'listing_001',
    vin: 'VIN123',
    price: 32995,
    build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
  );
  const market = MarketContext(
    fairVehiclePrice: 31900,
    fairOtd: 34800,
    lowPrice: 30500,
    medianPrice: 32200,
    highPrice: 34000,
    comparablesCount: 6,
  );

  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(400, 1600);
    view.devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  testWidgets('loaded chips render, stay unsent, and hide haggle copy', (
    tester,
  ) async {
    final sends = <({String? templateId, String? message})>[];
    final endpoint = _FakeChips((dealId, inputs) async {
      expect(dealId, 'deal-1');
      expect(inputs.ready, isTrue);
      return const DealChipSuggestionSet(
        network: 'in_network',
        stage: 'after_itemized_otd',
        chips: [
          DealBrainChip(
            templateId: 'T7',
            label: 'Thanks',
            message: 'Thanks, that helps!',
          ),
          DealBrainChip(
            templateId: 'T10',
            label: 'Your hours?',
            message: 'What are your hours this week?',
          ),
          DealBrainChip(
            templateId: 'T9',
            label: 'Negotiate',
            message: 'Can we negotiate the price?',
          ),
          DealBrainChip(
            templateId: 'T11',
            label: 'Haggle',
            message: 'Let us haggle on fees.',
          ),
          DealBrainChip(
            templateId: 'T12',
            label: 'Bargain',
            message: 'Will you bargain with me?',
          ),
        ],
      );
    });

    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: endpoint,
          inputs: DealChipInputs.loaded(
            market: market,
            messages: const [
              DealThreadMessage(
                author: 'salesperson',
                body: 'Here is the itemized out-the-door price.',
              ),
            ],
            feature: 'heated seats',
            visitDay: 'Saturday',
            visitTime: '2pm',
            stockNumber: 'T12345',
            listedPrice: 32995,
          ),
          onSend: ({templateId, message}) async {
            sends.add((templateId: templateId, message: message));
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Thanks'), findsOneWidget);
    expect(find.text('Your hours?'), findsOneWidget);
    expect(find.text('Itemized OTD'), findsNothing);
    expect(find.text('Negotiate'), findsNothing);
    expect(find.text('Haggle'), findsNothing);
    expect(find.text('Bargain'), findsNothing);
    expect(sends, isEmpty);

    final state = tester.state<DealerChatSheetState>(
      find.byType(DealerChatSheet),
    );
    expect(state.autoSend, isFalse);
    expect(state.chipsStatus, DealerChatChipsStatus.loaded);
    _expectNoHaggle(tester, state);

    await tester.tap(find.text('Thanks'));
    await tester.pump();
    expect(sends, isEmpty);
    expect(find.text('Thanks, that helps!'), findsOneWidget);
    final composer = tester.widget<TextField>(
      find.byKey(const Key('dealer-chat-composer')),
    );
    expect(composer.controller?.text, 'Thanks, that helps!');

    await tester.ensureVisible(find.byKey(const Key('dealer-chat-send')));
    await tester.tap(find.byKey(const Key('dealer-chat-send')));
    await tester.pump();
    expect(sends, hasLength(1));
    expect(sends.single.templateId, 'T7');
    expect(sends.single.message, 'Thanks, that helps!');
    expect(state.autoSend, isFalse);
  });

  testWidgets('loading keeps the after-opener pair and does not send', (
    tester,
  ) async {
    final pending = Completer<DealChipSuggestionSet?>();
    final sends = <String>[];
    final endpoint = _FakeChips((dealId, inputs) => pending.future);

    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: endpoint,
          inputs: DealChipInputs.loaded(market: market, stockNumber: 'R44118'),
          onSend: ({templateId, message}) async {
            sends.add(message ?? '');
          },
        ),
      ),
    );

    final state = tester.state<DealerChatSheetState>(
      find.byType(DealerChatSheet),
    );
    expect(state.chipsStatus, DealerChatChipsStatus.loading);
    expect(state.autoSend, isFalse);
    expect(find.text('Itemized OTD'), findsOneWidget);
    expect(find.text('Still available?'), findsOneWidget);
    expect(sends, isEmpty);
    _expectNoHaggle(tester, state);

    pending.complete(
      const DealChipSuggestionSet(
        network: 'in_network',
        stage: 'after_opener',
        chips: [
          DealBrainChip(
            templateId: 'T7',
            label: 'Thanks',
            message: 'Thanks, that helps!',
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
    expect(state.chipsStatus, DealerChatChipsStatus.loaded);
    expect(find.text('Thanks'), findsOneWidget);
    expect(sends, isEmpty);
  });

  testWidgets('an error or a thrown client falls back to the opener pair', (
    tester,
  ) async {
    final sends = <String>[];
    final missing = _FakeChips((dealId, inputs) async => null);

    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: missing,
          inputs: DealChipInputs.loaded(market: market),
          onSend: ({templateId, message}) async {
            sends.add(message ?? '');
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    var state = tester.state<DealerChatSheetState>(
      find.byType(DealerChatSheet),
    );
    expect(state.chipsStatus, DealerChatChipsStatus.error);
    expect(state.autoSend, isFalse);
    expect(find.text('Itemized OTD'), findsOneWidget);
    expect(find.text('Still available?'), findsNothing);
    expect(sends, isEmpty);
    _expectNoHaggle(tester, state);

    final broken = _FakeChips((dealId, inputs) async {
      throw StateError('chips down');
    });
    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: broken,
          inputs: DealChipInputs.loaded(market: market),
          onSend: ({templateId, message}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    state = tester.state<DealerChatSheetState>(find.byType(DealerChatSheet));
    expect(state.chipsStatus, DealerChatChipsStatus.error);
    expect(state.autoSend, isFalse);
    expect(find.text('Itemized OTD'), findsOneWidget);
    _expectNoHaggle(tester, state);
  });

  testWidgets('fallback while inputs load, then refresh when they change', (
    tester,
  ) async {
    final endpoint = _FakeChips((dealId, inputs) async {
      if (inputs.feature == null) {
        return const DealChipSuggestionSet(
          network: 'in_network',
          stage: 'after_opener',
          chips: [DealBrainChip.itemizedOtd],
        );
      }
      return const DealChipSuggestionSet(
        network: 'in_network',
        stage: 'after_itemized_otd',
        chips: [
          DealBrainChip(
            templateId: 'T9',
            label: 'Ask about feature',
            message: 'Quick question: does it have heated seats?',
          ),
          DealBrainChip(
            templateId: 'T12',
            label: 'Plan a visit',
            message: "I'd like to see it. Is Saturday at 2pm open?",
          ),
        ],
      );
    });

    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: endpoint,
          inputs: const DealChipInputs(
            threadLoaded: false,
            marketLoaded: true,
            featureLoaded: false,
            visitLoaded: false,
          ),
          onSend: ({templateId, message}) async {},
        ),
      ),
    );

    var state = tester.state<DealerChatSheetState>(
      find.byType(DealerChatSheet),
    );
    expect(endpoint.calls, isEmpty);
    expect(state.chipsStatus, DealerChatChipsStatus.fallback);
    expect(state.autoSend, isFalse);
    expect(find.text('Itemized OTD'), findsOneWidget);
    _expectNoHaggle(tester, state);

    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: endpoint,
          inputs: DealChipInputs.loaded(
            market: market,
            feature: 'heated seats',
            visitDay: 'Saturday',
            visitTime: '2pm',
            stockNumber: 'T12345',
            listedPrice: 32995,
            dom: 18,
            messages: const [
              DealThreadMessage(author: 'dealer', body: 'Yes, it is here.'),
            ],
          ),
          onSend: ({templateId, message}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    state = tester.state<DealerChatSheetState>(find.byType(DealerChatSheet));
    expect(endpoint.calls, hasLength(1));
    final body = endpoint.calls.single.$2.toRequestBody();
    expect(body['messages'], [
      {'author': 'dealer', 'body': 'Yes, it is here.'},
    ]);
    expect(body['intel'], {
      'stockNumber': 'T12345',
      'listedPrice': 32995,
      'fairPrice': 31900,
      'compsCount': 6,
      'compsLowPrice': 30500,
      'dom': 18,
      'feature': 'heated seats',
      'visitDay': 'Saturday',
      'visitTime': '2pm',
    });
    expect(find.text('Ask about feature'), findsOneWidget);
    expect(find.text('Plan a visit'), findsOneWidget);
    expect(find.text('Itemized OTD'), findsNothing);
    expect(state.chipsStatus, DealerChatChipsStatus.loaded);
    expect(state.autoSend, isFalse);
    _expectNoHaggle(tester, state);

    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          endpoint: endpoint,
          inputs: DealChipInputs.loaded(
            market: market,
            feature: 'heated seats',
            visitDay: 'Sunday',
            visitTime: '11am',
          ),
          onSend: ({templateId, message}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(endpoint.calls, hasLength(2));
    final refreshed = endpoint.calls.last.$2.toRequestBody()['intel'] as Map;
    expect(refreshed['visitDay'], 'Sunday');
    expect(refreshed['visitTime'], '11am');
    expect(state.autoSend, isFalse);
  });

  testWidgets('no deal id keeps the opener pair and does not call the route', (
    tester,
  ) async {
    final endpoint = _FakeChips((dealId, inputs) async {
      throw StateError('should not fetch');
    });
    await tester.pumpWidget(
      _frame(
        _sheet(
          listing: listing,
          dealId: null,
          endpoint: endpoint,
          inputs: DealChipInputs.loaded(market: market, stockNumber: 'T12345'),
          onSend: ({templateId, message}) async {},
        ),
      ),
    );

    final state = tester.state<DealerChatSheetState>(
      find.byType(DealerChatSheet),
    );
    expect(endpoint.calls, isEmpty);
    expect(state.chipsStatus, DealerChatChipsStatus.fallback);
    expect(state.autoSend, isFalse);
    expect(find.text('Itemized OTD'), findsOneWidget);
    expect(find.text('Still available?'), findsOneWidget);
    _expectNoHaggle(tester, state);
  });
}

void _expectNoHaggle(WidgetTester tester, DealerChatSheetState state) {
  final words = RegExp(r'negotiat|haggl|bargain', caseSensitive: false);
  expect(find.textContaining(words), findsNothing);
  expect(state.autoSend, isFalse);
  for (final chip in state.visibleChips) {
    expect(words.hasMatch(chip.label), isFalse, reason: chip.label);
    expect(words.hasMatch(chip.message), isFalse, reason: chip.message);
    expect(chip.message.toLowerCase(), isNot(contains('negotiat')));
    expect(chip.message.toLowerCase(), isNot(contains('haggl')));
    expect(chip.message.toLowerCase(), isNot(contains('bargain')));
  }
}

Widget _sheet({
  required Listing listing,
  required DealChipInputs inputs,
  required DealChipsEndpoint endpoint,
  required Future<void> Function({String? templateId, String? message}) onSend,
  String? dealId = 'deal-1',
}) {
  return DealerChatSheet(
    listing: listing,
    match: const RooftopMatch(
      matched: true,
      rooftopId: 'rooftop_demo_springfield',
    ),
    creditBalance: const CarCreditBalance.withBalance(4),
    alreadyOpen: true,
    shopperFirstName: 'Dana Wilson',
    dealId: dealId,
    chipInputs: inputs,
    chipsEndpoint: endpoint,
    onSend: onSend,
  );
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

class _FakeChips extends DealChipsEndpoint {
  _FakeChips(this._onSuggest);

  final Future<DealChipSuggestionSet?> Function(
    String dealId,
    DealChipInputs inputs,
  )
  _onSuggest;
  final calls = <(String, DealChipInputs)>[];

  @override
  Future<DealChipSuggestionSet?> suggest(String dealId, DealChipInputs inputs) {
    calls.add((dealId, inputs));
    return _onSuggest(dealId, inputs);
  }
}
