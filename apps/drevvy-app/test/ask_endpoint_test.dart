import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/data/services/ask_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _convo = '3f1c2a4e-9b7d-4c1e-8a2f-0d9e8b7c6a51';

ShopperSessionStore _signedIn() =>
    ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'test-shopper-jwt');

HttpAskEndpoint _endpoint(
  MockClient client, {
  ShopperSessionStore? store,
  Duration timeout = const Duration(seconds: 5),
  String baseUrl = 'https://api.drevvy.com',
}) {
  return HttpAskEndpoint(
    baseUrl: baseUrl,
    client: client,
    sessionStore: store ?? _signedIn(),
    timeout: timeout,
  );
}

Map<String, Object?> _listing(String id) => {
  'id': id,
  'vin': '1FTFW1E50PFA00001',
  'price': 43990,
  'miles': 21000,
  'build': {'year': 2022, 'make': 'Ford', 'model': 'F-150'},
  'media': {
    'photo_links': ['https://cdn.example/f150.jpg'],
  },
};

http.Response _ok(Map<String, Object?> body) =>
    http.Response(jsonEncode(body), 200);

http.Response _err(int status, String code) => http.Response(
  jsonEncode({
    'error': {'code': code, 'message': 'server text the app never shows'},
  }),
  status,
);

Matcher _askError({
  required int status,
  required String message,
  required bool canRetry,
  String? code,
}) {
  var matcher = isA<AskException>()
      .having((e) => e.status, 'status', status)
      .having((e) => e.message, 'message', message)
      .having((e) => e.canRetry, 'canRetry', canRetry);
  if (code != null) matcher = matcher.having((e) => e.code, 'code', code);
  return throwsA(matcher);
}

