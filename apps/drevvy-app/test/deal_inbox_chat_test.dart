import 'dart:io';

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/deal.dart';
import 'package:drevvy_app/data/models/deal_brain_chip.dart';
import 'package:drevvy_app/data/models/deal_chip_inputs.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/deal_chips_endpoint.dart';
import 'package:drevvy_app/features/deals/widgets/ask_drevvy_sheet.dart';
import 'package:drevvy_app/features/deals/widgets/deal_card.dart';
import 'package:drevvy_app/features/deals/widgets/deal_dealer_chat.dart';
import 'package:drevvy_app/features/shop/widgets/dealer_chat_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
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

  testWidgets(
    'inbox helper opens DealerChatSheet with dealId, chipInputs, and chipsEndpoint',
    (tester) async {
      final endpoint = _FakeChips((dealId, inputs) async {
        expect(dealId, 'deal_inbox');
        expect(inputs.ready, isTrue);
        expect(inputs.stockNumber, 'T12345');
        expect(inputs.feature, 'Heated Seats');
        return const DealChipSuggestionSet(
          network: 'in_network',
          stage: 'after_opener',
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
          ],
        );
      });
      final repo = DemoRepository(
        networkDelay: Duration.zero,
        dealChips: endpoint,
      );
      repo.rememberDealMessage('deal_inbox', body: 'Hi, still available?');
      final deal = _inNetworkDeal();

      await tester.pumpWidget(_frame(const SizedBox.shrink()));
      final context = tester.element(find.byType(SizedBox));
      final opened = await openDealDealerChat(
        context: context,
        repo: repo,
        deal: deal,
        match: deal.listing.rooftopMatch,
        creditBalance: const CarCreditBalance.withBalance(6),
        shopperFirstName: 'Dana',
        market: deal.marketContext,
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(opened, isTrue);
      expect(find.byType(DealerChatSheet), findsOneWidget);
      expect(find.byType(AskDrevvySheet), findsNothing);
      expect(find.text(KeySpend.conversationCta), findsOneWidget);
      expect(find.text('Thanks'), findsOneWidget);
      expect(find.text('Your hours?'), findsOneWidget);
      expect(find.text('Itemized OTD'), findsNothing);

      final sheet = tester.widget<DealerChatSheet>(
        find.byType(DealerChatSheet),
      );
      expect(sheet.dealId, 'deal_inbox');
      expect(sheet.alreadyOpen, isTrue);
      expect(sheet.chipInputs, isNotNull);
      expect(sheet.chipInputs!.ready, isTrue);
      expect(sheet.chipsEndpoint, same(repo.dealChips));
      expect(endpoint.calls, isNotEmpty);
      expect(endpoint.calls.single.$1, 'deal_inbox');
    },
  );

  testWidgets(
    'send starts the conversation even when it has not been started yet',
    (tester) async {
      final endpoint = _FakeChips(
        (dealId, inputs) async => const DealChipSuggestionSet(
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
      final repo = DemoRepository(
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(6),
        dealChips: endpoint,
      );
      final deal = _inNetworkDeal();
      expect(repo.hasStartedConversation(deal.listing.id), isFalse);

      await tester.pumpWidget(_frame(const SizedBox.shrink()));
      final opened = await openDealDealerChat(
        context: tester.element(find.byType(SizedBox)),
        repo: repo,
        deal: deal,
        match: deal.listing.rooftopMatch,
        creditBalance: const CarCreditBalance.withBalance(6),
        shopperFirstName: 'Dana',
        market: deal.marketContext,
      );
      await tester.pump();
      expect(opened, isTrue);

      final sheet = tester.widget<DealerChatSheet>(
        find.byType(DealerChatSheet),
      );
      await tester.runAsync(() async {
        await sheet.onSend(templateId: 'T7', message: 'Thanks, that helps!');
        expect((await repo.getCreditBalance()).balance, 5);
      });

      expect(repo.hasStartedConversation(deal.listing.id), isTrue);
      expect(
        repo.dealThread(deal.id).map((message) => message.body),
        contains('Thanks, that helps!'),
      );
    },
  );

  testWidgets('off-network inbox helper does not open DealerChatSheet', (
    tester,
  ) async {
    final repo = DemoRepository(networkDelay: Duration.zero);
    await tester.pumpWidget(_frame(const SizedBox.shrink()));
    final context = tester.element(find.byType(SizedBox));
    final opened = await openDealDealerChat(
      context: context,
      repo: repo,
      deal: _offNetworkDeal(),
      match: const RooftopMatch.offNetwork(),
      creditBalance: const CarCreditBalance.withBalance(6),
      shopperFirstName: 'Dana',
    );
    await tester.pump();

    expect(opened, isFalse);
    expect(find.byType(DealerChatSheet), findsNothing);
  });

  testWidgets('inbox deal card Ask control is wired for active deals', (
    tester,
  ) async {
    var asked = false;
    await tester.pumpWidget(
      _frame(
        DealCard(
          deal: _inNetworkDeal(),
          onTap: () {},
          onAsk: () => asked = true,
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('deal-inbox-ask-deal_inbox')));
    await tester.pump();
    expect(asked, isTrue);
  });

  test('inbox and deal-detail Ask route through openDealDealerChat', () {
    const files = [
      'lib/features/deals/screens/deal_detail_screen.dart',
      'lib/features/deals/screens/deals_screen.dart',
      'lib/features/deals/widgets/deal_dealer_chat.dart',
    ];
    for (final path in files) {
      final text = File(path).readAsStringSync();
      expect(text.contains('openDealDealerChat'), isTrue, reason: path);
      expect(text.toLowerCase().contains('negotiate'), isFalse, reason: path);
    }
    final helper = File('lib/features/deals/widgets/deal_dealer_chat.dart')
        .readAsStringSync();
    expect(helper.contains('chipInputs:'), isTrue);
    expect(helper.contains('chipsEndpoint: repo.dealChips'), isTrue);
    expect(helper.contains('dealId: deal.id'), isTrue);
    expect(helper.contains('alreadyOpen: true'), isTrue);
    expect(helper.contains('await repo.startDealerConversation'), isTrue);
    expect(helper.contains('hasStartedConversation'), isFalse);
    final detail = File('lib/features/deals/screens/deal_detail_screen.dart')
        .readAsStringSync();
    expect(detail.contains('deal-detail-ask'), isTrue);
    expect(detail.contains('_showDealerChat'), isTrue);
    expect(detail.contains('AskDrevvySheet'), isTrue);
    final inbox = File('lib/features/deals/screens/deals_screen.dart')
        .readAsStringSync();
    expect(inbox.contains('onAsk:'), isTrue);
    expect(inbox.contains('_openDealChat'), isTrue);
  });
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: child),
  );
}

