import 'dart:io';

import 'package:drevvy_app/core/providers/app_services.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/onboarding/matters_v5.dart';
import 'package:drevvy_app/features/onboarding/onboarding_controller.dart';
import 'package:drevvy_app/features/onboarding/widgets/onboarding_chrome.dart';
import 'package:drevvy_app/features/onboarding/widgets/onboarding_steps.dart';
import 'package:drevvy_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(800, 2000);
    view.devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
    DemoRepository.instance
      ..resetDemoUser()
      ..resetDemoSearchProfile();
  });

  test('shopping priorities follow the board map and defaults', () {
    expect(
      shoppingPriorities(
        pain: MattersPain.surpriseFees,
        outcome: MattersOutcome.wholePrice,
        control: MattersControl.keepInDrevvy,
      ),
      [
        'Avoid surprise fees',
        'Understand the whole price',
        'Keep conversations private',
      ],
    );
    expect(
      shoppingPriorities(
        pain: MattersPain.justLooking,
        outcome: MattersOutcome.both,
        control: MattersControl.contactMyself,
      ),
      [
        'Look around at my own pace',
        'Know if the price is fair and the whole price',
        'Get answers first, then call if I want',
      ],
    );
    expect(shoppingPriorities(), [
      'Avoid surprise fees',
      'Understand the whole price',
      'Keep conversations private',
    ]);
  });

  test('zip and draft helpers match the board rules', () {
    expect(isFiveDigitZip('29730'), isTrue);
    expect(isFiveDigitZip('2973'), isFalse);
    expect(isFiveDigitZip('297301'), isFalse);
    expect(isFiveDigitZip('29a30'), isFalse);
    expect(
      draftQuestionText(ask: MattersAsk.wholePrice, custom: ''),
      'Can you send me the whole price, including all required fees?',
    );
    expect(draftQuestionText(ask: MattersAsk.writeOwn, custom: '  '), isNull);
    expect(
      draftQuestionText(ask: MattersAsk.writeOwn, custom: ' Any extra fees? '),
      'Any extra fees?',
    );
    expect(bodyTypeFor(MattersCarType.suv), 'SUV');
    expect(bodyTypeFor(MattersCarType.notSure), isNull);
    expect(conditionFor(MattersCondition.used), 'used');
    expect(conditionFor(MattersCondition.either), isNull);
  });

  test('starter grant is idempotent and fills up to 3 keys', () async {
    final empty = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.empty(),
    );
    expect(await empty.grantStarterKeys(), isTrue);
    expect((await empty.getCreditBalance()).balance, 3);
    expect(await empty.grantStarterKeys(), isFalse);
    expect((await empty.getCreditBalance()).balance, 3);

    final demo = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(6),
    );
    expect(await demo.grantStarterKeys(), isTrue);
    expect((await demo.getCreditBalance()).balance, 6);
  });

  testWidgets('location Continue stays disabled until share or a 5-digit zip', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [localFlagsProvider.overrideWithValue(MemoryFlags())],
        child: const DrevvyApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Let’s find your car'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Surprise fees'));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Whole price'));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Keep texts in Drevvy'));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pumpAndSettle();
    await tester.tap(find.text('See how Drevvy helps'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next · Meet the dealer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Skip for now'));
    await tester.pumpAndSettle();

    expect(find.text('Where should we look?'), findsOneWidget);
    expect(find.text('or enter your zip'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Where should we look?'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '2973');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Where should we look?'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '29730');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('What kind of car?'), findsOneWidget);
  });

  testWidgets('step 9 car type fits iPhone 16 without overflow', (tester) async {
    const iphone16 = Size(393, 852);
    tester.view.physicalSize = iphone16 * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        builder: (context, child) {
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(
              size: iphone16,
              devicePixelRatio: 3,
              padding: const EdgeInsets.only(top: 59, bottom: 34),
              textScaler: TextScaler.noScaling,
            ),
            child: child!,
          );
        },
        home: Scaffold(
          body: Stack(
            children: [
              const OnboardingBackground(),
              SafeArea(
                child: Column(
                  children: [
                    OnboardingProgressHeader(
                      stepIndex: 8,
                      total: mattersV5StepCount,
                      onBack: () {},
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          mattersV5Margin,
                          8,
                          mattersV5Margin,
                          20,
                        ),
                        child: CarTypeStep(
                          draft: const OnboardingDraft(),
                          onSelectType: (_) {},
                          onSelectCondition: (_) {},
                          onSelectTiming: (_) {},
                          onContinue: () {},
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('What kind of car?'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);

    const labels = [
      'SUV',
      'Truck',
      'Sedan',
      'Other',
      'Not sure',
      'New',
      'Used',
      'Either',
      'Soon',
      'This month',
      'Just looking',
    ];
    final step = tester.getRect(find.byType(CarTypeStep));
    for (final label in labels) {
      expect(find.text(label), findsOneWidget);
      final rect = tester.getRect(find.text(label));
      expect(rect.width, greaterThan(20), reason: '$label crushed');
      expect(rect.height, greaterThan(10), reason: '$label crushed');
      expect(rect.left, greaterThanOrEqualTo(step.left - 0.5));
      expect(rect.right, lessThanOrEqualTo(step.right + 0.5));
      expect(rect.bottom, lessThanOrEqualTo(iphone16.height + 0.5));
    }

    final continueRect = tester.getRect(find.text('Continue'));
    expect(continueRect.bottom, lessThanOrEqualTo(iphone16.height + 0.5));
  });

  test('onboarding copy does not ship locked claims or pack prices', () {
    const files = [
      'lib/features/onboarding/matters_v5.dart',
      'lib/features/onboarding/screens/onboarding_flow_screen.dart',
      'lib/features/onboarding/widgets/onboarding_steps.dart',
      'lib/features/onboarding/widgets/onboarding_chrome.dart',
    ];
    for (final path in files) {
      final text = File(path).readAsStringSync().toLowerCase();
      expect(text.contains('unlimited follow'), isFalse, reason: path);
      expect(text.contains('first name only'), isFalse, reason: path);
      expect(text.contains('7-day'), isFalse, reason: path);
      expect(text.contains('key refund'), isFalse, reason: path);
      expect(text.contains(r'$4.99'), isFalse, reason: path);
      expect(text.contains(r'$19.99'), isFalse, reason: path);
      expect(text.contains(r'$34.99'), isFalse, reason: path);
    }
  });

  test('step 6 fuller copy stays third-grade and omits locked extras', () {
    expect(mattersPriceDropValue(0), 'None yet');
    expect(mattersPriceDropValue(1), '1 drop');
    expect(mattersPriceDropValue(2), '2 drops');

    const files = [
      'lib/features/onboarding/matters_v5.dart',
      'lib/features/onboarding/widgets/onboarding_steps.dart',
    ];
    for (final path in files) {
      final text = File(path).readAsStringSync().toLowerCase();
      expect(text.contains('deal score'), isFalse, reason: path);
      expect(text.contains('sold cars'), isFalse, reason: path);
      expect(text.contains('talk point'), isFalse, reason: path);
      expect(text.contains('out-the-door'), isFalse, reason: path);
      expect(text.contains('price-drop watch'), isFalse, reason: path);
      expect(text.contains('refund'), isFalse, reason: path);
    }
    expect(
      File('lib/features/onboarding/matters_v5.dart').readAsStringSync(),
      contains(mattersMarketIntelHeadline),
    );
  });

  testWidgets('step 6 fuller sample fits 393x852 without scroll', (
    tester,
  ) async {
    final view = tester.view;
    view.physicalSize = const Size(393, 852);
    view.devicePixelRatio = 1;
    addTearDown(() {
      view.resetPhysicalSize();
      view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(393, 852),
            padding: EdgeInsets.only(top: 47, bottom: 34),
          ),
          child: const Scaffold(
            body: SafeArea(
              child: Column(
                children: [
                  OnboardingProgressHeader(
                    stepIndex: 5,
                    total: mattersV5StepCount,
                    onBack: _noop,
                  ),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        mattersV5Margin,
                        8,
                        mattersV5Margin,
                        20,
                      ),
                      child: MarketIntelStep(onContinue: _noop),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text(mattersMarketIntelHeadline), findsOneWidget);
    expect(find.text(mattersMarketIntelLead), findsOneWidget);
    expect(find.text(mattersMarketIntelSampleTitle), findsOneWidget);
    expect(find.text(mattersMarketIntelSampleBadge), findsOneWidget);
    expect(find.text(mattersMarketIntelAskingPrice), findsOneWidget);
    expect(find.text(mattersMarketIntelGoodPrice), findsOneWidget);
    expect(find.text(mattersMarketIntelFairLine), findsOneWidget);
    expect(find.text(mattersMarketIntelInsight), findsOneWidget);
    expect(find.text('Similar cars'), findsOneWidget);
    expect(find.text('26 cars'), findsOneWidget);
    expect(find.text('21 days'), findsOneWidget);
    expect(find.text('1 drop'), findsOneWidget);
    expect(find.text(mattersMarketIntelFooter), findsOneWidget);
    expect(find.text(mattersMarketIntelCta), findsOneWidget);
    expect(find.byType(ListView), findsNothing);
    expect(find.byType(SingleChildScrollView), findsNothing);
  });
}

void _noop() {}

