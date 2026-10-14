import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_config.dart';
import 'package:drevvy_app/data/auth/auth_api.dart';
import 'package:drevvy_app/data/auth/auth_controller.dart';
import 'package:drevvy_app/data/auth/auth_exception.dart';
import 'package:drevvy_app/data/auth/consumer_session.dart';
import 'package:drevvy_app/data/auth/identity_client.dart';
import 'package:drevvy_app/data/auth/identity_nonce.dart';
import 'package:drevvy_app/data/auth/session_store.dart';
import 'package:drevvy_app/data/notifications/device_registration.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
import 'package:drevvy_app/data/notifications/notification_prompt.dart';
import 'package:drevvy_app/data/notifications/push_deep_link.dart';
import 'package:drevvy_app/data/notifications/push_messaging.dart';
import 'package:drevvy_app/data/notifications/push_notification_service.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

void main() {
  const sessionJson = {
    'success': true,
    'data': {
      'accessToken': 'access-token',
      'refreshToken': 'refresh-token',
      'expiresAt': 1_800_000_000,
      'consumerUserId': 'user-1',
    },
  };

  group('consumer session', () {
    test('parses the public session and ignores contact fields', () {
      final session = parseConsumerSession({
        ...sessionJson,
        'data': {
          ...sessionJson['data'] as Map<String, Object?>,
          'email': 'hidden@example.com',
        },
      });

      expect(session.accessToken, 'access-token');
      expect(session.refreshToken, 'refresh-token');
      expect(session.expiresAt, 1_800_000_000);
      expect(session.consumerUserId, 'user-1');
      expect(session.toStorage().containsKey('email'), isFalse);
    });

    test('refuses an incomplete session', () {
      expect(
        () => parseConsumerSession({
          'success': true,
          'data': {'accessToken': 'access', 'consumerUserId': 'user-1'},
        }),
        throwsA(isA<AuthException>().having((error) => error.code, 'code', 'session_missing')),
      );
    });

    test('refreshes inside the one-minute window', () {
      final session = parseConsumerSession(sessionJson);
      final expiry = DateTime.fromMillisecondsSinceEpoch(session.expiresAt! * 1000, isUtc: true);
      expect(session.shouldRefresh(expiry.subtract(const Duration(seconds: 30))), isTrue);
      expect(session.shouldRefresh(expiry.subtract(const Duration(minutes: 10))), isFalse);
    });

    test('apple nonce sent to the backend is the raw value, not the hash', () {
      const raw = 'raw-nonce-value';
      final hashed = sha256Nonce(raw);
      expect(hashed, isNot(raw));
      expect(hashed, hasLength(64));
    });
  });

  group('auth api', () {
    test('apple and google post identity tokens to the consumer auth routes', () async {
      final calls = <http.Request>[];
      final api = AuthApi(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          calls.add(request);
          return http.Response(jsonEncode(sessionJson), 200);
        }),
      );

      await api.signInWithApple(identityToken: 'a.b.c', nonce: 'raw-nonce');
      await api.signInWithGoogle(identityToken: 'g.o.ogle');

      expect(calls[0].url.path, DrevvyConfig.applePath);
      expect(jsonDecode(calls[0].body), {'identityToken': 'a.b.c', 'nonce': 'raw-nonce'});
      expect(calls[1].url.path, DrevvyConfig.googlePath);
      expect(jsonDecode(calls[1].body), {'identityToken': 'g.o.ogle'});
    });

    test('refresh and sign-out use the existing auth routes', () async {
      final calls = <http.Request>[];
      final api = AuthApi(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          calls.add(request);
          if (request.url.path.endsWith('refresh')) {
            return http.Response(jsonEncode(sessionJson), 200);
          }
          return http.Response(jsonEncode({'success': true}), 200);
        }),
      );

      await api.refresh('refresh-token');
      await api.signOut('access-token');

      expect(calls[0].url.path, DrevvyConfig.refreshPath);
      expect(jsonDecode(calls[0].body), {'refreshToken': 'refresh-token'});
      expect(calls[1].url.path, DrevvyConfig.signOutPath);
      expect(calls[1].headers['Authorization'], 'Bearer access-token');
    });

    test('surfaces the backend error message', () async {
      final api = AuthApi(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          return http.Response(
            jsonEncode({
              'success': false,
              'error': {'code': 'apple_rejected', 'message': 'Apple sign-in was rejected.'},
            }),
            401,
          );
        }),
      );

      expect(
        api.signInWithApple(identityToken: 'a.b.c'),
        throwsA(isA<AuthException>().having((error) => error.message, 'message', 'Apple sign-in was rejected.')),
      );
    });
  });

  group('auth controller', () {
    test('stores a session after Apple sign-in and profile confirmation', () async {
      final store = MemorySessionStore();
      final api = _successApi(profileStatus: 200);
      final controller = AuthController(
        api: api,
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'a.b.c', nonce: 'nonce')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
      );

      final result = await controller.signInWithApple();
      expect(result, isA<AuthSuccess>());
      expect((await store.read())?.consumerUserId, 'user-1');
    });

    test('stores a session after Google sign-in', () async {
      final store = MemorySessionStore();
      final controller = AuthController(
        api: _successApi(profileStatus: 200),
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'g.o.ogle')),
      );

      final result = await controller.signInWithGoogle();
      expect(result, isA<AuthSuccess>());
      expect(await store.read(), isNotNull);
    });

    test('a cancelled sign-in leaves demo mode with no session', () async {
      final store = MemorySessionStore();
      var apiCalled = false;
      final controller = AuthController(
        api: AuthApi(
          baseUrl: 'https://drevvy.test',
          client: _ScriptedClient((request) async {
            apiCalled = true;
            return http.Response('{}', 500);
          }),
        ),
        store: store,
        apple: _ThrowingIdentity(const AuthCancelledException()),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
      );

      expect(await controller.signInWithApple(), isA<AuthCancelled>());
      expect(apiCalled, isFalse);
      expect(await controller.currentSession(), isNull);
      expect(await DemoRepository.instance.getCurrentUser(), isNotNull);
    });

    test('a rejected sign-in does not store a session', () async {
      final store = MemorySessionStore();
      final controller = AuthController(
        api: AuthApi(
          baseUrl: 'https://drevvy.test',
          client: _ScriptedClient((request) async {
            return http.Response(
              jsonEncode({
                'success': false,
                'error': {'code': 'apple_rejected', 'message': 'Apple sign-in was rejected.'},
              }),
              401,
            );
          }),
        ),
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'a.b.c', nonce: 'nonce')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
      );

      final result = await controller.signInWithApple();
      expect(result, isA<AuthFailure>());
      expect(await store.read(), isNull);
    });

    test('sign-out calls the backend and clears the session', () async {
      final store = MemorySessionStore();
      final calls = <http.Request>[];
      final api = AuthApi(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          calls.add(request);
          if (request.url.path == DrevvyConfig.profilePath) {
            return http.Response(jsonEncode({'success': true, 'data': {}}), 200);
          }
          if (request.url.path == DrevvyConfig.signOutPath) {
            return http.Response(jsonEncode({'success': true}), 200);
          }
          return http.Response(jsonEncode(sessionJson), 200);
        }),
      );
      final controller = AuthController(
        api: api,
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'a.b.c', nonce: 'nonce')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
      );

      await controller.signInWithApple();
      await controller.signOut();

      expect(calls.last.url.path, DrevvyConfig.signOutPath);
      expect(await store.read(), isNull);
      expect(await controller.currentSession(), isNull);
    });

    test('sign-out deletes the device token before clearing the session', () async {
      final store = MemorySessionStore();
      final calls = <http.Request>[];
      var sessionPresentAtDelete = false;
      final client = _ScriptedClient((request) async {
        calls.add(request);
        if (request.method == 'DELETE' && request.url.path == DrevvyConfig.devicesPath) {
          sessionPresentAtDelete = await store.read() != null;
          return http.Response('missing', 404);
        }
        if (request.url.path == DrevvyConfig.profilePath) {
          return http.Response(jsonEncode({'success': true, 'data': {}}), 200);
        }
        if (request.url.path == DrevvyConfig.signOutPath) {
          return http.Response(jsonEncode({'success': true}), 200);
        }
        return http.Response(jsonEncode(sessionJson), 200);
      });
      final controller = AuthController(
        api: AuthApi(baseUrl: 'https://drevvy.test', client: client),
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'a.b.c', nonce: 'nonce')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
        devices: DeviceRegistrar(baseUrl: 'https://drevvy.test', client: client),
        deviceToken: () async => 'fcm-token',
        platform: () => 'ios',
      );

      await controller.signInWithApple();
      await controller.signOut();

      final deleteIndex = calls.indexWhere(
        (request) => request.method == 'DELETE' && request.url.path == DrevvyConfig.devicesPath,
      );
      final signOutIndex = calls.indexWhere((request) => request.url.path == DrevvyConfig.signOutPath);
      expect(deleteIndex, greaterThanOrEqualTo(0));
      expect(signOutIndex, greaterThan(deleteIndex));
      expect(sessionPresentAtDelete, isTrue);
      expect(calls[deleteIndex].headers['Authorization'], 'Bearer access-token');
      expect(jsonDecode(calls[deleteIndex].body), {
        'token': 'fcm-token',
        'platform': 'ios',
        'provider': 'fcm',
      });
      expect(await store.read(), isNull);
    });

    test('an expired session is refreshed', () async {
      final store = MemorySessionStore();
      await store.write(const ConsumerSession(
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        expiresAt: 100,
        consumerUserId: 'user-1',
      ));
      final api = AuthApi(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          expect(jsonDecode(request.body), {'refreshToken': 'old-refresh'});
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'accessToken': 'new-access',
                'refreshToken': 'new-refresh',
                'expiresAt': 4_000_000_000,
                'consumerUserId': 'user-1',
              },
            }),
            200,
          );
        }),
      );
      final controller = AuthController(
        api: api,
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
        now: () => DateTime.fromMillisecondsSinceEpoch(200 * 1000, isUtc: true),
      );

      final session = await controller.currentSession();
      expect(session?.accessToken, 'new-access');
    });

    test('a failed refresh returns to demo mode', () async {
      final store = MemorySessionStore();
      await store.write(const ConsumerSession(
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        expiresAt: 100,
        consumerUserId: 'user-1',
      ));
      final controller = AuthController(
        api: AuthApi(
          baseUrl: 'https://drevvy.test',
          client: _ScriptedClient((request) async {
            return http.Response(
              jsonEncode({
                'success': false,
                'error': {'code': 'unauthorized', 'message': 'Your sign-in has expired. Please sign in again.'},
              }),
              401,
            );
          }),
        ),
        store: store,
        apple: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
        google: _FixedIdentity(const ProviderIdentity(identityToken: 'unused')),
        now: () => DateTime.fromMillisecondsSinceEpoch(200 * 1000, isUtc: true),
      );

      expect(await controller.currentSession(), isNull);
      expect(await store.read(), isNull);
    });
  });

  group('push', () {
    test('deep links cover every notification type', () {
      expect(locationForPush({'type': 'price_drop', 'dealId': 'deal 1'}), '/deal/deal%201');
      expect(locationForPush({'type': 'offer_ready', 'deal_id': 'd2'}), '/deal/d2');
      expect(locationForPush({'type': 'car_sold', 'dealId': 'd3'}), '/deal/d3');
      expect(locationForPush({'type': 'official_offer', 'dealId': 'd4'}), '/deal/d4/official');
      expect(locationForPush({'type': 'did_you_buy', 'dealId': 'd5'}), '/deal/d5?prompt=did_you_buy');
      expect(locationForPush({'type': 'unknown', 'dealId': 'd6'}), isNull);
      expect(locationForPush({'type': 'price_drop'}), isNull);
    });

    test('device registration no-ops when signed out or the route is missing', () async {
      final registrar = DeviceRegistrar(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          return http.Response('missing', 404);
        }),
      );
      const session = ConsumerSession(
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: null,
        consumerUserId: 'user-1',
      );

      final signedOut = await registrar.register(session: null, token: 'fcm', platform: 'ios');
      expect(signedOut.status, DeviceRegistrationStatus.skipped);

      final missing = await registrar.register(session: session, token: 'fcm', platform: 'ios');
      expect(missing.status, DeviceRegistrationStatus.skipped);
      expect(missing.statusCode, 404);
    });

    test('device registration posts the token with the session', () async {
      http.Request? captured;
      final registrar = DeviceRegistrar(
        baseUrl: 'https://drevvy.test',
        client: _ScriptedClient((request) async {
          captured = request;
          return http.Response(jsonEncode({'success': true}), 201);
        }),
      );

      final result = await registrar.register(
        session: const ConsumerSession(
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: null,
          consumerUserId: 'user-1',
        ),
        token: 'fcm-token',
        platform: 'ios',
      );

      expect(result.status, DeviceRegistrationStatus.registered);
      expect(captured?.url.path, DrevvyConfig.devicesPath);
      expect(captured?.headers['Authorization'], 'Bearer access');
      expect(jsonDecode(captured!.body), {
        'token': 'fcm-token',
        'platform': 'ios',
        'provider': 'fcm',
      });
    });

    test('notification permission is not requested at launch', () async {
      final messaging = _RecordingPush();
      final flags = MemoryFlags();
      final service = PushNotificationService(
        messaging: messaging,
        devices: DeviceRegistrar(
          baseUrl: 'https://drevvy.test',
          client: _ScriptedClient((request) async => http.Response('missing', 404)),
        ),
        sessions: MemorySessionStore(),
        flags: flags,
        links: DeepLinkBus(),
        platform: () => 'ios',
      );

      await service.restoreWithoutPrompting();
      expect(messaging.enableCalls, 0);
      expect(messaging.resumeCalls, 0);

      final gate = NotificationPromptGate(flags: flags);
      expect(await gate.shouldPromptAfterAdd(), isTrue);
      await gate.markPrompted();
      expect(await gate.shouldPromptAfterAdd(), isFalse);
    });

    test('enabling push after the first car registers a token when signed in', () async {
      final messaging = _RecordingPush();
      final flags = MemoryFlags();
      final sessions = MemorySessionStore();
      await sessions.write(const ConsumerSession(
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: null,
        consumerUserId: 'user-1',
      ));
      http.Request? captured;
      final service = PushNotificationService(
        messaging: messaging,
        devices: DeviceRegistrar(
          baseUrl: 'https://drevvy.test',
          client: _ScriptedClient((request) async {
            captured = request;
            return http.Response(jsonEncode({'success': true}), 200);
          }),
        ),
        sessions: sessions,
        flags: flags,
        links: DeepLinkBus(),
        platform: () => 'android',
      );

      await service.enable();

      expect(messaging.enableCalls, 1);
      expect(captured?.url.path, DrevvyConfig.devicesPath);
      expect(jsonDecode(captured!.body)['platform'], 'android');
    });
  });
}

