import 'package:drevvy_app/core/config/api_config_exception.dart';
import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/config/drevvy_config.dart';
import 'package:drevvy_app/data/auth/auth_api.dart';
import 'package:drevvy_app/data/auth/auth_exception.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/key_spend_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';
import 'package:drevvy_app/data/services/purchase_service_factory.dart';
import 'package:drevvy_app/data/services/rooftop_match_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/onboarding/matters_v5.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _live = PurchaseConfig(mode: DrevvyDataMode.live);

const _liveUrl = PurchaseConfig(
  mode: DrevvyDataMode.live,
  apiBaseUrl: 'https://api.drevvy.com',
);

const _rav4 = Listing(
  id: 'listing_001',
  vin: '2T3P1RFV5RC123456',
  price: 32995,
  build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
  media: ListingMedia(photoLinks: []),
);

void main() {
  test('the default define is demo and auth shares the purchase origin', () {
    final api = DrevvyApiConfig.fromEnvironment();
    final purchase = PurchaseConfig.fromEnvironment();

    expect(api.isDemo, isTrue);
    expect(api.isLive, isFalse);
    expect(api.origin, isEmpty);
    expect(api.origin, isNot('https://www.drevvy.com'));
    expect(DrevvyConfig.apiBaseUrl, purchase.apiBaseUrl);
    expect(purchase.apiBaseUrl, isEmpty);
    expect(purchase.isLive, isFalse);
    expect(DrevvyApiConfig.modeFromDefine('LIVE'), DrevvyDataMode.live);
    expect(DrevvyApiConfig.modeFromDefine('nope'), DrevvyDataMode.demo);
  });

  test('demo mode keeps the local stubs', () {
    const demo = PurchaseConfig();
    expect(CreditsEndpoint.fromConfig(demo), isA<MissingCreditsEndpoint>());
    expect(KeySpendEndpoint.fromConfig(demo), isA<MissingKeySpendEndpoint>());
    expect(
      RooftopMatchEndpoint.fromConfig(demo),
      isA<StubRooftopMatchEndpoint>(),
    );
    expect(buildPurchaseService(demo), isA<FakePurchaseService>());
  });

  test('live mode without a URL does not use Missing success paths', () async {
    expect(
      CreditsEndpoint.fromConfig(_live),
      isA<UnconfiguredCreditsEndpoint>(),
    );
    expect(
      KeySpendEndpoint.fromConfig(_live),
      isA<UnconfiguredKeySpendEndpoint>(),
    );
    expect(
      RooftopMatchEndpoint.fromConfig(_live),
      isA<UnconfiguredRooftopMatchEndpoint>(),
    );
    expect(buildPurchaseService(_live), isA<UnavailablePurchaseService>());

    final repo = DemoRepository(config: _live, networkDelay: Duration.zero);
    expect((await repo.getCreditBalance()).balance, 0);
    expect(repo.creditNotice, ApiConfigException.notConfigured.message);
    expect(await repo.pullSignedInBalance(), isFalse);
    expect((await repo.getCreditBalance()).balance, 0);
    expect(await repo.grantStarterKeys(), isFalse);
    expect((await repo.getCreditBalance()).balance, 0);

    expect(await repo.unlockMarketIntel(_rav4), isFalse);
    expect((await repo.getCreditBalance()).balance, 0);
    expect(repo.hasUnlockedMarketIntel(_rav4.id), isFalse);

    final match = await repo.getRooftopMatch(_rav4);
    expect(match.source, RooftopMatchSource.unavailable);
    expect(match.isInNetwork, isFalse);
    expect(match.rooftopId, isNot(StubRooftopMatchEndpoint.demoRooftopId));

    expect(await repo.requestOtdNumber(_rav4), isFalse);
    expect(repo.hasRequestedOtd(_rav4.id), isFalse);

    final purchase = await repo.purchasePack(CarPackType.single);
    expect(purchase, isA<PurchaseError>());
    expect((await repo.getCreditBalance()).balance, 0);
  });

  test('a live credits failure does not grant keys locally', () async {
    final repo = DemoRepository(
      config: _liveUrl,
      networkDelay: Duration.zero,
      purchaseService: FakePurchaseService(simulateDelay: Duration.zero),
      credits: HttpCreditsEndpoint(
        baseUrl: 'https://api.drevvy.com',
        strict: true,
        sessionStore: ShopperSessionStore(),
        client: MockClient((request) async => http.Response('no', 500)),
      ),
    );

    expect((await repo.getCreditBalance()).balance, 0);
    final result = await repo.purchasePack(CarPackType.single);
    expect(result, isA<PurchaseError>());
    expect((result as PurchaseError).code, 'credits_unconfirmed');
    expect((await repo.getCreditBalance()).balance, 0);
    expect(repo.creditNotice, ApiConfigException.creditsUnavailable.message);
  });

  test(
    'a live key-spend 404 does not spend a local key or stub the rooftop',
    () async {
      final repo = DemoRepository(
        config: _liveUrl,
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(6),
        keySpend: HttpKeySpendEndpoint(
          baseUrl: 'https://api.drevvy.com',
          strict: true,
          sessionStore: ShopperSessionStore()
            ..save(const ShopperSession(accessToken: 'shopper-jwt')),
          client: MockClient((request) async => http.Response('missing', 404)),
        ),
        rooftopMatch: RooftopMatchEndpoint.fromConfig(
          _liveUrl,
          client: MockClient((request) async => http.Response('', 404)),
        ),
      );

      expect(await repo.unlockMarketIntel(_rav4), isFalse);
      expect((await repo.getCreditBalance()).balance, 6);
      expect(repo.hasUnlockedMarketIntel(_rav4.id), isFalse);

      final match = await repo.getRooftopMatch(_rav4);
      expect(match.source, RooftopMatchSource.unavailable);
      expect(match.isInNetwork, isFalse);
    },
  );

  test(
    'demo mode still grants starter keys and keeps the sample label',
    () async {
      final demo = DemoRepository(
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(0),
      );

      expect(await demo.grantStarterKeys(), isTrue);
      expect((await demo.getCreditBalance()).balance, 3);
      expect(demo.creditNotice, isNull);
      expect(mattersMarketIntelSampleBadge, contains('Sample'));
      expect(mattersMarketIntelAskingPrice, r'$24,900');
      expect(mattersMarketIntelHeadline, contains('asking price'));
    },
  );

  test('auth does not call the network when the shared URL is empty', () async {
    var called = false;
    final api = AuthApi(
      baseUrl: DrevvyConfig.apiBaseUrl,
      client: MockClient((request) async {
        called = true;
        return http.Response('{}', 200);
      }),
    );

    expect(
      () => api.signInWithApple(identityToken: 'token'),
      throwsA(
        isA<AuthException>().having(
          (error) => error.code,
          'code',
          'not_configured',
        ),
      ),
    );
    expect(called, isFalse);
  });
}
