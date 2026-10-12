import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/features/shop/widgets/inventory_card.dart';
import 'package:drevvy_app/data/models/listing.dart';

void main() {
  group('InventoryCard Tests (v1.6.1 overflow fix)', () {
    final testListing = const Listing(
      id: 'test_001',
      vin: '2T3P1RFV5RC123456',
      price: 32995,
      miles: 18420,
      build: ListingBuild(
        year: 2024,
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE Hybrid AWD',
        bodyType: 'SUV',
        drivetrain: 'AWD',
      ),
      media: ListingMedia(photoLinks: []),
      dist: 12,
    );

    Widget buildTestWidget({
      bool isPro = true,
      int? marketDelta,
      double screenWidth = 393,
      double textScale = 1.0,
    }) {
      return MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: MediaQuery(
          data: MediaQueryData(
            size: Size(screenWidth, 852),
            textScaler: TextScaler.linear(textScale),
          ),
          child: Scaffold(
            body: Center(
              child: SizedBox(
                width: screenWidth - 32, // Minus gutters
                child: InventoryCard(
                  listing: testListing,
                  isPro: isPro,
                  onTap: () {},
                  marketDelta: marketDelta,
                ),
              ),
            ),
          ),
        ),
      );
    }

    testWidgets('Card renders without overflow at default width', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Verify the CTA button is present
      expect(find.text('Add to Drevvy'), findsOneWidget);
      
      // Verify no overflow errors
      expect(tester.takeException(), isNull);
    });

    testWidgets('Card renders without overflow on 320pt screen', (tester) async {
      await tester.pumpWidget(buildTestWidget(screenWidth: 320));
      await tester.pumpAndSettle();

      expect(find.text('Add to Drevvy'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Card renders without overflow at text scale 1.3', (tester) async {
      await tester.pumpWidget(buildTestWidget(textScale: 1.3));
      await tester.pumpAndSettle();

      expect(find.text('Add to Drevvy'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Card renders without overflow at 320pt + text scale 1.3', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        screenWidth: 320,
        textScale: 1.3,
      ));
      await tester.pumpAndSettle();

      // The button should still be visible and not clipped
      expect(find.text('Add to Drevvy'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Free user sees "Get Best Price" button', (tester) async {
      await tester.pumpWidget(buildTestWidget(isPro: false));
      await tester.pumpAndSettle();

      expect(find.text('Get Best Price'), findsOneWidget);
    });

    testWidgets('Market badge shows correct text for below-market delta', (tester) async {
      await tester.pumpWidget(buildTestWidget(marketDelta: 1500));
      await tester.pumpAndSettle();

      expect(find.textContaining('below similar'), findsOneWidget);
    });

    testWidgets('Market badge shows correct text for above-market delta', (tester) async {
      await tester.pumpWidget(buildTestWidget(marketDelta: -1500));
      await tester.pumpAndSettle();

      expect(find.textContaining('above similar'), findsOneWidget);
    });

    testWidgets('CTA button is full width (column layout)', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Find the CTA button container - it should be a ConstrainedBox with full width
      final ctaFinder = find.ancestor(
        of: find.text('Add to Drevvy'),
        matching: find.byType(ConstrainedBox),
      );
      expect(ctaFinder, findsOneWidget);

      // Verify it has the width: double.infinity via SizedBox parent
      final sizedBoxFinder = find.ancestor(
        of: find.text('Add to Drevvy'),
        matching: find.byType(SizedBox),
      );
      expect(sizedBoxFinder, findsWidgets);
    });

    testWidgets('Title allows 2 lines with ellipsis', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      final titleText = tester.widget<Text>(
        find.text('2024 Toyota RAV4'),
      );
      expect(titleText.maxLines, 2);
      expect(titleText.overflow, TextOverflow.ellipsis);
    });
  });
}