void main() {
  group('fromConfig', () {
    test('demo builds never call the network', () {
      expect(
        AskEndpoint.fromConfig(const PurchaseConfig()),
        isA<UnusedAskEndpoint>(),
      );
    });

    test('live without a URL is unconfigured', () {
      expect(
        AskEndpoint.fromConfig(const PurchaseConfig(mode: DrevvyDataMode.live)),
        isA<UnconfiguredAskEndpoint>(),
      );
    });

    test('live with a URL uses HTTP', () {
      expect(
        AskEndpoint.fromConfig(
          const PurchaseConfig(
            mode: DrevvyDataMode.live,
            apiBaseUrl: 'https://api.drevvy.com',
          ),
        ),
        isA<HttpAskEndpoint>(),
      );
    });
  });

  test('success posts the shopper JWT and the contract body', () async {
    late http.Request captured;
    final endpoint = _endpoint(
      MockClient((request) async {
        captured = request;
        return _ok({
          'reply': 'Here are F-150s under \$45k near Fort Mill.',
          'conversationId': _convo,
          'filters': {'make': 'Ford', 'model': 'F-150', 'price_max': 45000},
          'listings': [
            _listing('mc-f150-1'),
            {'price': 1},
          ],
          'total': 12,
        });
      }),
      baseUrl: 'https://api.drevvy.com/',
    );

    final result = await endpoint.ask(
      message: '  150s under \$45k in fort mill South Carolina  ',
      conversationId: _convo,
      lat: 35.0074,
      lng: -80.9451,
      zip: '29715',
    );

    expect(captured.method, 'POST');
    expect(captured.url.toString(), 'https://api.drevvy.com/api/consumer/ask');
    expect(captured.headers['Authorization'], 'Bearer test-shopper-jwt');
    expect(captured.headers['Content-Type'], startsWith('application/json'));
    expect(jsonDecode(captured.body), {
      'message': '150s under \$45k in fort mill South Carolina',
      'conversationId': _convo,
      'lat': 35.0074,
      'lng': -80.9451,
      'zip': '29715',
    });
    expect(result.reply, 'Here are F-150s under \$45k near Fort Mill.');
    expect(result.conversationId, _convo);
    expect(result.total, 12);
    expect(result.filters['model'], 'F-150');
    expect(result.listings, hasLength(1));
    expect(result.listings.single.id, 'mc-f150-1');
    expect(result.listings.single.build.model, 'F-150');
  });

  test('omits bad conversation ids, null island, and bad zips', () async {
    late Map<String, dynamic> body;
    final endpoint = _endpoint(
      MockClient((request) async {
        body = jsonDecode(request.body) as Map<String, dynamic>;
        return _ok({'reply': 'Hi', 'conversationId': _convo});
      }),
    );
    await endpoint.ask(
      message: 'hello',
      conversationId: 'not-a-uuid',
      lat: 0,
      lng: 0,
      zip: 'Fort Mill',
    );
    expect(body, {'message': 'hello'});
  });

  test('tolerates a {success, data} envelope', () async {
    final endpoint = _endpoint(
      MockClient(
        (_) async => _ok({
          'success': true,
          'data': {'reply': 'Hi there', 'conversationId': _convo},
        }),
      ),
    );
    final result = await endpoint.ask(message: 'hi');
    expect(result.reply, 'Hi there');
    expect(result.conversationId, _convo);
    expect(result.listings, isEmpty);
  });

  test('signed out shows sign in and makes no call', () async {
    var calls = 0;
    final endpoint = _endpoint(
      MockClient((_) async {
        calls++;
        return _ok({'reply': 'x'});
      }),
      store: ShopperSessionStore(),
    );
    await expectLater(
      endpoint.ask(message: 'hi'),
      _askError(status: 401, message: AskCopy.signedOut, canRetry: false),
    );
    expect(calls, 0);
  });

  test('over 500 characters is stopped on the phone', () async {
    var calls = 0;
    final endpoint = _endpoint(
      MockClient((_) async {
        calls++;
        return _ok({'reply': 'x'});
      }),
    );
    await expectLater(
      endpoint.ask(message: 'a' * 501),
      _askError(status: 0, message: AskCopy.tooLong, canRetry: false),
    );
    await endpoint.ask(message: 'a' * 500);
    expect(calls, 1);
  });

  final cases = <(int, String, String, bool)>[
    (400, 'invalid_request', AskCopy.invalidRequest, false),
    (401, 'unauthorized', AskCopy.signedOut, false),
    (403, 'dealer_account', AskCopy.dealerAccount, false),
    (429, 'rate_limited', AskCopy.rateLimited, false),
    (503, 'ask_unavailable', AskCopy.busy, true),
    (500, 'internal', AskCopy.network, true),
  ];
  for (final (status, code, copy, retry) in cases) {
    test('$status $code shows plain copy', () async {
      final endpoint = _endpoint(MockClient((_) async => _err(status, code)));
      await expectLater(
        endpoint.ask(message: 'hi'),
        _askError(status: status, message: copy, canRetry: retry, code: code),
      );
    });
  }

  test('a 404 (route not deployed yet) is a retryable send failure', () async {
    final endpoint = _endpoint(
      MockClient((_) async => http.Response('<html>Not found</html>', 404)),
    );
    await expectLater(
      endpoint.ask(message: 'hi'),
      _askError(status: 404, message: AskCopy.network, canRetry: true),
    );
  });

  test('timeout shows the send copy with retry', () async {
    final endpoint = _endpoint(
      MockClient((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 200));
        return _ok({'reply': 'late'});
      }),
      timeout: const Duration(milliseconds: 20),
    );
    await expectLater(
      endpoint.ask(message: 'hi'),
      _askError(
        status: 0,
        message: AskCopy.network,
        canRetry: true,
        code: 'timeout',
      ),
    );
  });

  test('network error shows the send copy with retry', () async {
    final endpoint = _endpoint(
      MockClient((_) async => throw http.ClientException('offline')),
    );
    await expectLater(
      endpoint.ask(message: 'hi'),
      _askError(
        status: 0,
        message: AskCopy.network,
        canRetry: true,
        code: 'network',
      ),
    );
  });

  test('malformed JSON on 200 is a retryable send failure', () async {
    final endpoint = _endpoint(
      MockClient((_) async => http.Response('{not json', 200)),
    );
    await expectLater(
      endpoint.ask(message: 'hi'),
      _askError(
        status: 0,
        message: AskCopy.network,
        canRetry: true,
        code: 'malformed',
      ),
    );
  });

  test('200 without a reply is a retryable send failure', () async {
    final endpoint = _endpoint(
      MockClient((_) async => _ok({'conversationId': _convo})),
    );
    await expectLater(
      endpoint.ask(message: 'hi'),
      _askError(
        status: 0,
        message: AskCopy.network,
        canRetry: true,
        code: 'malformed',
      ),
    );
  });

  test('error copy never echoes server text', () async {
    final endpoint = _endpoint(
      MockClient((_) async => _err(429, 'rate_limited')),
    );
    try {
      await endpoint.ask(message: 'hi');
      fail('expected an error');
    } on AskException catch (error) {
      expect(error.message, isNot(contains('server text')));
    }
  });

  test('ask spends no keys: only /api/consumer/ask is called', () async {
    final paths = <String>[];
    final endpoint = _endpoint(
      MockClient((request) async {
        paths.add(request.url.path);
        return _ok({'reply': 'ok', 'conversationId': _convo});
      }),
    );
    await endpoint.ask(message: 'hi');
    expect(paths, ['/api/consumer/ask']);
  });
}
