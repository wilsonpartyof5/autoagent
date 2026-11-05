import 'package:drevvy_app/data/models/listing.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Listing.fromJson accepts a null price and numeric strings', () {
    final listing = Listing.fromJson({
      'id': 'mc_civic',
      'vin': null,
      'price': null,
      'miles': '12000',
      'msrp': '21500.4',
      'build': {
        'year': '2021',
        'make': 'Honda',
        'model': 'Civic',
        'city_mpg': '32',
      },
      'media': {
        'photo_links': ['https://cdn.example/civic.jpg', 1, null],
      },
      'car_location': {'city': 'Springfield', 'state': 'IL'},
    });

    expect(listing.price, isNull);
    expect(listing.priceFormatted, 'Price unavailable');
    expect(listing.vin, isEmpty);
    expect(listing.miles, 12000);
    expect(listing.msrp, 21500);
    expect(listing.build.year, 2021);
    expect(listing.build.cityMpg, 32);
    expect(listing.media.photoLinks, ['https://cdn.example/civic.jpg']);
    expect(listing.carLocation?.city, 'Springfield');
  });

  test('a decimal price rounds and does not throw', () {
    final listing = Listing.fromJson({
      'id': 'mc_rav',
      'price': 32995.6,
      'build': {'year': 2024, 'make': 'Toyota', 'model': 'RAV4'},
    });

    expect(listing.price, 32996);
  });

  test('a row without an id or build is skipped', () {
    expect(Listing.tryFromJson({'price': 1000}), isNull);
    expect(
      Listing.tryFromJson({
        'id': 'missing-build',
        'price': 1000,
      }),
      isNull,
    );
    expect(
      () => Listing.fromJson({'id': 'missing-build'}),
      throwsFormatException,
    );
  });
}
