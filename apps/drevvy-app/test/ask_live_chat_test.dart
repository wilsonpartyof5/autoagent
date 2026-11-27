import 'dart:async';
import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/models/models.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/ask_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/shop/screens/shop_screen.dart';
import 'package:drevvy_app/features/shop/widgets/inventory_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _live = PurchaseConfig(
  apiBaseUrl: 'https://api.drevvy.com',
  mode: DrevvyDataMode.live,
);

// #165 shape: lowercase uuid + '.' + 64-char lowercase hex HMAC = 101 chars.
const _convo =
    '3f1c2a4e-9b7d-4c1e-8a2f-0d9e8b7c6a51.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const _convoNext =
    '3f1c2a4e-9b7d-4c1e-8a2f-0d9e8b7c6a51.abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
const _sentence = '150s under \$45k in fort mill South Carolina';

const _f150 = Listing(
  id: 'mc-f150-1',
  vin: '1FTFW1E50PFA00001',
  price: 43990,
  miles: 21000,
  build: ListingBuild(year: 2022, make: 'Ford', model: 'F-150'),
  media: ListingMedia(photoLinks: []),
);

/// Records calls. Each call waits on the next queued completer.
class _FakeAsk extends AskEndpoint {
  final calls = <({String message, String? conversationId, double? lat})>[];
  final pending = <Completer<AskResult>>[];

  Completer<AskResult> get last => pending.last;

  @override
  Future<AskResult> ask({
    required String message,
    String? conversationId,
    double? lat,
    double? lng,
    String? zip,
  }) {
    calls.add((message: message, conversationId: conversationId, lat: lat));
    final completer = Completer<AskResult>();
    pending.add(completer);
    return completer.future;
  }
}

DemoRepository _repo(AskEndpoint ask) =>
    DemoRepository(config: _live, networkDelay: Duration.zero, ask: ask);

Widget _shop(DemoRepository repo) => MaterialApp(
  theme: drevvyTheme(Brightness.light),
  home: ShopScreen(
    repository: repo,
    discoverConfig: const DiscoverConfig(
      apiBaseUrl: '',
      mode: DrevvyDataMode.demo,
    ),
  ),
);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _type(WidgetTester tester, String text) async {
  await tester.enterText(find.byType(TextField), text);
  await tester.testTextInput.receiveAction(TextInputAction.send);
  await tester.pump();
}

String _composerText(WidgetTester tester) =>
    tester.widget<TextField>(find.byType(TextField)).controller!.text;

