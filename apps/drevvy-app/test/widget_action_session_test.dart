import 'dart:async';

import 'package:drevvy_app/core/config/api_config_exception.dart';
import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/models/models.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/shop/screens/shop_screen.dart';
import 'package:drevvy_app/features/shop/widgets/account_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _oldAnswer = 'OLD SESSION ANSWER';
const _oldListing = '2024 Oldsession Marker';
const _oldStarter = 'OLD STARTER';
const _sendError = 'Old send failed.';
const _searchError = 'Old search failed.';
const _profileError = 'Old profile failed.';
const _purchaseError = 'Old purchase failed.';
const _restoreError = 'Old restore failed.';

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

  void bind(_ActionRepo repo) {
    store.onIdentityChanged = repo.noteSignedInIdentity;
    store.onSessionCleared = repo.clearSignedInState;
    store.session = const ShopperSession(
      accessToken: 'jwt-a',
      consumerUserId: 'user-a',
    );
  }

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pump();
  }

  Future<void> sendAsk(WidgetTester tester) async {
    await tester.enterText(find.byType(TextField), 'hello from old');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pump();
  }

  Future<void> sendShop(WidgetTester tester) async {
    await tester.tap(find.text('Shop'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    final field = find.byWidgetPredicate(
      (widget) =>
          widget is TextField &&
          widget.decoration?.hintText == 'Search cars nearby...',
    );
    await tester.enterText(field, 'old suv');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pump();
  }

  void useTallView(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pump();
    await tester.tap(finder);
    await tester.pump();
  }

  Future<void> openPackSheet(WidgetTester tester) async {
    await tester.tap(find.text('Open account'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tapVisible(tester, find.text('Buy keys'));
    await tester.pump(const Duration(milliseconds: 500));
  }

  Future<void> closeAccount(WidgetTester tester, _ActionRepo repo) async {
    await tester.tap(find.text('DW'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
    expect(find.byType(AccountSheet), findsOneWidget);
    repo.stallNextProfile = true;
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
  }

  testWidgets('shop drops a late send after sign-out', (tester) async {
    final repo = _ActionRepo()..stallSend = true;
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendAsk(tester);

    store.session = null;
    await settle(tester);
    repo.sendHold.complete();
    await settle(tester);

    expect(repo.sendFinished, isTrue);
    expect(find.text(_oldAnswer), findsNothing);
    expect(find.text(_sendError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late send after an account switch', (tester) async {
    final repo = _ActionRepo()..stallSend = true;
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendAsk(tester);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.sendHold.complete();
    await settle(tester);

    expect(repo.sendFinished, isTrue);
    expect(find.text(_oldAnswer), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late send error after sign-out', (tester) async {
    final repo = _ActionRepo()
      ..stallSend = true
      ..sendError = const ApiConfigException(_sendError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendAsk(tester);

    store.session = null;
    await settle(tester);
    repo.sendHold.complete();
    await settle(tester);

    expect(find.text(_sendError), findsNothing);
    expect(find.text(_oldAnswer), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late send error after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallSend = true
      ..sendError = const ApiConfigException(_sendError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendAsk(tester);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.sendHold.complete();
    await settle(tester);

    expect(find.text(_sendError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop ignores a send that finishes after disposal', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallSend = true
      ..sendError = const ApiConfigException(_sendError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendAsk(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    repo.sendHold.complete();
    await settle(tester);

    expect(find.text(_oldAnswer), findsNothing);
    expect(find.text(_sendError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late search after sign-out', (tester) async {
    final repo = _ActionRepo()..stallSearch = true;
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendShop(tester);
    expect(find.text('Searching listings near you...'), findsOneWidget);

    store.session = null;
    await settle(tester);
    repo.searchHold.complete();
    await settle(tester);

    expect(repo.searchFinished, isTrue);
    expect(find.text('Searching listings near you...'), findsNothing);
    expect(find.text(_oldListing), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late search after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo()..stallSearch = true;
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendShop(tester);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.searchHold.complete();
    await settle(tester);

    expect(repo.searchFinished, isTrue);
    expect(find.text(_oldListing), findsNothing);
    expect(find.text('Searching listings near you...'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late search error after sign-out', (tester) async {
    final repo = _ActionRepo()
      ..stallSearch = true
      ..searchError = const ApiConfigException(_searchError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendShop(tester);

    store.session = null;
    await settle(tester);
    repo.searchHold.complete();
    await settle(tester);

    expect(find.text(_searchError), findsNothing);
    expect(find.text(_oldListing), findsNothing);
    expect(find.text('Searching listings near you...'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late search error after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallSearch = true
      ..searchError = const ApiConfigException(_searchError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendShop(tester);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.searchHold.complete();
    await settle(tester);

    expect(find.text(_searchError), findsNothing);
    expect(find.text('Searching listings near you...'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop ignores a search that finishes after disposal', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallSearch = true
      ..searchError = const ApiConfigException(_searchError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await sendShop(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    repo.searchHold.complete();
    await settle(tester);

    expect(find.text(_oldListing), findsNothing);
    expect(find.text(_searchError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late profile reload after sign-out', (
    tester,
  ) async {
    final repo = _ActionRepo();
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await closeAccount(tester, repo);

    store.session = null;
    await settle(tester);
    repo.profileHold.complete();
    await settle(tester);

    expect(repo.profileFinished, isTrue);
    expect(find.text(_oldStarter), findsNothing);
    expect(find.text(_profileError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late profile reload after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo();
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await closeAccount(tester, repo);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.profileHold.complete();
    await settle(tester);

    expect(repo.profileFinished, isTrue);
    expect(find.text(_oldStarter), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late profile error after sign-out', (tester) async {
    final repo = _ActionRepo()
      ..profileError = const ApiConfigException(_profileError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await closeAccount(tester, repo);

    store.session = null;
    await settle(tester);
    repo.profileHold.complete();
    await settle(tester);

    expect(find.text(_profileError), findsNothing);
    expect(find.text(_oldStarter), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop drops a late profile error after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..profileError = const ApiConfigException(_profileError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await closeAccount(tester, repo);

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.profileHold.complete();
    await settle(tester);

    expect(find.text(_profileError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shop ignores a profile reload that finishes after disposal', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..profileError = const ApiConfigException(_profileError);
    bind(repo);
    await tester.pumpWidget(_shop(repo));
    await settle(tester);
    await closeAccount(tester, repo);
    await tester.pumpWidget(const SizedBox.shrink());
    repo.profileHold.complete();
    await settle(tester);

    expect(find.text(_oldStarter), findsNothing);
    expect(find.text(_profileError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account restore snackbar stays hidden after sign-out', (
    tester,
  ) async {
    final repo = _ActionRepo()..stallRestore = true;
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await settle(tester);
    await tapVisible(tester, find.text('Restore purchases'));

    store.session = null;
    await settle(tester);
    repo.restoreHold.complete();
    await settle(tester);

    expect(repo.restoreFinished, isTrue);
    expect(find.text('Purchases restored'), findsNothing);
    expect(find.text(_restoreError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account restore snackbar stays hidden after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallRestore = true
      ..restoreError = const ApiConfigException(_restoreError);
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await settle(tester);
    await tapVisible(tester, find.text('Restore purchases'));

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.restoreHold.complete();
    await settle(tester);

    expect(find.text('Purchases restored'), findsNothing);
    expect(find.text(_restoreError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account restore snackbar stays hidden after disposal', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallRestore = true
      ..restoreError = const ApiConfigException(_restoreError);
    bind(repo);
    await tester.pumpWidget(_account(repo));
    await settle(tester);
    await tapVisible(tester, find.text('Restore purchases'));
    await tester.pumpWidget(const SizedBox.shrink());
    repo.restoreHold.complete();
    await settle(tester);

    expect(find.text('Purchases restored'), findsNothing);
    expect(find.text(_restoreError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account purchase message stays hidden after sign-out', (
    tester,
  ) async {
    final repo = _ActionRepo()..stallPurchase = true;
    bind(repo);
    useTallView(tester);
    await tester.pumpWidget(_accountHome(repo));
    await openPackSheet(tester);
    await tapVisible(tester, find.textContaining('Get '));

    store.session = null;
    await settle(tester);
    repo.purchaseHold.complete();
    await settle(tester);

    expect(repo.purchaseFinished, isTrue);
    expect(find.text('Added 5 keys. Packs never expire.'), findsNothing);
    expect(find.text(_purchaseError), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account purchase error stays hidden after an account switch', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallPurchase = true
      ..purchaseResult = const PurchaseError(message: _purchaseError);
    bind(repo);
    useTallView(tester);
    await tester.pumpWidget(_accountHome(repo));
    await openPackSheet(tester);
    await tapVisible(tester, find.textContaining('Get '));

    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    await settle(tester);
    repo.purchaseHold.complete();
    await settle(tester);

    expect(find.text(_purchaseError), findsNothing);
    expect(find.textContaining('Added '), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pack restore message stays hidden after sign-out', (
    tester,
  ) async {
    final repo = _ActionRepo()
      ..stallRestore = true
      ..restoreError = const ApiConfigException(_restoreError);
    bind(repo);
    useTallView(tester);
    await tester.pumpWidget(_accountHome(repo));
    await openPackSheet(tester);
    await tapVisible(tester, find.text('Restore purchases'));

    store.session = null;
    await settle(tester);
    repo.restoreHold.complete();
    await settle(tester);

    expect(find.text('Purchases restored.'), findsNothing);
    expect(find.text(_restoreError), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

Widget _shop(_ActionRepo repo) {
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

Widget _account(_ActionRepo repo) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: AccountSheet(repository: repo)),
  );
}

Widget _accountHome(_ActionRepo repo) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(
      body: Builder(
        builder: (context) {
          return TextButton(
            onPressed: () {
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (context) => AccountSheet(repository: repo),
              );
            },
            child: const Text('Open account'),
          );
        },
      ),
    ),
  );
}

class _ActionRepo extends DemoRepository {
  _ActionRepo()
    : super(
        config: const PurchaseConfig(
          mode: DrevvyDataMode.live,
          apiBaseUrl: 'https://api.drevvy.com',
        ),
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(11),
      );

  final Completer<void> sendHold = Completer<void>();
  final Completer<void> searchHold = Completer<void>();
  final Completer<void> profileHold = Completer<void>();
  final Completer<void> purchaseHold = Completer<void>();
  final Completer<void> restoreHold = Completer<void>();

  bool stallSend = false;
  bool stallSearch = false;
  bool stallNextProfile = false;
  bool stallPurchase = false;
  bool stallRestore = false;
  bool sendFinished = false;
  bool searchFinished = false;
  bool profileFinished = false;
  bool purchaseFinished = false;
  bool restoreFinished = false;
  bool _sendHeld = false;
  bool _searchHeld = false;
  bool _profileHeld = false;
  bool _returnStaleStarters = false;
  bool _purchaseHeld = false;
  bool _restoreHeld = false;
  Object? sendError;
  Object? searchError;
  Object? profileError;
  Object? restoreError;
  PurchaseResult purchaseResult = const PurchaseSuccess(
    packType: CarPackType.single,
    creditsAdded: 5,
    transactionId: 'txn-old',
  );

  final _user = User(
    id: 'user-a',
    firstName: 'Signed in',
    email: '',
    nameIsKnown: false,
    entitlement: Entitlement.free,
    usage: Usage(used: 0, cap: 0, resetsOn: DateTime.utc(2026, 1, 1)),
  );

  @override
  Future<User> getCurrentUser() async => _user;

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

  @override
  Future<CarCreditBalance> getCreditBalance() async {
    return const CarCreditBalance.withBalance(11);
  }

  @override
  Future<SearchProfile> getSearchProfile() async {
    if (stallNextProfile && !_profileHeld) {
      _profileHeld = true;
      await profileHold.future;
      profileFinished = true;
      final error = profileError;
      if (error != null) throw error;
      _returnStaleStarters = true;
      return SearchProfile(
        userId: 'old',
        personalize: true,
        items: [
          MemoryItem(
            id: 'old-memory',
            kind: MemoryKind.makes,
            value: 'Oldsession',
            source: MemorySource.explicit,
            updatedAt: DateTime.utc(2026, 1, 1),
          ),
        ],
      );
    }
    return const SearchProfile(userId: 'gated', personalize: false);
  }

  @override
  Future<List<StarterCard>> getStarters() async {
    if (_returnStaleStarters) {
      _returnStaleStarters = false;
      return const [
        StarterCard(
          kind: StarterKind.generic,
          kicker: 'OLD',
          title: _oldStarter,
          action: StarterAction(mode: 'ask', prompt: 'old'),
        ),
      ];
    }
    return const [];
  }

  @override
  Future<ChatThread> sendMessage(
    String text, {
    Set<String>? enabledMemoryIds,
  }) async {
    if (stallSend && !_sendHeld) {
      _sendHeld = true;
      await sendHold.future;
      sendFinished = true;
      final error = sendError;
      if (error != null) throw error;
      return ChatThread(
        id: 'chat_old',
        mode: ChatMode.ask,
        messages: const [
          ChatMessage(
            id: 'old-answer',
            role: MessageRole.agent,
            contentType: MessageContentType.text,
            text: _oldAnswer,
          ),
        ],
      );
    }
    return const ChatThread(id: 'chat_main', mode: ChatMode.ask);
  }

  @override
  Future<List<Listing>> searchListings({
    String? query,
    int? maxPrice,
    List<String>? bodyTypes,
    int? radius,
    int limit = 10,
    SearchFilters? filters,
  }) async {
    if (stallSearch && !_searchHeld && (query?.trim().isNotEmpty ?? false)) {
      _searchHeld = true;
      await searchHold.future;
      searchFinished = true;
      final error = searchError;
      if (error != null) throw error;
      return const [
        Listing(
          id: 'old-listing',
          vin: 'OLDSESSIONMARKER0001',
          price: 24000,
          build: ListingBuild(year: 2024, make: 'Oldsession', model: 'Marker'),
          media: ListingMedia(photoLinks: []),
        ),
      ];
    }
    return const [];
  }

  @override
  Future<PurchaseResult> purchasePack(CarPackType packType) async {
    if (stallPurchase && !_purchaseHeld) {
      _purchaseHeld = true;
      await purchaseHold.future;
      purchaseFinished = true;
      return purchaseResult;
    }
    return const PurchaseCancelled();
  }

  @override
  Future<RestoreResult> restorePurchases() async {
    if (stallRestore && !_restoreHeld) {
      _restoreHeld = true;
      await restoreHold.future;
      restoreFinished = true;
      final error = restoreError;
      if (error != null) throw error;
      return const RestoreSuccess(creditsRestored: 5);
    }
    return const RestoreNoPurchases();
  }
}