AuthApi _successApi({required int profileStatus}) {
  return AuthApi(
    baseUrl: 'https://drevvy.test',
    client: _ScriptedClient((request) async {
      if (request.url.path == DrevvyConfig.profilePath) {
        return http.Response(jsonEncode({'success': true, 'data': {'consumerUserId': 'user-1'}}), profileStatus);
      }
      return http.Response(jsonEncode({
        'success': true,
        'data': {
          'accessToken': 'access-token',
          'refreshToken': 'refresh-token',
          'expiresAt': 4_000_000_000,
          'consumerUserId': 'user-1',
        },
      }), 200);
    }),
  );
}

class _FixedIdentity implements IdentityClient {
  _FixedIdentity(this.identity);
  final ProviderIdentity identity;

  @override
  Future<ProviderIdentity> signIn() async => identity;
}

class _ThrowingIdentity implements IdentityClient {
  _ThrowingIdentity(this.error);
  final Object error;

  @override
  Future<ProviderIdentity> signIn() async => throw error;
}

class _RecordingPush implements PushMessaging {
  int enableCalls = 0;
  int resumeCalls = 0;

  @override
  Future<PushPermission> enable() async {
    enableCalls += 1;
    return const PushPermission(granted: true, configured: true, token: 'fcm-token');
  }

  @override
  Future<PushPermission> resume() async {
    resumeCalls += 1;
    return const PushPermission(granted: true, configured: true, token: 'fcm-token');
  }
}

class _ScriptedClient extends http.BaseClient {
  _ScriptedClient(this._handler);

  final Future<http.Response> Function(http.Request request) _handler;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final bytes = await request.finalize().toBytes();
    final materialized = http.Request(request.method, request.url)
      ..bodyBytes = bytes
      ..headers.addAll(request.headers);
    final response = await _handler(materialized);
    return http.StreamedResponse(
      Stream<List<int>>.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
    );
  }
}
