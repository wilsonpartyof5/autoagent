import 'dart:convert';

import 'package:drevvy_app/data/models/deal_brain_chip.dart';
import 'package:drevvy_app/data/models/deal_chip_inputs.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/services/deal_chips_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const inputs = DealChipInputs(
    threadLoaded: true,
    marketLoaded: true,
    featureLoaded: true,
    visitLoaded: true,
    messages: [
      DealThreadMessage(
        author: 'shopper',
        body: 'Is stock #T12345 still available?',
      ),
    ],
    stockNumber: 'T12345',
    listedPrice: 32995,
    fairPrice: 31900,
    compsCount: 6,
    compsLowPrice: 30500,
    dom: 18,
    feature: 'heated seats',
    visitDay: 'Saturday',
    visitTime: '2pm',
  );

  test('empty base URL does not call the network', () {
    expect(
      DealChipsEndpoint.fromConfig(const PurchaseConfig()),
      isA<MissingDealChipsEndpoint>(),
    );
  });

  test('posts loaded intel and ignores autoSend true', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'network': 'in_network',
            'stage': 'after_itemized_otd',
            'autoSend': true,
            'chips': [
              {
                'id': 'T7',
                'templateId': 'T7',
                'label': 'Thanks',
                'message': 'Thanks, that helps!',
                'sendsAutomatically': true,
              },
              {
                'id': 'T9',
                'templateId': 'T9',
                'label': 'Negotiate',
                'message': 'Can we negotiate?',
                'sendsAutomatically': false,
              },
            ],
          },
        }),
        200,
      );
    });
    final session = ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'shopper-jwt');
    final endpoint = HttpDealChipsEndpoint(
      baseUrl: 'https://api.drevvy.com/',
      client: client,
      sessionStore: session,
    );

    final set = await endpoint.suggest('deal-1', inputs);
    expect(set, isNotNull);
    expect(set!.autoSend, isFalse);
    expect(set.network, 'in_network');
    expect(set.stage, 'after_itemized_otd');
    expect(set.chips.map((chip) => chip.templateId), ['T7']);
    expect(set.chips.single.message, 'Thanks, that helps!');
    expect(requests, hasLength(1));
    expect(requests.single.method, 'POST');
    expect(requests.single.url.path, '/api/consumer/deals/deal-1/chips');
    expect(requests.single.headers['Authorization'], 'Bearer shopper-jwt');
    expect(jsonDecode(requests.single.body), inputs.toRequestBody());
  });

  test('a missing route, an error, or unread inputs return null', () async {
    final requests = <http.Request>[];
    var status = 404;
    final client = MockClient((request) async {
      requests.add(request);
      return http.Response('{}', status);
    });
    final endpoint = HttpDealChipsEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: client,
      sessionStore: ShopperSessionStore(),
    );

    expect(await endpoint.suggest('deal-1', inputs), isNull);
    status = 500;
    expect(await endpoint.suggest('deal-1', inputs), isNull);
    status = 409;
    expect(await endpoint.suggest('deal-1', inputs), isNull);
    expect(
      await endpoint.suggest(
        'deal-1',
        const DealChipInputs(threadLoaded: true),
      ),
      isNull,
    );
    expect(requests, hasLength(3));
  });

  test(
    'feature phrases come from the listing and haggle phrases are dropped',
    () {
      const listing = Listing(
        id: 'listing_001',
        vin: 'VIN',
        price: 10000,
        build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
        media: ListingMedia(photoLinks: []),
        extra: ListingExtra(
          highValueFeatures: ['let us negotiate', 'Heated Seats'],
        ),
      );
      expect(DealChipInputs.featureFromListing(listing), 'Heated Seats');
      expect(DealBrainChip.cleanPhrase('let us haggle'), isNull);
      expect(
        DealBrainChip.copyAllowed('Thanks', 'Thanks, that helps!'),
        isTrue,
      );
      expect(
        DealBrainChip.copyAllowed('Bargain', 'Will you bargain?'),
        isFalse,
      );
      for (final chip in DealBrainChip.suggestionsFor(stockNumber: 'T12345')) {
        expect(DealBrainChip.copyAllowed(chip.label, chip.message), isTrue);
      }
    },
  );

  test('a payload without chips or for another network is not a chip set', () {
    expect(
      DealChipSuggestionSet.tryParse({
        'success': true,
        'data': {'autoSend': true, 'network': 'in_network'},
      }),
      isNull,
    );
    expect(
      DealChipSuggestionSet.tryParse({
        'success': true,
        'data': {
          'network': 'off_network',
          'chips': [
            {
              'templateId': 'T6',
              'label': 'Itemized OTD',
              'message': 'Could you share the itemized out-the-door price?',
            },
          ],
        },
      }),
      isNull,
    );
    final parsed = DealChipSuggestionSet.tryParse({
      'autoSend': true,
      'chips': [
        {
          'id': 'T6',
          'label': 'Itemized OTD',
          'message': 'Could you share the itemized out-the-door price? Price, dealer fees, tax, title and reg.',
        },
      ],
    });
    expect(parsed?.autoSend, isFalse);
    expect(parsed?.chips.single.templateId, 'T6');
  });
}