void main() {
  group('repository', () {
    test(
      'conversationId round-trips and the thread stays on the phone',
      () async {
        final ask = _FakeAsk();
        final repo = _repo(ask);

        final first = repo.sendMessage(_sentence, lat: 35.0, lng: -80.9);
        expect(repo.currentChatThread.messages.single.text, _sentence);
        ask.last.complete(
          const AskResult(
            reply: 'Here are some F-150s.',
            conversationId: _convo,
            listings: [_f150],
            total: 1,
          ),
        );
        final thread = await first;
        expect(ask.calls.single.conversationId, isNull);
        expect(ask.calls.single.lat, 35.0);
        expect(thread.messages.last.text, 'Here are some F-150s.');
        expect(thread.messages.last.listings, [_f150]);
        expect(repo.askConversationId, _convo);

        expect(_convo.length, 101);
        expect(_convoNext.length, 101);

        final second = repo.sendMessage('What about 2021s?');
        ask.last.complete(
          const AskResult(reply: 'Sure.', conversationId: _convoNext),
        );
        final next = await second;
        expect(ask.calls[1].conversationId, _convo);
        expect(repo.askConversationId, _convoNext);
        expect(next.messages.map((m) => m.text), [
          _sentence,
          'Here are some F-150s.',
          'What about 2021s?',
          'Sure.',
        ]);

        final third = repo.sendMessage('Any cheaper?');
        ask.last.complete(
          const AskResult(reply: 'A few.', conversationId: _convoNext),
        );
        await third;
        expect(ask.calls[2].conversationId, _convoNext);
      },
    );

    test(
      'conversation_forbidden clears the id and retries once with no id',
      () async {
        final ask = _FakeAsk();
        final repo = _repo(ask);

        final first = repo.sendMessage('hi');
        ask.last.complete(
          const AskResult(reply: 'Hello.', conversationId: _convo),
        );
        await first;
        expect(repo.askConversationId, _convo);

        final second = repo.sendMessage('still there?');
        ask.last.completeError(
          const AskException(
            code: 'conversation_forbidden',
            message: AskCopy.network,
            status: 403,
            canRetry: true,
          ),
        );
        await Future<void>.value();
        expect(repo.askConversationId, isNull);
        expect(ask.calls, hasLength(3));
        expect(ask.calls[1].conversationId, _convo);
        expect(ask.calls[1].message, 'still there?');
        expect(ask.calls[2].conversationId, isNull);
        expect(ask.calls[2].message, 'still there?');

        ask.last.complete(
          const AskResult(reply: 'Starting fresh.', conversationId: _convoNext),
        );
        final thread = await second;
        expect(ask.calls, hasLength(3));
        expect(ask.calls[2].conversationId, isNull);
        expect(ask.calls[2].message, 'still there?');
        expect(thread.messages.last.text, 'Starting fresh.');
        expect(
          thread.messages.last.contentType,
          isNot(MessageContentType.error),
        );
        expect(repo.askConversationId, _convoNext);
      },
    );

    test('conversation_forbidden retry failure shows the send copy, not dealer copy', () async {
      final ask = _FakeAsk();
      final repo = _repo(ask);

      final first = repo.sendMessage('hi');
      ask.last.complete(
        const AskResult(reply: 'Hello.', conversationId: _convo),
      );
      await first;

      final second = repo.sendMessage('still there?');
      ask.last.completeError(
        const AskException(
          code: 'conversation_forbidden',
          message: AskCopy.network,
          status: 403,
          canRetry: true,
        ),
      );
      await Future<void>.value();
      ask.last.completeError(
        const AskException(
          code: 'conversation_forbidden',
          message: AskCopy.network,
          status: 403,
          canRetry: true,
        ),
      );
      final thread = await second;
      expect(ask.calls, hasLength(3));
      expect(ask.calls[2].conversationId, isNull);
      expect(thread.messages.last.contentType, MessageContentType.error);
      expect(thread.messages.last.text, AskCopy.network);
      expect(thread.messages.last.text, isNot(AskCopy.dealerAccount));
      expect(thread.messages.last.canRetry, isTrue);
      expect(repo.askConversationId, isNull);
    });

    test(
      'dealer_account is not retried and stays "Ask is for shoppers."',
      () async {
        final ask = _FakeAsk();
        final repo = _repo(ask);
        final first = repo.sendMessage('hi');
        ask.last.completeError(
          const AskException(
            code: 'dealer_account',
            message: AskCopy.dealerAccount,
            status: 403,
          ),
        );
        final thread = await first;
        expect(ask.calls, hasLength(1));
        expect(thread.messages.last.text, AskCopy.dealerAccount);
        expect(thread.messages.last.canRetry, isFalse);
      },
    );

    test(
      'an error is added as a bubble and retry does not repeat the message',
      () async {
        final ask = _FakeAsk();
        final repo = _repo(ask);
        final first = repo.sendMessage('hi');
        ask.last.completeError(
          const AskException(
            code: 'ask_unavailable',
            message: AskCopy.busy,
            status: 503,
            canRetry: true,
          ),
        );
        final failed = await first;
        expect(failed.messages.last.contentType, MessageContentType.error);
        expect(failed.messages.last.text, AskCopy.busy);
        expect(failed.messages.last.canRetry, isTrue);

        final retry = repo.retryLastAsk();
        expect(repo.currentChatThread.messages.map((m) => m.text), ['hi']);
        ask.last.complete(const AskResult(reply: 'Hello!', conversationId: ''));
        final done = await retry;
        expect(ask.calls.map((c) => c.message), ['hi', 'hi']);
        expect(done.messages.map((m) => m.text), ['hi', 'Hello!']);
      },
    );

    test('an unexpected error still shows the send copy', () async {
      final ask = _FakeAsk();
      final repo = _repo(ask);
      final first = repo.sendMessage('hi');
      ask.last.completeError(const FormatException('bad'));
      final thread = await first;
      expect(thread.messages.last.text, AskCopy.network);
      expect(thread.messages.last.canRetry, isTrue);
    });

    test('a new chat drops the old conversation id and late answers', () async {
      final ask = _FakeAsk();
      final repo = _repo(ask);
      final first = repo.sendMessage('hi');
      ask.last.complete(const AskResult(reply: 'a', conversationId: _convo));
      await first;
      expect(repo.askConversationId, _convo);

      final late = repo.sendMessage('still there?');
      final fresh = repo.startNewAskChat();
      expect(fresh.isEmpty, isTrue);
      expect(repo.askConversationId, isNull);
      ask.last.complete(const AskResult(reply: 'late', conversationId: _convo));
      await late;
      expect(repo.currentChatThread.isEmpty, isTrue);
      expect(repo.askConversationId, isNull);
    });

    test('signing out clears the Ask chat', () async {
      final ask = _FakeAsk();
      final repo = _repo(ask);
      final first = repo.sendMessage('hi');
      ask.last.complete(const AskResult(reply: 'a', conversationId: _convo));
      await first;
      repo.clearSignedInState();
      expect(repo.currentChatThread.isEmpty, isTrue);
      expect(repo.askConversationId, isNull);
    });

    test('demo mode keeps the sample answer and never calls Ask', () async {
      final ask = _FakeAsk();
      final repo = DemoRepository(
        config: const PurchaseConfig(),
        networkDelay: Duration.zero,
        ask: ask,
      );
      final thread = await repo.sendMessage('Is the RAV4 a fair price?');
      expect(ask.calls, isEmpty);
      expect(thread.messages.last.isAgent, isTrue);
      expect(thread.messages.last.contentType, MessageContentType.text);
    });
  });

  group('Ask chat screen', () {
    testWidgets('send shows the message, clears the box, and says Thinking', (
      tester,
    ) async {
      final ask = _FakeAsk();
      await tester.pumpWidget(_shop(_repo(ask)));
      await _settle(tester);

      await _type(tester, _sentence);
      expect(find.text(_sentence), findsOneWidget);
      expect(find.text('Thinking…'), findsOneWidget);
      expect(_composerText(tester), isEmpty);
      expect(ask.calls, hasLength(1));

      // A second send while thinking is ignored and keeps the typed text.
      await _type(tester, 'again');
      expect(ask.calls, hasLength(1));
      expect(_composerText(tester), 'again');

      ask.last.complete(
        const AskResult(
          reply: 'Here are some F-150s.',
          conversationId: _convo,
          listings: [_f150],
        ),
      );
      await _settle(tester);
      expect(find.text('Thinking…'), findsNothing);
      expect(find.text('Here are some F-150s.'), findsOneWidget);
      expect(find.byType(InventoryCard), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a busy server shows plain copy and Try again works', (
      tester,
    ) async {
      final ask = _FakeAsk();
      await tester.pumpWidget(_shop(_repo(ask)));
      await _settle(tester);

      await _type(tester, 'hi');
      ask.last.completeError(
        const AskException(
          code: 'ask_unavailable',
          message: AskCopy.busy,
          status: 503,
          canRetry: true,
        ),
      );
      await _settle(tester);
      expect(find.text(AskCopy.busy), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pump();
      expect(find.text('Thinking…'), findsOneWidget);
      expect(find.text(AskCopy.busy), findsNothing);
      expect(find.text('hi'), findsOneWidget);
      ask.last.complete(const AskResult(reply: 'Hello!', conversationId: ''));
      await _settle(tester);
      expect(find.text('Hello!'), findsOneWidget);
      expect(ask.calls, hasLength(2));
    });

    testWidgets('a network failure shows the send copy with retry', (
      tester,
    ) async {
      final ask = _FakeAsk();
      await tester.pumpWidget(_shop(_repo(ask)));
      await _settle(tester);
      await _type(tester, 'hi');
      ask.last.completeError(
        const AskException(
          code: 'network',
          message: AskCopy.network,
          canRetry: true,
        ),
      );
      await _settle(tester);
      expect(find.text("We couldn't send that. Try again."), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('signed out says Sign in to ask, with no retry and no call', (
      tester,
    ) async {
      var calls = 0;
      final repo = _repo(
        HttpAskEndpoint(
          baseUrl: 'https://api.drevvy.com',
          sessionStore: ShopperSessionStore(),
          client: MockClient((_) async {
            calls++;
            return http.Response(jsonEncode({'reply': 'x'}), 200);
          }),
        ),
      );
      await tester.pumpWidget(_shop(repo));
      await _settle(tester);
      await _type(tester, _sentence);
      await _settle(tester);
      expect(find.text(_sentence), findsOneWidget);
      expect(find.text('Sign in to ask.'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
      expect(calls, 0);
    });

    testWidgets('rate limit shows plain copy without retry', (tester) async {
      final ask = _FakeAsk();
      await tester.pumpWidget(_shop(_repo(ask)));
      await _settle(tester);
      await _type(tester, 'hi');
      ask.last.completeError(
        const AskException(
          code: 'rate_limited',
          message: AskCopy.rateLimited,
          status: 429,
        ),
      );
      await _settle(tester);
      expect(find.text("You've asked a lot. Try again later."), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('a slow first load cannot erase a sent message', (
      tester,
    ) async {
      final ask = _FakeAsk();
      final repo = _SlowThreadRepo(ask);
      await tester.pumpWidget(_shop(repo));
      await tester.pump();

      await _type(tester, 'hello');
      expect(find.text('hello'), findsOneWidget);

      // The old, empty snapshot arrives after the send.
      repo.gate.complete();
      await _settle(tester);
      expect(find.text('hello'), findsOneWidget);
      expect(find.text('Thinking…'), findsOneWidget);

      ask.last.complete(const AskResult(reply: 'Hi!', conversationId: ''));
      await _settle(tester);
      expect(find.text('hello'), findsOneWidget);
      expect(find.text('Hi!'), findsOneWidget);
    });
  });
}

class _SlowThreadRepo extends DemoRepository {
  _SlowThreadRepo(AskEndpoint ask)
    : super(config: _live, networkDelay: Duration.zero, ask: ask);

  final Completer<void> gate = Completer<void>();

  @override
  Future<ChatThread> getChatThread() async {
    final stale = ChatThread(id: 'chat_main', mode: ChatMode.ask);
    await gate.future;
    return stale;
  }
}
