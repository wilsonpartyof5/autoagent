import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/rooftop_match_endpoint.dart';
import 'package:drevvy_app/features/shop/widgets/dealer_chat_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/dealer_inbox_stub.dart';
import 'package:drevvy_app/features/shop/widgets/otd_request_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/vdp_cta_bar.dart';
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
  const offNetwork = Listing(
    id: 'listing_002',
    vin: 'VIN456',
    price: 31490,
    build: ListingBuild(year: 2024, make: 'Honda', model: 'CR-V'),
    media: ListingMedia(photoLinks: []),
  );

  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(400, 1200);
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

  testWidgets('in-network VDP shows chat CTA and never talk-to-dealer copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        VdpCtaBar(
          listing: listing,
          creditBalance: const CarCreditBalance.withBalance(6),
          match: StubRooftopMatchEndpoint.stubFor(listing),
          marketIntelUnlocked: false,
          conversationOpen: false,
          otdRequested: false,
          onMarketIntel: () {},
          onConversation: () {},
          onOtdRequest: () {},
        ),
      ),
    );

    expect(find.text(KeySpend.marketIntelCta), findsOneWidget);
    expect(find.text(KeySpend.conversationCta), findsOneWidget);
    expect(find.text(KeySpend.otdRequestCta), findsNothing);
    expect(find.textContaining('talk to dealer'), findsNothing);
    expect(find.textContaining('negotiat'), findsNothing);
  });

  testWidgets('off-network VDP shows a free OTD form CTA, not chat', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        VdpCtaBar(
          listing: offNetwork,
          creditBalance: const CarCreditBalance.withBalance(6),
          match: StubRooftopMatchEndpoint.stubFor(offNetwork),
          marketIntelUnlocked: false,
          conversationOpen: false,
          otdRequested: false,
          onMarketIntel: () {},
          onConversation: () {},
          onOtdRequest: () {},
        ),
      ),
    );

    expect(find.text(KeySpend.marketIntelCta), findsOneWidget);
    expect(find.text(KeySpend.conversationCta), findsNothing);
    expect(find.text(KeySpend.otdRequestCta), findsOneWidget);
    expect(find.textContaining('Free · no key'), findsWidgets);
    expect(find.textContaining('talk to dealer'), findsNothing);
  });

  testWidgets('OTD sheet is a free form and does not spend a key', (
    tester,
  ) async {
    var submitted = false;
    await tester.pumpWidget(
      _frame(
        OtdRequestSheet(
          listing: offNetwork,
          alreadyRequested: false,
          onConfirm: ({note}) async {
            submitted = true;
          },
        ),
      ),
    );

    expect(find.text(KeySpend.otdRequestFreeBadge), findsOneWidget);
    expect(find.textContaining('not a chat'), findsOneWidget);
    expect(find.textContaining('no conversation key'), findsOneWidget);
    await tester.tap(find.text('Submit request'));
    await tester.pump();
    expect(submitted, isTrue);
  });

  testWidgets('dealer inbox stub shows first name only and the close fee', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        DealerInboxStub(
          shopperFirstName: 'Dana Wilson',
          listing: listing,
        ),
      ),
    );

    expect(find.text('Dana'), findsOneWidget);
    expect(find.text('Dana Wilson'), findsNothing);
    expect(find.textContaining('first name only'), findsWidgets);
    expect(find.textContaining(r'$300'), findsOneWidget);
    expect(find.textContaining('dealer pays'), findsOneWidget);
  });

  testWidgets('in-network chat sheet states confirmed-delivery refund clock', (
    tester,
  ) async {
    await tester.pumpWidget(
      _frame(
        DealerChatSheet(
          listing: listing,
          match: const RooftopMatch(
            matched: true,
            rooftopId: 'rooftop_demo_springfield',
          ),
          creditBalance: const CarCreditBalance.withBalance(4),
          alreadyOpen: false,
          shopperFirstName: 'Dana',
          onSend: ({templateId, message}) async {},
        ),
      ),
    );

    expect(find.text(KeySpend.conversationCta), findsOneWidget);
    expect(find.textContaining('confirmed delivery'), findsWidgets);
    expect(find.text('Itemized OTD'), findsOneWidget);
    expect(find.text('Still available?'), findsNothing);
    expect(find.textContaining('negotiat'), findsNothing);
    expect(find.text('Dana'), findsWidgets);
    expect(find.textContaining(r'$300'), findsWidgets);
    expect(find.textContaining('talk to dealer'), findsNothing);
  });

  test('off-network conversation is refused and OTD does not spend a key', () async {
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(6),
    );
    final before = await repo.getCreditBalance();
    final deal = await repo.startDealerConversation(
      offNetwork,
      const RooftopMatch.offNetwork(),
    );
    expect(deal, isNull);
    expect((await repo.getCreditBalance()).balance, before.balance);

    final ok = await repo.requestOtdNumber(offNetwork, note: 'need OTD');
    expect(ok, isTrue);
    expect(repo.hasRequestedOtd(offNetwork.id), isTrue);
    expect((await repo.getCreditBalance()).balance, before.balance);
  });

  test('in-network conversation spends one key; OTD still does not', () async {
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(4),
    );
    final match = StubRooftopMatchEndpoint.stubFor(listing);
    final deal = await repo.startDealerConversation(listing, match);
    expect(deal, isNotNull);
    expect((await repo.getCreditBalance()).balance, 3);

    await repo.requestOtdNumber(offNetwork);
    expect((await repo.getCreditBalance()).balance, 3);
  });
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}
