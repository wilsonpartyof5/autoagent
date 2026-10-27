import 'dart:convert';

import 'package:drevvy_app/data/models/deal_brain_chip.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/deal_chips_endpoint.dart';
import 'package:drevvy_app/data/services/key_spend_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/rooftop_match_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const listing = Listing(
    id: 'listing_001',
    vin: 'VIN123',
    stockNo: 'T12345',
    price: 32995,
    build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
  );
  const market = MarketContext(
    fairVehiclePrice: 33900,
    fairOtd: 37400,
    lowPrice: 30400,
    medianPrice: 34600,
    highPrice: 38200,
    comparablesCount: 14,
  );

  test('empty API base URL skips the network', () {
    expect(
      DealChipsEndpoint.fromConfig(const PurchaseConfig()),
      isA<MissingDealChipsEndpoint>(),
    );
  });

  test('live chips POST intel and parse the after-opener pair', () async {
    late Map<String, dynamic> body;
    final client = MockClient((request) async {
      expect(request.url.path, '/api/consumer/deals/deal_live/chips');
      expect(request.method, 'POST');
      expect(request.headers['Authorization'], 'Bearer shopper-jwt');
      body = jsonDecode(request.body) as Map<String, dynamic>;
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'network': 'in_network',
            'stage': 'after_opener',
            'autoSend': false,
            'chips': [
              {
                'id': 'T6',
                'templateId': 'T6',
                'label': 'Itemized OTD',
                'message': DealBrainChip.itemizedOtd.message,
                'sendsAutomatically': false,
              },
              {
                'id': 'T1',
                'templateId': 'T1',
                'label': 'Still available?',
                'message': 'Hi, is stock #T12345 still available?',
                'sendsAutomatically': false,
              },
            ],
          },
        }),
        200,
      );
    });
    final endpoint = HttpDealChipsEndpoint(
      baseUrl: 'https://api.drevvy.com/',
      client: client,
      sessionStore: ShopperSessionStore()
        ..save(const ShopperSession(accessToken: 'shopper-jwt')),
    );

    final set = await endpoint.suggest(
      dealId: 'deal_live',
      intel: ChipIntel.fromDealContext(listing: listing, market: market),
    );
    expect(set, isNotNull);
    expect(set!.autoSend, isFalse);
    expect(set.chips.map((chip) => chip.templateId), ['T6', 'T1']);
    expect(body['intel'], {
      'stockNumber': 'T12345',
      'listedPrice': 32995,
      'fairPrice': 33900,
      'compsCount': 14,
      'compsLowPrice': 30400,
    });
  });

  test('a missing chips route returns null so the app uses the local pair', () async {
    final endpoint = HttpDealChipsEndpoint(
      baseUrl: 'https://api.drevvy.com',
      sessionStore: ShopperSessionStore(),
      client: MockClient((request) async => http.Response('', 404)),
    );
    expect(await endpoint.suggest(dealId: 'deal_1'), isNull);
  });

  test('repository uses live chips for an open deal and the local pair otherwise', () async {
    final endpoint = _FakeDealChipsEndpoint();
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      chips: endpoint,
      rooftopMatch: const StubRooftopMatchEndpoint(),
      keySpend: const MissingKeySpendEndpoint(),
    );

    final local = await repo.dealerChatChips(listing: listing, market: market);
    expect(local.map((chip) => chip.templateId), ['T6', 'T1']);
    expect(endpoint.calls, isEmpty);

    final deal = await repo.startDealerConversation(
      listing,
      StubRooftopMatchEndpoint.stubFor(listing),
    );
    expect(deal, isNotNull);
    expect(repo.conversationDealId(listing.id), deal!.id);

    final live = await repo.dealerChatChips(
      listing: listing,
      market: market,
      visitDay: 'Saturday',
      visitTime: '2pm',
    );
    expect(live.map((chip) => chip.templateId), ['T7', 'T8']);
    expect(endpoint.calls.single.dealId, deal.id);
    expect(endpoint.calls.single.intel?.visitDay, 'Saturday');
    expect(endpoint.calls.single.intel?.visitTime, '2pm');
    expect(endpoint.calls.single.intel?.listedPrice, 32995);
  });

  test('repository keeps the after-opener pair when live chips are missing', () async {
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      chips: const MissingDealChipsEndpoint(),
    );
    await repo.startDealerConversation(
      listing,
      StubRooftopMatchEndpoint.stubFor(listing),
    );
    final chips = await repo.dealerChatChips(listing: listing);
    expect(chips.map((chip) => chip.templateId), ['T6', 'T1']);
  });
}

class _FakeDealChipsEndpoint extends DealChipsEndpoint {
  final calls = <({String dealId, ChipIntel? intel})>[];

  @override
  Future<ChipSuggestionSet?> suggest({
    required String dealId,
    ChipIntel? intel,
    String? stage,
    List<ChipThreadMessage>? messages,
  }) async {
    calls.add((dealId: dealId, intel: intel));
    return const ChipSuggestionSet(
      stage: 'after_itemized_otd',
      chips: [DealBrainChip.thanks, DealBrainChip.thinking],
    );
  }
}
