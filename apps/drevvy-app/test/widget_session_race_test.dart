import 'dart:async';

import 'package:drevvy_app/core/config/api_config_exception.dart';
import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/models/models.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/shop/screens/shop_screen.dart';
import 'package:drevvy_app/features/shop/widgets/account_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _avery = User(
  id: 'user-a',
  firstName: 'Avery',
  email: '',
  nameIsKnown: true,
  entitlement: Entitlement.free,
  usage: Usage(used: 0, cap: 0, resetsOn: DateTime.utc(2026, 1, 1)),
);

const _oldBalance = CarCreditBalance.withBalance(11);

const _oldError = 'Old account balance failed.';

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

  void bind(_GatedAccountRepo repo) {
    store.onIdentityChanged = repo.noteSignedInIdentity;
    store.onSessionCleared = repo.clearSignedInState;
    store.session = const ShopperSession(
      accessToken: 'jwt-a',
      consumerUserId: 'user-a',
    );
  }

  Future<void> flush(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pump();
  }

  testWidgets('shop drops a late name after sign-out', (tester) async {
    final repo = _GatedAccountRepo()..firstUser = _avery;
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await tester.pump();

    store.session = null;
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.textContaining('Avery'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late name after an account switch', (tester) async {
    final repo = _GatedAccountRepo()..firstUser = _avery;
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await tester.pump();

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.textContaining('Avery'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late load error after sign-out', (tester) async {
    final repo = _GatedAccountRepo()
      ..firstError = const ApiConfigException(_oldError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await tester.pump();

    store.session = null;
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.text(_oldError), findsNothing);
    expect(find.textContaining('Avery'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late load error after an account switch', (
    tester,
  ) async {
    final repo = _GatedAccountRepo()
      ..firstError = const ApiConfigException(_oldError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await tester.pump();

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.text(_oldError), findsNothing);
    expect(find.textContaining('Avery'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop ignores a load that finishes after disposal', (
    tester,
  ) async {
    final repo = _GatedAccountRepo()
      ..firstUser = _avery
      ..firstError = const ApiConfigException(_oldError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    repo.gate.complete();
    await flush(tester);

    expect(find.textContaining('Avery'), findsNothing);
    expect(find.text(_oldError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account sheet drops a late name and balance after sign-out', (
    tester,
  ) async {
    final repo = _GatedAccountRepo()..firstUser = _avery;
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await tester.pump();

    store.session = null;
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.textContaining('Avery'), findsNothing);
    expect(find.text('11'), findsNothing);
    expect(find.text('Not signed in'), findsWidgets);
    expect(find.text('Loading key balance'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'account sheet drops a late name and balance after an account switch',
    (tester) async {
      final repo = _GatedAccountRepo()..firstUser = _avery;
      bind(repo);
      await tester.pumpWidget(_account(repo));
      await tester.pump();

      store.session = const ShopperSession(
        accessToken: 'jwt-b',
        consumerUserId: 'user-b',
      );
      await flush(tester);
      repo.gate.complete();
      await flush(tester);

      expect(find.textContaining('Avery'), findsNothing);
      expect(find.text('11'), findsNothing);
      expect(find.text('Signed in'), findsWidgets);
      expect(find.text('Loading key balance'), findsOneWidget);
      expect(find.text('0'), findsNothing);
      expect(find.text('Out of keys'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('account sheet drops a late load error after sign-out', (
    tester,
  ) async {
    final repo = _GatedAccountRepo()
      ..firstError = const ApiConfigException(_oldError);
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await tester.pump();

    store.session = null;
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.text(_oldError), findsNothing);
    expect(find.text('Not signed in'), findsWidgets);
    expect(find.text('Loading key balance'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account sheet drops a late load error after an account switch', (
    tester,
  ) async {
    final repo = _GatedAccountRepo()
      ..firstError = const ApiConfigException(_oldError);
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await tester.pump();

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await flush(tester);
    repo.gate.complete();
    await flush(tester);

    expect(find.text(_oldError), findsNothing);
    expect(find.text('Signed in'), findsWidgets);
    expect(find.text('Loading key balance'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('Out of keys'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account sheet ignores a load that finishes after disposal', (
    tester,
  ) async {
    final repo = _GatedAccountRepo()..firstUser = _avery;
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    repo.firstError = const ApiConfigException(_oldError);
    repo.gate.complete();
    await flush(tester);

    expect(find.textContaining('Avery'), findsNothing);
    expect(find.text(_oldError), findsNothing);
    expect(find.text('11'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

Widget _shop(_GatedAccountRepo repo) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: ShopScreen(
      repository: repo,
      discoverConfig: const DiscoverConfig(
        apiBaseUrl: '',
        mode: DrevvyDataMode.demo,
      ),
    ),
  );
}

Widget _account(_GatedAccountRepo repo) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: AccountSheet(repository: repo)),
  );
}

class _GatedAccountRepo extends DemoRepository {
  _GatedAccountRepo()
    : super(
        config: const PurchaseConfig(
          mode: DrevvyDataMode.live,
          apiBaseUrl: 'https://api.drevvy.com',
        ),
        networkDelay: Duration.zero,
        initialBalance: _oldBalance,
      );

  final Completer<void> gate = Completer<void>();
  User? firstUser;
  Object? firstError;
  int _userCalls = 0;
  int _staleUserReady = 0;
  bool _servedStaleBalance = false;

  @override
  Future<User> getCurrentUser() async {
    _userCalls += 1;
    if (_userCalls == 1) {
      await gate.future;
      _staleUserReady = 1;
      final error = firstError;
      if (error != null) throw error;
      return firstUser ?? await super.getCurrentUser();
    }
    return super.getCurrentUser();
  }

  @override
  Future<CarCreditBalance> getCreditBalance() async {
    if (_staleUserReady == 1 && !_servedStaleBalance) {
      _servedStaleBalance = true;
      return _oldBalance;
    }
    return super.getCreditBalance();
  }

  @override
  Future<ChatThread> getChatThread() async {
    return const ChatThread(id: 'chat_main', mode: ChatMode.ask);
  }

  @override
  Future<List<ChatThread>> getChatHistory() async => const [];

  @override
  Future<List<SavedCar>> getSavedCars() async => const [];

  @override
  Future<List<Deal>> getDeals() async => const [];
}
