import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:drevvy_app/main.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';

void main() {
  group('DrevvyApp Tests', () {
    testWidgets('DrevvyApp renders with tab bar', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(child: DrevvyApp()),
      );

      // Pump multiple frames to allow async operations to settle
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));

      // Verify tab bar is present with all three tabs
      // "Shop" appears twice (screen + tab), "Deals" and "Profile" only in tab bar
      expect(find.text('Shop'), findsWidgets);
      expect(find.text('Deals'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
    });
  });

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
    test('DealStatus enum has correct values (v1.6: 10 statuses)', () {
      expect(DealStatus.values.length, 10);
      expect(DealStatus.noLongerListed.label, 'No longer listed');
      expect(DealStatus.offerReceived.progressStep, 3);
      expect(DealStatus.noLongerListed.isEnded, true);
      expect(DealStatus.reachingOut.isEnded, false);
      // v1.6 new statuses
      expect(DealStatus.watchingForDrops.label, 'Watching for drops');
      expect(DealStatus.changedAfterAccepted.label, 'Offer changed');
      expect(DealStatus.changedAfterAccepted.hasChangedOffer, true);
      expect(DealStatus.accepted.canWithdraw, true);
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
