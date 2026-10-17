import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/features/shop/widgets/out_of_cars_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/pack_option_card.dart';
import 'package:drevvy_app/features/shop/widgets/pack_picker_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const listing = Listing(
    id: 'listing_1',
    vin: 'VIN123',
    price: 27990,
    build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
  );
  const avgSavings = AvgSavingsConfig(
    value: '3–5%',
    label: 'Buyers who compare out-the-door quotes from several dealers typically save 3–5% off the first price they\'re quoted.',
    source: 'CarEdge, State of Dealer Fees 2026',
    kind: 'market',
  );

  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first
      ..physicalSize = const Size(800, 2400)
      ..devicePixelRatio = 1;
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
    'pack picker uses four rows, savings vs the 1-car price, and the 10-pack',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: const Scaffold(
            body: PackPickerSheet(
              listing: listing,
              avgSavings: avgSavings,
              onPurchase: _noopPurchase,
              onRestore: _noop,
              onKeepShopping: _noop,
            ),
          ),
        ),
      );

      expect(find.text(r'$35.00/car'), findsOneWidget);
      expect(find.text(r'$18.33/car'), findsOneWidget);
      expect(find.text(r'$15.00/car'), findsOneWidget);
      expect(find.text(r'$9.50/car'), findsOneWidget);
      expect(find.text('1 car · Single'), findsOneWidget);
      expect(find.text('3 cars · Starter'), findsOneWidget);
      expect(find.text('5 cars · Plus'), findsOneWidget);
      expect(find.text('10 cars · Best Value'), findsOneWidget);
      expect(find.text('Save 47.6%/car'), findsOneWidget);
      expect(find.text('Save 57.1%/car'), findsOneWidget);
      expect(find.text('Save 72.9%/car'), findsOneWidget);
      expect(find.text('One-time · never expires'), findsOneWidget);
      expect(find.text(PackPickerColumn.footnote), findsOneWidget);
      expect(find.text('BEST VALUE'), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsNothing);
      expect(
        tester.getTopLeft(find.text('1 car · Single')).dy <
            tester.getTopLeft(find.text('3 cars · Starter')).dy,
        isTrue,
      );
      expect(
        tester.getTopLeft(find.text('3 cars · Starter')).dy <
            tester.getTopLeft(find.text('10 cars · Best Value')).dy,
        isTrue,
      );
      expect(find.text('3–5%'), findsOneWidget);
      expect(find.textContaining('Source: CarEdge'), findsOneWidget);
      expect(find.text('Restore purchases'), findsOneWidget);
      expect(find.text('Get 10 cars for \$95'), findsOneWidget);
    },
  );

  testWidgets(
    'out of cars sheet keeps pack prices and the never-expires line',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: const Scaffold(
            body: OutOfCarsSheet(
              listing: listing,
              onPurchase: _noopPurchase,
              onNotNow: _noop,
            ),
          ),
        ),
      );

      expect(find.text('0 CARS LEFT'), findsOneWidget);
      expect(find.text(r'$35.00/car'), findsOneWidget);
      expect(find.text(r'$18.33/car'), findsOneWidget);
      expect(find.text(r'$9.50/car'), findsOneWidget);
      expect(find.text('Save 47.6%/car'), findsOneWidget);
      expect(find.text('Save 72.9%/car'), findsOneWidget);
      expect(find.text('One-time · never expires'), findsOneWidget);
      expect(find.text(PackPickerColumn.footnote), findsOneWidget);
      expect(find.text('Get 10 cars for \$95'), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsNothing);
    },
  );

  testWidgets('four packs stay on screen in a phone-sized sheet', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const Scaffold(
          body: OutOfCarsSheet(onPurchase: _noopPurchase, onNotNow: _noop),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text(r'$35'), findsOneWidget);
    expect(find.text(r'$55'), findsOneWidget);
    expect(find.text(r'$75'), findsOneWidget);
    expect(find.text(r'$95'), findsOneWidget);
    expect(find.text('BEST VALUE'), findsOneWidget);
    expect(find.text('Get 10 cars for \$95'), findsOneWidget);
    expect(find.byType(SingleChildScrollView), findsNothing);
    expect(find.textContaining('negotiat'), findsNothing);

    await tester.tap(find.text('1 car · Single'));
    await tester.pump();
    expect(find.text('Get 1 car for \$35'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _noopPurchase(CarPackType pack) async {}

void _noop() {}
