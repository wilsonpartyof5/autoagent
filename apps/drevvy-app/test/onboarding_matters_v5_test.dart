import 'dart:io';

import 'package:drevvy_app/core/providers/app_services.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/onboarding/matters_v5.dart';
import 'package:drevvy_app/features/onboarding/onboarding_controller.dart';
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
}
