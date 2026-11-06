import 'dart:async';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/models.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/shop/widgets/account_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _live = PurchaseConfig(
  mode: DrevvyDataMode.live,
  apiBaseUrl: 'https://api.drevvy.com',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ShopperSessionStore store;
  void Function()? previousIdentity;
  void Function()? previousCleared;

  setUp(() {
    store = ShopperSessionStore.instance;
    previousIdentity = store.onIdentityChanged;
    previousCleared = store.onSessionCleared;
    store.session = null;
  });

  tearDown(() {
    store.onIdentityChanged = previousIdentity;
    store.onSessionCleared = previousCleared;
    store.session = null;
  });

  void bind(DemoRepository repo) {
    store.onIdentityChanged = repo.noteSignedInIdentity;
    store.onSessionCleared = repo.clearSignedInState;
    store.session = const ShopperSession(
      accessToken: 'jwt-a',
      consumerUserId: 'user-a',
    );
  }

  Future<void> show(WidgetTester tester, DemoRepository repo) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(body: AccountSheet(repository: repo)),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
  }

  testWidgets('a loaded zero is the out-of-keys balance', (tester) async {
    final repo = DemoRepository(
      config: _live,
      networkDelay: Duration.zero,
      credits: const _FixedCredits(0),
    );
    bind(repo);
    expect(await repo.pullSignedInBalance(), isTrue);

    await show(tester, repo);

    expect(repo.balanceKnown, isTrue);
    expect(find.text('0'), findsOneWidget);
    expect(find.text('Out of keys'), findsOneWidget);
    expect(find.text('Loading key balance'), findsNothing);
  });

  testWidgets('a live balance that has not loaded is not shown as zero', (
    tester,
  ) async {
    final repo = DemoRepository(config: _live, networkDelay: Duration.zero);
    bind(repo);

    await show(tester, repo);

    expect(repo.balanceKnown, isFalse);
    expect(find.text('Loading key balance'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
  });

  testWidgets('a failed live balance read stays unavailable', (tester) async {
    final repo = DemoRepository(
      config: _live,
      networkDelay: Duration.zero,
      credits: const _NullCredits(),
    );
    bind(repo);
    expect(await repo.pullSignedInBalance(), isFalse);

    await show(tester, repo);

    expect(repo.balanceKnown, isFalse);
    expect(find.text('Key balance is unavailable.'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
    expect(find.text('Loading key balance'), findsNothing);
  });

  testWidgets('an account switch drops the previous balance', (tester) async {
    final repo = DemoRepository(
      config: _live,
      networkDelay: Duration.zero,
      credits: const _FixedCredits(11),
    );
    bind(repo);
    expect(await repo.pullSignedInBalance(), isTrue);

    await show(tester, repo);
    expect(find.text('11'), findsOneWidget);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));

    expect(find.text('11'), findsNothing);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
    expect(find.text('Loading key balance'), findsOneWidget);
  });

  testWidgets('a late balance does not fill the next account', (tester) async {
    final repo = _SlowBalance();
    bind(repo);
    await show(tester, repo);

    store.session = null;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
    repo.gate.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));

    expect(repo.staleServed, isTrue);
    expect(find.text('11'), findsNothing);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
    expect(find.text('Loading key balance'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _FixedCredits extends CreditsEndpoint {
  const _FixedCredits(this.balance);

  final int balance;

  CarCreditBalance get _value => CarCreditBalance.withBalance(balance);

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async {
    return _value;
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async {
    return _value;
  }

  @override
  Future<CarCreditBalance?> fetchBalance() async => _value;
}

class _NullCredits extends CreditsEndpoint {
  const _NullCredits();

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async {
    return null;
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async {
    return null;
  }

  @override
  Future<CarCreditBalance?> fetchBalance() async => null;
}

class _SlowBalance extends DemoRepository {
  _SlowBalance()
    : super(
        config: _live,
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(11),
      );

  final Completer<void> gate = Completer<void>();
  var calls = 0;
  var staleServed = false;

  @override
  Future<CarCreditBalance> getCreditBalance() async {
    calls += 1;
    if (calls == 1) {
      await gate.future;
      staleServed = true;
      return const CarCreditBalance.withBalance(11);
    }
    return super.getCreditBalance();
  }
}