Deal _inNetworkDeal() {
  return Deal(
    id: 'deal_inbox',
    listingId: 'listing_inbox',
    letter: 'A',
    status: DealStatus.reachingOut,
    listedAtStart: 32995,
    addedAt: DateTime.now(),
    listing: const Listing(
      id: 'listing_inbox',
      vin: 'VININBOX',
      stockNo: 'T12345',
      price: 32995,
      media: ListingMedia(photoLinks: []),
      build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
      extra: ListingExtra(highValueFeatures: ['Heated Seats']),
      rooftopMatch: RooftopMatch(
        matched: true,
        rooftopId: 'rooftop_demo_springfield',
      ),
    ),
    marketContext: const MarketContext(
      fairVehiclePrice: 31900,
      fairOtd: 34800,
      lowPrice: 30500,
      medianPrice: 32200,
      highPrice: 34000,
      comparablesCount: 6,
    ),
  );
}

Deal _offNetworkDeal() {
  return Deal(
    id: 'deal_off',
    listingId: 'listing_off',
    letter: 'B',
    status: DealStatus.findingBestPrice,
    listedAtStart: 31490,
    addedAt: DateTime.now(),
    listing: const Listing(
      id: 'listing_off',
      vin: 'VINOFF',
      price: 31490,
      media: ListingMedia(photoLinks: []),
      build: ListingBuild(year: 2024, make: 'Honda', model: 'CR-V'),
    ),
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
