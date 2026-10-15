import 'package:drevvy_app/core/onboarding/onboarding_gate.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/features/onboarding/screens/how_it_works_screen.dart';
import 'package:drevvy_app/features/onboarding/screens/paywall_screen.dart';
import 'package:drevvy_app/features/onboarding/screens/welcome_screen.dart';
import 'package:drevvy_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first
      ..physicalSize = const Size(800, 1600)
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

  void expectNoNegotiate(WidgetTester tester) {
    final texts = tester.widgetList<Text>(find.byType(Text));
    for (final text in texts) {
      final value = text.data ?? text.textSpan?.toPlainText() ?? '';
      expect(value.toLowerCase().contains('negotiat'), isFalse, reason: value);
    }
  }

  testWidgets('first run opens onboarding instead of Shop', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: DrevvyApp()));
    await tester.pump();

    expect(find.text('Get started'), findsOneWidget);
    expect(find.textContaining('transparency'), findsOneWidget);
    expect(find.textContaining('Market data'), findsOneWidget);
    expect(find.text('Deals'), findsNothing);
    expectNoNegotiate(tester);
  });

  testWidgets('get started opens how it works', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: DrevvyApp()));
    await tester.pump();

    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();

    expect(find.text('How Drevvy works'), findsOneWidget);
    expect(find.text('Ask and shop, free'), findsOneWidget);
    expect(find.textContaining('market data'), findsOneWidget);
    expectNoNegotiate(tester);
  });

  testWidgets('an existing account leaves first run for Shop', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: DrevvyApp()));
    await tester.pump();
    await tester.tap(find.text('I already have an account'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 6));

    expect(find.text('Ask'), findsOneWidget);
    expect(find.text('Shop'), findsWidgets);
  });

  testWidgets('finished onboarding still launches on Shop', (tester) async {
    await tester.runAsync(() async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [onboardingCompleteProvider.overrideWith((ref) => true)],
          child: const DrevvyApp(),
        ),
      );
      await Future<void>.delayed(const Duration(milliseconds: 600));
      await tester.pump();
    });

    expect(find.text('Ask'), findsOneWidget);
    expect(find.text('Deals'), findsOneWidget);
  });

  testWidgets('paywall shows pack dollar prices and keeps Ask and Shop free', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: PaywallScreen(
            from: 'onboarding',
            loadOfferings: () async => null,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));

    expect(find.text(r'$47'), findsOneWidget);
    expect(find.text(r'$67'), findsOneWidget);
    expect(find.text(r'$97'), findsOneWidget);
    expect(find.text(r'$15.67/car'), findsOneWidget);
    expect(find.text(r'$13.40/car'), findsOneWidget);
    expect(find.text(r'$9.70/car'), findsOneWidget);
    expect(find.text('BEST VALUE'), findsOneWidget);
    expect(find.text('One-time. Never expire.'), findsOneWidget);
    expect(find.textContaining('10 cars at \$9.70 per car'), findsOneWidget);
    expect(find.textContaining('Ask and Shop stay unlimited'), findsOneWidget);
    expect(find.textContaining('market data'), findsWidgets);
    expect(find.textContaining('transparency'), findsOneWidget);
    expect(find.text('Start shopping free'), findsOneWidget);
    expectNoNegotiate(tester);
  });

  testWidgets('welcome and how-it-works screens avoid negotiate wording', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const WelcomeScreen(),
      ),
    );
    expectNoNegotiate(tester);

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const HowItWorksScreen(),
      ),
    );
    expect(find.textContaining('transparency'), findsOneWidget);
    expectNoNegotiate(tester);
  });
}
