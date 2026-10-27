import 'package:drevvy_app/data/models/deal_brain_chip.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const listing = Listing(
    id: 'listing_001',
    vin: 'VIN123',
    stockNo: '#r44118',
    price: 32995,
    domActive: 42,
    build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
    extra: ListingExtra(highValueFeatures: ['Heated Seats', 'CarPlay']),
  );
  const market = MarketContext(
    fairVehiclePrice: 31900,
    fairOtd: 35400,
    lowPrice: 30500,
    medianPrice: 32200,
    highPrice: 35000,
    comparablesCount: 6,
  );

  test('after the opener the shopper sees T6 then T1 when stock exists', () {
    final chips = DealBrainChip.suggestionsFor(stockNumber: listing.stockNo);
    expect(chips.map((chip) => chip.templateId), ['T6', 'T1']);
    expect(
      chips.first.message,
      'Could you share the itemized out-the-door price? Price, dealer fees, tax, title and reg.',
    );
    expect(chips.last.message, 'Hi, is stock #R44118 still available?');
    expect(chips.every((chip) => chip.isSafe), isTrue);
    expect(chips.every((chip) => !chip.sendsAutomatically), isTrue);
  });

  test('missing or invalid stock hides T1', () {
    expect(
      DealBrainChip.suggestionsFor().map((chip) => chip.templateId),
      ['T6'],
    );
    expect(
      DealBrainChip.suggestionsFor(stockNumber: '??').map((chip) => chip.templateId),
      ['T6'],
    );
  });

  test('unsafe chips drop haggle copy, empty bodies, and auto-send', () {
    expect(
      const DealBrainChip(
        templateId: 'T9',
        label: 'Ask about feature',
        message: 'Let us negotiate the price.',
      ).isSafe,
      isFalse,
    );
    expect(
      const DealBrainChip(
        templateId: 'T1',
        label: 'Still available?',
        message: '',
      ).isSafe,
      isFalse,
    );
    expect(
      const DealBrainChip(
        templateId: 'T6',
        label: 'Itemized OTD',
        message: DealBrainChip.itemizedOtd.message,
        sendsAutomatically: true,
      ).isSafe,
      isFalse,
    );
    expect(
      DealBrainChip.safeOf([
        DealBrainChip.itemizedOtd,
        const DealBrainChip(
          templateId: 'TX',
          label: 'Haggle',
          message: 'Can you do better on this?',
        ),
      ]).map((chip) => chip.templateId),
      ['T6'],
    );
  });

  test('chip intel posts market, feature, and visit fields the server fills', () {
    final intel = ChipIntel.fromDealContext(
      listing: listing,
      market: market,
      visitDay: 'Saturday',
      visitTime: '2pm',
    );
    expect(intel.toJson(), {
      'stockNumber': 'R44118',
      'listedPrice': 32995,
      'fairPrice': 31900,
      'compsCount': 6,
      'compsLowPrice': 30500,
      'dom': 42,
      'feature': 'Heated Seats',
      'visitDay': 'Saturday',
      'visitTime': '2pm',
    });
  });

  test('suggestion set parses the chips envelope and drops auto-send', () {
    final set = ChipSuggestionSet.fromJson({
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
          'label': 'Still available?',
          'message': 'Hi, is stock #R44118 still available?',
          'sendsAutomatically': false,
        },
        {
          'id': 'T9',
          'label': 'Ask about feature',
          'message': 'We should haggle this.',
          'sendsAutomatically': false,
        },
      ],
    });
    expect(set.autoSend, isFalse);
    expect(set.stage, 'after_opener');
    expect(set.chips.map((chip) => chip.templateId), ['T6', 'T1']);
  });
}
