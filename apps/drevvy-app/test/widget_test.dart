import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';

void main() {
  group('Theme Tests', () {
    testWidgets('Light theme renders correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: const Scaffold(body: Text('Test')),
        ),
      );

      expect(find.text('Test'), findsOneWidget);
    });

    testWidgets('Dark theme renders correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: drevvyTheme(Brightness.dark),
          home: const Scaffold(body: Text('Test')),
        ),
      );

      expect(find.text('Test'), findsOneWidget);
    });
  });

  group('StatusChip Tests', () {
    testWidgets('All deal statuses render', (WidgetTester tester) async {
      for (final status in DealStatus.values) {
        await tester.pumpWidget(
          MaterialApp(
            theme: drevvyTheme(Brightness.light),
            home: Scaffold(body: StatusChip(status)),
          ),
        );

        expect(find.text(status.label), findsOneWidget);
      }
    });

    testWidgets('noLongerListed status shows correct label', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: Scaffold(body: StatusChip(DealStatus.noLongerListed)),
        ),
      );

      expect(find.text('No longer listed'), findsOneWidget);
    });
  });

  group('GlassCard Tests', () {
    testWidgets('GlassCard renders child', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: Scaffold(
            body: GlassCard(
              child: Text('Card Content'),
            ),
          ),
        ),
      );

      expect(find.text('Card Content'), findsOneWidget);
    });
  });

  group('Token Tests', () {
    test('DealStatus enum has correct values', () {
      expect(DealStatus.values.length, 8);
      expect(DealStatus.noLongerListed.label, 'No longer listed');
      expect(DealStatus.offerReceived.progressStep, 3);
      expect(DealStatus.noLongerListed.isEnded, true);
      expect(DealStatus.reachingOut.isEnded, false);
    });

    test('Light palette has all chip colors', () {
      for (final status in DealStatus.values) {
        expect(DrevvyPaletteLight.chips.containsKey(status), true);
      }
    });

    test('Dark palette has all chip colors', () {
      for (final status in DealStatus.values) {
        expect(DrevvyPaletteDark.chips.containsKey(status), true);
      }
    });
  });
}
