import 'package:drevvy_app/core/onboarding/onboarding_gate.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/services/onboarding_store.dart';
import 'package:drevvy_app/data/services/packs_offering.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('onboarding redirect', () {
    test('first run stays out of Shop, Deals, and Saved', () {
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/shop'),
        '/onboarding/welcome',
      );
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/deals'),
        '/onboarding/welcome',
      );
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/saved'),
        '/onboarding/welcome',
      );
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/vdp/listing_1'),
        '/onboarding/welcome',
      );
    });

    test('first run can open onboarding, account, and the paywall', () {
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/onboarding/how'),
        isNull,
      );
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/account/create'),
        isNull,
      );
      expect(
        onboardingRedirect(onboardingComplete: false, path: '/paywall'),
        isNull,
      );
    });

    test('a finished first run opens Shop instead of onboarding', () {
      expect(
        onboardingRedirect(
          onboardingComplete: true,
          path: '/onboarding/welcome',
        ),
        '/shop',
      );
      expect(
        onboardingRedirect(onboardingComplete: true, path: '/account/create'),
        '/shop',
      );
      expect(
        onboardingRedirect(onboardingComplete: true, path: '/shop'),
        isNull,
      );
      expect(
        onboardingRedirect(onboardingComplete: true, path: '/paywall'),
        isNull,
      );
    });
  });

  group('onboarding store', () {
    test('memory store starts incomplete and can be finished', () async {
      final store = MemoryOnboardingStore();
      expect(await store.isComplete(), isFalse);
      await store.markComplete();
      expect(await store.isComplete(), isTrue);
    });
  });

  group('packs offering', () {
    test('offering id and unlock placement are the dashboard names', () {
      expect(packsOfferingId, 'packs');
      expect(unlockMyPricePlacement, 'unlock_my_price');
    });

    test('packages come from offering packs ahead of the current offering', () {
      final selected = packagesFromPacksOffering<String>(
        current: const StoreOfferingPackages(
          identifier: 'default',
          packages: ['other'],
        ),
        all: const [
          StoreOfferingPackages(identifier: 'default', packages: ['other']),
          StoreOfferingPackages(
            identifier: 'packs',
            packages: ['drevvy_pack_3', 'drevvy_pack_5', 'drevvy_pack_10'],
          ),
        ],
      );

      expect(selected, ['drevvy_pack_3', 'drevvy_pack_5', 'drevvy_pack_10']);
    });

    test('an empty packs offering falls back to the current offering', () {
      final selected = packagesFromPacksOffering<String>(
        current: const StoreOfferingPackages(
          identifier: 'default',
          packages: ['drevvy_pack_10'],
        ),
        all: const [StoreOfferingPackages(identifier: 'packs', packages: [])],
      );
      expect(selected, ['drevvy_pack_10']);
    });

    test('dollar prices use the catalog when the store has not loaded', () {
      expect(displayPackPrice(pack: CarPackType.starter), r'$47');
      expect(displayPackPrice(pack: CarPackType.plus), r'$67');
      expect(displayPackPrice(pack: CarPackType.bestValue), r'$97');
      expect(displayPerCarPrice(pack: CarPackType.bestValue), r'$9.70/car');
      expect(displayPerCarPrice(pack: CarPackType.starter), r'$15.67/car');
      expect(displayPerCarPrice(pack: CarPackType.plus), r'$13.40/car');
    });

    test('a non-USD store price is shown as the store sent it', () {
      const offering = CarPackOffering(
        packType: CarPackType.bestValue,
        localizedPrice: '89,00 €',
        currencyCode: 'EUR',
        priceAmount: 89,
      );
      expect(
        displayPackPrice(pack: CarPackType.bestValue, offering: offering),
        '89,00 €',
      );
    });

    test('unlock paywall is only required at a zero balance', () {
      expect(
        shouldPresentUnlockPaywall(const CarCreditBalance.empty()),
        isTrue,
      );
      expect(
        shouldPresentUnlockPaywall(const CarCreditBalance.withBalance(1)),
        isFalse,
      );
    });
  });
}
