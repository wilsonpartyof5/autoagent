import 'package:flutter/foundation.dart';

import '../analytics/product_analytics.dart';
import '../models/models.dart';
import '../services/credits_endpoint.dart';
import '../services/deal_chips_endpoint.dart';
import '../services/key_spend_endpoint.dart';
import '../services/purchase_config.dart';
import '../services/purchase_service.dart';
import '../services/purchase_service_factory.dart';
import '../services/rooftop_match_endpoint.dart';
import '../../core/theme/drevvy_tokens.dart';

/// Demo repository with realistic mock data modeled after MarketCheck API fields.
/// This allows for easy swap to the real backend later.
///
/// One-time key packs. Two spends from the same balance:
/// - Key A: market intel + save (not refunded)
/// - Key B: in-network dealer conversation (refunded on 7-day no-reply or sold)
///
/// TODO: Replace with real API calls to:
/// - https://api.drevvy.com (Drevvy backend)
/// - Supabase auth
/// - RevenueCat/Superwall for billing (products: drevvy_keys_1/5/10/25)
class DemoRepository {
  DemoRepository({
    PurchaseConfig? config,
    PurchaseService? purchaseService,
    CreditsEndpoint? credits,
    RooftopMatchEndpoint? rooftopMatch,
    KeySpendEndpoint? keySpend,
    DealChipsEndpoint? dealChips,
    this._networkDelay = const Duration(milliseconds: 500),
    CarCreditBalance? initialBalance,
  }) {
    final resolved = config ?? PurchaseConfig.fromEnvironment();
    _credits = credits ?? CreditsEndpoint.fromConfig(resolved);
    _purchaseService = purchaseService ?? buildPurchaseService(resolved);
    _rooftopMatch = rooftopMatch ?? RooftopMatchEndpoint.fromConfig(resolved);
    _keySpend = keySpend ?? KeySpendEndpoint.fromConfig(resolved);
    _dealChips = dealChips ?? DealChipsEndpoint.fromConfig(resolved);
    if (initialBalance != null) {
      _creditBalance = initialBalance;
    }
  }

  static final instance = DemoRepository();

  final Duration _networkDelay;
  late final CreditsEndpoint _credits;
  late final PurchaseService _purchaseService;
  late final RooftopMatchEndpoint _rooftopMatch;
  late final KeySpendEndpoint _keySpend;
  late final DealChipsEndpoint _dealChips;

  /// Chips route for an in-network deal. Missing base URL keeps the opener pair.
  DealChipsEndpoint get dealChips => _dealChips;

  /// Deal id for a listing that already has an in-network conversation.
  final Map<String, String> _conversationDealIds = {};

  /// Messages this shopper has placed on a deal thread.
  final Map<String, List<DealThreadMessage>> _dealThreads = {};

  String? dealIdForListing(String listingId) {
    final known = _conversationDealIds[listingId];
    if (known != null) return known;
    _ensureDealsLoaded();
    for (final deal in _deals) {
      if (deal.listingId == listingId) return deal.id;
    }
    return null;
  }

  List<DealThreadMessage> dealThread(String dealId) {
    return List<DealThreadMessage>.unmodifiable(
      _dealThreads[dealId] ?? const [],
    );
  }

  void rememberDealMessage(
    String dealId, {
    String? author,
    required String body,
  }) {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return;
    final current = _dealThreads[dealId] ?? const <DealThreadMessage>[];
    _dealThreads[dealId] = [
      ...current,
      DealThreadMessage(author: author ?? 'shopper', body: trimmed),
    ];
  }

  /// Listings that have spent Key A (market intel + save).
  final Set<String> _marketIntelUnlocked = {};

  /// Listings that have spent Key B (in-network conversation).
  final Set<String> _conversationStarted = {};

  /// Off-network OTD requests captured for analytics review.
  final Set<String> _otdRequested = {};

  /// Shop listens so "Run again" from the menu or account sheet opens results.
  void Function(SavedSearch search)? onSavedSearchRun;

  /// Saved and Deals tabs listen so a heart tap or unlock shows up immediately.
  final ValueNotifier<int> savedDealsTick = ValueNotifier<int>(0);

  void _bumpLists() {
    savedDealsTick.value++;
  }

  // Simulated delay for realistic loading states
  Future<T> _delay<T>(T value, [Duration? duration]) async {
    await Future.delayed(duration ?? _networkDelay);
    return value;
  }

  // ============== USER ==============

  User? _currentUser;

  Future<User> getCurrentUser() async {
    _currentUser ??= _demoUser;
    return _delay(_currentUser!);
  }

  Future<User> updateUser(User user) async {
    _currentUser = user;
    return _delay(user);
  }

  /// Clears the in-memory demo shopper so tests can start from the seed user.
  void resetDemoUser() {
    _currentUser = null;
  }

  static final _demoUser = User(
    id: 'user_demo_001',
    firstName: 'Dana',
    email: 'dana.w@example.com',
    entitlement:
        Entitlement.free, // v1.7: No longer uses Pro; credits gate unlock
    usage: Usage(
      used: 0,
      cap: 0,
      resetsOn: DateTime.now(), // Obsolete in v1.7
    ),
    prefs: const UserPrefs(
      budgetOtd: 40000,
      bodyTypes: ['SUV', 'Sedan'],
      tradeIn: TradeInPref.unsure,
      payment: PaymentPref.unsure,
      radius: 50,
    ),
    notificationPrefs: const NotificationPrefs(
      enabled: true,
      hidePricesOnLockScreen: false,
    ),
    locationState: LocationState.granted,
    zipCode: '94105',
  );

  // ============== CAR CREDITS (v1.7) ==============

  /// Credit ledger for audit trail.
  final List<CreditLedgerEntry> _creditLedger = [];

  /// Current balance computed from ledger. Start with demo credits.
  CarCreditBalance _creditBalance = const CarCreditBalance.withBalance(6);

  /// Server-driven avg_savings config shown beside key packs.
  final AvgSavingsConfig _avgSavingsConfig = const AvgSavingsConfig(
    value: '3–5%',
    label: 'Buyers who compare out-the-door quotes from several dealers typically save 3–5% off the first price they\'re quoted.',
    source: 'CarEdge, State of Dealer Fees 2026',
    kind: 'market',
  );

  /// Get current key balance.
  Future<CarCreditBalance> getCreditBalance() async {
    return _delay(_creditBalance);
  }

  /// Get credit ledger entries for this user.
  Future<List<CreditLedgerEntry>> getCreditLedger() async {
    return _delay(List.unmodifiable(_creditLedger));
  }

  /// Get avg_savings config. Returns null if unavailable (hide stat in UI).
  Future<AvgSavingsConfig?> getAvgSavingsConfig() async {
    return _delay(_avgSavingsConfig);
  }

  /// Get the purchase service.
  PurchaseService get purchaseService => _purchaseService;

  /// Purchase a key pack. Grants server credits when that endpoint exists.
  Future<PurchaseResult> purchasePack(CarPackType packType) async {
    ProductAnalytics.instance.track(AnalyticsEvents.packSelected, {
      'pack_id': packType.productId,
      'pack_size': packType.cars,
      'pack_mix': CarPackType.packMix,
      'price': packType.priceUsd,
      'currency': 'USD',
      'stage': 'purchase',
    });
    await _purchaseService.initialize();
    final result = await _purchaseService.purchasePack(packType);
    if (result is PurchaseSuccess) {
      ProductAnalytics.instance.track(AnalyticsEvents.purchaseCompleted, {
        'pack_id': packType.productId,
        'pack_size': packType.cars,
        'pack_mix': CarPackType.packMix,
        'price': packType.priceUsd,
        'currency': 'USD',
      });
      await _recordPurchase(result);
    } else {
      ProductAnalytics.instance.track(AnalyticsEvents.purchaseFailed, {
        'pack_id': packType.productId,
        'pack_size': packType.cars,
        'pack_mix': CarPackType.packMix,
        'reason': switch (result) {
          PurchaseCancelled() => 'cancelled',
          PurchasePending() => 'pending',
          PurchaseError() => 'store_error',
          PurchaseSuccess() => 'store_error',
        },
      });
    }
    return result;
  }

  /// Spend the market-intelligence + save key (Key A).
  /// Dealer-conversation is a separate key (see [KeySpend]).
  bool spendCredit(String dealId) {
    return _spendKey(CreditReason.unlock, dealId: dealId);
  }

  bool spendMarketIntelKey(String listingId) {
    if (_marketIntelUnlocked.contains(listingId)) return true;
    final spent = _spendKey(CreditReason.marketIntel, listingId: listingId);
    if (spent) _marketIntelUnlocked.add(listingId);
    return spent;
  }

  bool spendConversationKey(String listingId, {String? dealId}) {
    if (_conversationStarted.contains(listingId)) return true;
    final spent = _spendKey(
      CreditReason.dealerConversation,
      listingId: listingId,
      dealId: dealId,
    );
    if (spent) _conversationStarted.add(listingId);
    return spent;
  }

  bool _spendKey(CreditReason reason, {String? dealId, String? listingId}) {
    if (!_creditBalance.canUnlock) return false;

    final entry = CreditLedgerEntry(
      id: 'ledger_${DateTime.now().millisecondsSinceEpoch}',
      userId: _currentUser?.id ?? 'user_demo_001',
      delta: -1,
      reason: reason,
      createdAt: DateTime.now(),
      dealId: dealId,
      listingId: listingId,
    );
    _creditLedger.add(entry);

    _creditBalance = _creditBalance.copyWith(
      balance: _creditBalance.balance - 1,
      totalSpent: _creditBalance.totalSpent + 1,
    );
    _reportBalance(reason.name, -1);

    return true;
  }

  bool hasUnlockedMarketIntel(String listingId) =>
      _marketIntelUnlocked.contains(listingId);

  bool hasStartedConversation(String listingId) =>
      _conversationStarted.contains(listingId);

  bool hasRequestedOtd(String listingId) => _otdRequested.contains(listingId);

  Future<RooftopMatch> getRooftopMatch(Listing listing) async {
    final match = await _rooftopMatch.match(listing);
    ProductAnalytics.instance.track(AnalyticsEvents.rooftopMatchResolved, {
      'listing_id': listing.id,
      'matched': match.matched,
      if (match.rooftopId != null) 'rooftop_id': match.rooftopId,
      'source': match.source.name,
    });
    return _delay(match);
  }

  Future<bool> unlockMarketIntel(Listing listing) async {
    final remote = await _keySpend.spendMarketSave(listing);
    if (remote.source == KeySpendSource.live) {
      if (remote.ok) {
        _marketIntelUnlocked.add(listing.id);
        if (remote.balance != null) _creditBalance = remote.balance!;
        await saveCar(listing, source: 'market_intel');
        ProductAnalytics.instance.track(AnalyticsEvents.marketIntelUnlocked, {
          'listing_id': listing.id,
          'source': 'live',
        });
      }
      return remote.ok;
    }
    if (!spendMarketIntelKey(listing.id)) return false;
    await saveCar(listing, source: 'market_intel');
    ProductAnalytics.instance.track(AnalyticsEvents.marketIntelUnlocked, {
      'listing_id': listing.id,
      'source': 'stub',
    });
    return true;
  }

  Future<Deal?> startDealerConversation(
    Listing listing,
    RooftopMatch match, {
    String? templateId,
    String? message,
  }) async {
    if (!match.isInNetwork) return null;
    final remote = await _keySpend.startConversation(
      listing: listing,
      match: match,
      templateId: templateId,
      message: message,
    );
    if (remote.source == KeySpendSource.live) {
      if (!remote.ok) return null;
      _conversationStarted.add(listing.id);
      if (remote.balance != null) _creditBalance = remote.balance!;
      ProductAnalytics.instance.track(
        AnalyticsEvents.dealerConversationStarted,
        {
          'listing_id': listing.id,
          if (match.rooftopId != null) 'rooftop_id': match.rooftopId,
          if (templateId != null) 'template_id': templateId,
          'source': 'live',
        },
      );
      if (remote.dealId != null) {
        _conversationDealIds[listing.id] = remote.dealId!;
        return getDealById(remote.dealId!);
      }
      final created = await addDeal(listing, spend: false);
      _conversationDealIds[listing.id] = created.id;
      return created;
    }
    if (!_conversationStarted.contains(listing.id) &&
        !spendConversationKey(listing.id)) {
      return null;
    }
    ProductAnalytics.instance.track(AnalyticsEvents.dealerConversationStarted, {
      'listing_id': listing.id,
      if (match.rooftopId != null) 'rooftop_id': match.rooftopId,
      if (templateId != null) 'template_id': templateId,
      'source': 'stub',
    });
    final created = await addDeal(listing, spend: false);
    _conversationDealIds[listing.id] = created.id;
    return created;
  }

  Future<bool> requestOtdNumber(Listing listing, {String? note}) async {
    _otdRequested.add(listing.id);
    ProductAnalytics.instance.track(AnalyticsEvents.otdNumberRequested, {
      'listing_id': listing.id,
      'free': true,
      'uses_key': false,
      'has_note': note != null && note.isNotEmpty,
      if (listing.vdpUrl != null) 'has_vdp_url': true,
    });
    final remote = await _keySpend.requestOtdNumber(listing, note: note);
    if (remote.source == KeySpendSource.live) return remote.ok;
    return true;
  }

  /// Refund 1 credit for a deal. Returns true if successful.
  bool refundCredit(String dealId, CreditReason reason) {
    assert(
      reason == CreditReason.refundNoResponse ||
          reason == CreditReason.refundNoLongerListed ||
          reason == CreditReason.refundDealerDecline ||
          reason == CreditReason.refundEarlyRemoval,
      'Invalid refund reason: $reason',
    );

    final entry = CreditLedgerEntry(
      id: 'ledger_${DateTime.now().millisecondsSinceEpoch}',
      userId: _currentUser?.id ?? 'user_demo_001',
      delta: 1,
      reason: reason,
      createdAt: DateTime.now(),
      dealId: dealId,
    );
    _creditLedger.add(entry);

    _creditBalance = _creditBalance.copyWith(
      balance: _creditBalance.balance + 1,
      totalRefunded: _creditBalance.totalRefunded + 1,
    );
    _reportBalance(reason.name, 1);

    return true;
  }

  /// Record a store purchase. Server balance wins when the credits route exists.
  Future<void> _recordPurchase(PurchaseSuccess result) async {
    if (_hasTransaction(result.transactionId)) return;

    final remote = await _credits.grantPurchase(
      productId: result.packType.productId,
      transactionId: result.transactionId,
    );
    if (remote != null) {
      _rememberTransaction(
        result.transactionId,
        result.creditsAdded,
        result.packType,
      );
      _creditBalance = remote;
      _reportBalance('purchase', result.creditsAdded);
      return;
    }
    _addCredits(
      result.creditsAdded,
      CreditReason.purchase,
      packType: result.packType,
      rcEventId: result.transactionId,
    );
  }

  bool _hasTransaction(String transactionId) {
    return _creditLedger.any((entry) => entry.rcEventId == transactionId);
  }

  void _rememberTransaction(
    String transactionId,
    int credits,
    CarPackType packType,
  ) {
    if (_hasTransaction(transactionId)) return;
    _creditLedger.add(
      CreditLedgerEntry(
        id: 'ledger_$transactionId',
        userId: _currentUser?.id ?? 'user_demo_001',
        delta: credits,
        reason: CreditReason.purchase,
        createdAt: DateTime.now(),
        packType: packType,
        rcEventId: transactionId,
      ),
    );
  }

  /// Add credits (from purchase).
  void _addCredits(
    int credits,
    CreditReason reason, {
    CarPackType? packType,
    String? rcEventId,
  }) {
    if (rcEventId != null && _hasTransaction(rcEventId)) return;
    final entry = CreditLedgerEntry(
      id: 'ledger_${rcEventId ?? DateTime.now().millisecondsSinceEpoch}',
      userId: _currentUser?.id ?? 'user_demo_001',
      delta: credits,
      reason: reason,
      createdAt: DateTime.now(),
      packType: packType,
      rcEventId: rcEventId,
    );
    _creditLedger.add(entry);

    _creditBalance = _creditBalance.copyWith(
      balance: _creditBalance.balance + credits,
      totalPurchased: _creditBalance.totalPurchased + credits,
    );
    _reportBalance(reason.name, credits);
  }

  void _reportBalance(String reason, int delta) {
    ProductAnalytics.instance.track(AnalyticsEvents.packBalanceChanged, {
      'reason': reason,
      'delta': delta,
      'balance': _creditBalance.balance,
    });
  }

  /// Conversation keys are not returned on cancel. Only 7-day no-reply or sold.
  bool canGetEarlyRemovalRefund(Deal deal) => false;

  /// Get available pack offerings.
  Future<List<CarPackOffering>?> getPackOfferings() async {
    await _purchaseService.initialize();
    return _purchaseService.getOfferings();
  }

  /// Restore purchases, then sync credits from the backend when that route exists.
  Future<RestoreResult> restorePurchases() async {
    ProductAnalytics.instance.track(AnalyticsEvents.purchasesRestoreStarted);
    await _purchaseService.initialize();
    final result = await _purchaseService.restorePurchases();
    ProductAnalytics.instance.track(AnalyticsEvents.purchasesRestored, {
      'result': switch (result) {
        RestoreSuccess(:final creditsRestored) when creditsRestored > 0 =>
          'success',
        RestoreSuccess() => 'empty',
        RestoreNoPurchases() => 'empty',
        RestoreError() => 'error',
      },
      'credits': switch (result) {
        RestoreSuccess(:final creditsRestored) => creditsRestored,
        _ => 0,
      },
    });
    if (result is RestoreError) return result;

    final transactions = switch (result) {
      RestoreSuccess(:final transactions) => transactions,
      _ => const <RestoredTransaction>[],
    };
    final remote = await _credits.restorePurchases(
      transactionIds: [
        for (final transaction in transactions) transaction.transactionId,
      ],
    );
    if (remote != null) {
      for (final transaction in transactions) {
        _rememberTransaction(
          transaction.transactionId,
          transaction.packType.cars,
          transaction.packType,
        );
      }
      _creditBalance = remote;
      if (transactions.isEmpty) return const RestoreNoPurchases();
      return RestoreSuccess(
        creditsRestored: remote.balance,
        transactions: transactions,
      );
    }

    if (transactions.isEmpty) return const RestoreNoPurchases();

    var added = 0;
    for (final transaction in transactions) {
      final before = _creditBalance.balance;
      _addCredits(
        transaction.packType.cars,
        CreditReason.purchase,
        packType: transaction.packType,
        rcEventId: transaction.transactionId,
      );
      added += _creditBalance.balance - before;
    }
    return RestoreSuccess(creditsRestored: added, transactions: transactions);
  }

  // ============== LISTINGS ==============

  Future<List<Listing>> searchListings({
    String? query,
    int? maxPrice,
    List<String>? bodyTypes,
    int? radius,
    int limit = 10,
    SearchFilters? filters,
  }) async {
    if (filters == null &&
        maxPrice == null &&
        (bodyTypes == null || bodyTypes.isEmpty) &&
        radius == null) {
      return _delay(_demoListings);
    }

    final effective =
        filters ??
        SearchFilters(
          priceMax: maxPrice,
          bodyTypes: bodyTypes ?? const [],
          radiusMi: radius,
        );
    final matches = _demoListings
        .where((listing) => _listingMatches(listing, effective))
        .take(limit)
        .toList();
    return _delay(matches);
  }

  bool _listingMatches(Listing listing, SearchFilters filters) {
    bool includes(List<String> values, String? candidate) {
      if (values.isEmpty) return true;
      final value = candidate?.toLowerCase() ?? '';
      return values.any((item) => item.toLowerCase() == value);
    }

    if (!includes(filters.makes, listing.build.make)) return false;
    if (!includes(filters.models, listing.build.model)) return false;
    if (!includes(filters.bodyTypes, listing.build.bodyType)) return false;
    if (!includes(filters.fuel, listing.build.powertrainType)) return false;
    if (filters.priceMax != null && listing.price > filters.priceMax!) {
      return false;
    }
    if (filters.milesMax != null && (listing.miles ?? 0) > filters.milesMax!) {
      return false;
    }
    if (filters.yearMin != null && listing.build.year < filters.yearMin!) {
      return false;
    }
    if (filters.yearMax != null && listing.build.year > filters.yearMax!) {
      return false;
    }
    if (filters.radiusMi != null &&
        listing.dist != null &&
        listing.dist! > filters.radiusMi!) {
      return false;
    }
    return true;
  }

  Future<Listing> getListingById(String id) async {
    for (final listing in [..._demoListings, ..._retiredListings]) {
      if (listing.id == id) return _delay(listing);
    }
    throw StateError('Listing $id not found');
  }

  Future<MarketContext> getMarketContext(Listing listing) async {
    // Mock market context with consistent math per audit
    // Fair price MUST be between low and high
    final isNew = listing.isNew;

    if (isNew) {
      final msrp = listing.msrp ?? listing.price + 2000;
      final discount = msrp - listing.price;
      return _delay(
        MarketContext(
          fairVehiclePrice: listing.price,
          fairOtd: listing.price + 3500, // +fees/tax estimate
          lowPrice: listing.price - 1500,
          medianPrice: listing.price + 500,
          highPrice: msrp + 1000,
          comparablesCount: 8,
          daysListedMedian: 25,
          isNewCar: true,
          msrp: msrp,
          msrpDiscount: discount,
        ),
      );
    }

    // Used car: ensure fairVehiclePrice is between low and high
    // Using consistent percentiles (p25/p50/p75)
    final lowPrice = (listing.price * 0.92).round(); // p25
    final medianPrice = (listing.price * 1.02).round(); // p50
    final highPrice = (listing.price * 1.12).round(); // p75
    final fairVehicle = (listing.price * 1.03)
        .round(); // MC Price between p50-p75

    return _delay(
      MarketContext(
        fairVehiclePrice: fairVehicle,
        fairOtd: fairVehicle + 3500, // +fees/tax estimate
        lowPrice: lowPrice,
        medianPrice: medianPrice,
        highPrice: highPrice,
        comparablesCount: 14,
        daysListedMedian: 38,
        priceDrops: 2,
        isNewCar: false,
      ),
    );
  }

  // ============== SAVED CARS (v1.8) ==============

  /// Saved cars list - stores only Drevvy's own data, no MarketCheck listing data.
  /// Per spec §11.2: price changes must come from live data, not stored prices.
  List<SavedCar> _savedCars = [];
  bool _savedCarsInitialized = false;

  /// Get all saved cars for the current user.
  Future<List<SavedCar>> getSavedCars() async {
    if (!_savedCarsInitialized) {
      _savedCars = _demoSavedCars;
      _savedCarsInitialized = true;
    }
    return _delay(List.unmodifiable(_savedCars));
  }

  /// Check if a listing is saved.
  bool isListingSaved(String listingId) {
    return _savedCars.any((sc) => sc.listingId == listingId);
  }

  /// Check if a listing is already in Deals.
  bool isListingInDeals(String listingId) {
    _ensureDealsLoaded();
    return _deals.any((d) => d.listingId == listingId);
  }

  /// Save a car (heart tap). No credit spent, no dealer contact.
  Future<SavedCar> saveCar(Listing listing, {String source = 'unknown'}) async {
    final savedCar = SavedCar(
      id: 'saved_${DateTime.now().millisecondsSinceEpoch}',
      userId: _currentUser?.id ?? 'user_demo_001',
      listingId: listing.id,
      vin: listing.vin,
      savedAt: DateTime.now(),
      savedPrice: listing.price,
      status: SavedCarStatus.active,
    );
    _savedCars = [..._savedCars, savedCar];
    _bumpLists();
    ProductAnalytics.instance.track(AnalyticsEvents.carSaved, {
      'listing_id': listing.id,
      'inventory_type': listing.inventoryType,
      'source': source,
    });
    return _delay(savedCar);
  }

  /// Remove a saved car (unsave / swipe to remove).
  Future<void> removeSavedCar(
    String savedCarId, {
    String source = 'saved',
  }) async {
    final listingId = _savedCars
        .where((car) => car.id == savedCarId)
        .map((car) => car.listingId)
        .firstOrNull;
    _savedCars = _savedCars.where((sc) => sc.id != savedCarId).toList();
    _bumpLists();
    if (listingId != null) {
      ProductAnalytics.instance.track(AnalyticsEvents.carUnsaved, {
        'listing_id': listingId,
        'source': source,
      });
    }
    return _delay(null);
  }

  /// Remove saved car by listing ID.
  Future<void> unsaveByListingId(
    String listingId, {
    String source = 'unknown',
  }) async {
    _savedCars = _savedCars.where((sc) => sc.listingId != listingId).toList();
    _bumpLists();
    ProductAnalytics.instance.track(AnalyticsEvents.carUnsaved, {
      'listing_id': listingId,
      'source': source,
    });
    return _delay(null);
  }

  /// Get saved car by listing ID.
  SavedCar? getSavedCarByListingId(String listingId) {
    try {
      return _savedCars.firstWhere((sc) => sc.listingId == listingId);
    } catch (_) {
      return null;
    }
  }

  /// Move saved car to Deals (unlock my price flow).
  /// The car stays in Saved until this runs, then it leaves Saved.
  /// A car already in Deals is not charged again.
  Future<Deal?> moveToDeals(String savedCarId) async {
    await getSavedCars();
    final savedCar = _savedCars.firstWhere((sc) => sc.id == savedCarId);
    final listing = await getListingById(savedCar.listingId);
    _ensureDealsLoaded();

    if (isListingInDeals(listing.id)) {
      _savedCars = _savedCars
          .where((sc) => sc.listingId != listing.id)
          .toList();
      _bumpLists();
      final existing = _deals.firstWhere(
        (deal) => deal.listingId == listing.id,
      );
      return _delay(existing);
    }

    if (!_creditBalance.canUnlock) return null;
    return addDeal(listing);
  }

  /// Demo saved cars. These listings are not already in Deals.
  List<SavedCar> get _demoSavedCars => [
    SavedCar(
      id: 'saved_001',
      userId: 'user_demo_001',
      listingId: 'listing_008',
      vin: '19XFC2F59NE123456',
      savedAt: DateTime.now().subtract(const Duration(days: 5)),
      savedPrice: 23490,
      status: SavedCarStatus.active,
    ),
    SavedCar(
      id: 'saved_002',
      userId: 'user_demo_001',
      listingId: 'listing_009',
      vin: '5XYP3DHC5NG123456',
      savedAt: DateTime.now().subtract(const Duration(days: 3)),
      savedPrice: 26880,
      status: SavedCarStatus.active,
    ),
    SavedCar(
      id: 'saved_003',
      userId: 'user_demo_001',
      listingId: 'listing_sold_010',
      vin: '4S4BTANC5M3123456',
      savedAt: DateTime.now().subtract(const Duration(days: 12)),
      savedPrice: 24800,
      status: SavedCarStatus.noLongerListed,
    ),
  ];

  // ============== DEALS ==============

  List<Deal> _deals = [];
  bool _dealsSeeded = false;

  void _ensureDealsLoaded() {
    if (_dealsSeeded) return;
    _deals = List<Deal>.from(_demoDealsList);
    _dealsSeeded = true;
  }

  Future<List<Deal>> getDeals() async {
    _ensureDealsLoaded();
    return _delay(_deals);
  }

  Future<Deal> getDealById(String id) async {
    final deals = await getDeals();
    return deals.firstWhere((d) => d.id == id, orElse: () => deals.first);
  }

  Future<Deal> addDeal(Listing listing, {bool spend = true}) async {
    _ensureDealsLoaded();
    for (final deal in _deals) {
      if (deal.listingId == listing.id) {
        _savedCars = _savedCars
            .where((car) => car.listingId != listing.id)
            .toList();
        _bumpLists();
        return _delay(deal);
      }
    }
    if (spend && !_creditBalance.canUnlock) {
      ProductAnalytics.instance.track(AnalyticsEvents.dealAddBlocked, {
        'listing_id': listing.id,
        'reason': 'no_credits',
      });
      throw StateError('No keys left');
    }

    final newDeal = Deal(
      id: 'deal_${DateTime.now().millisecondsSinceEpoch}',
      listingId: listing.id,
      letter: _getNextLetter(),
      status: DealStatus.reachingOut,
      listedAtStart: listing.price,
      addedAt: DateTime.now(),
      listing: listing,
      marketContext: await getMarketContext(listing),
    );
    _deals = [..._deals, newDeal];
    _savedCars = _savedCars
        .where((car) => car.listingId != listing.id)
        .toList();

    if (spend) {
      spendConversationKey(listing.id, dealId: newDeal.id);
    }
    _bumpLists();
    ProductAnalytics.instance.track(AnalyticsEvents.dealAdded, {
      'deal_id': newDeal.id,
      'listing_id': listing.id,
    });

    return _delay(newDeal);
  }

  Future<void> removeDeal(String dealId) async {
    _ensureDealsLoaded();
    final deal = await getDealById(dealId);
    final refunded = canGetEarlyRemovalRefund(deal);
    _deals = _deals.where((d) => d.id != dealId).toList();

    // Conversation keys are not returned on cancel. Only 7-day no-reply
    // (clock starts at confirmed delivery) or sold refunds apply.
    if (refunded) {
      refundCredit(dealId, CreditReason.refundEarlyRemoval);
    }
    _bumpLists();
    ProductAnalytics.instance.track(AnalyticsEvents.dealRemoved, {
      'deal_id': dealId,
      'refunded': refunded,
    });

    return _delay(null);
  }

  Future<Deal> acceptOffer(String dealId) async {
    _ensureDealsLoaded();
    final deal = await getDealById(dealId);
    final updated = deal.copyWith(
      status: DealStatus.accepted,
      acceptedOffer: deal.latestOffer,
    );
    _deals = _deals.map((d) => d.id == dealId ? updated : d).toList();
    _bumpLists();
    ProductAnalytics.instance.track(AnalyticsEvents.dealAccepted, {
      'deal_id': dealId,
      'listing_id': updated.listingId,
    });
    return _delay(updated);
  }

  Future<Deal> keepGoing(String dealId) async {
    _ensureDealsLoaded();
    final deal = await getDealById(dealId);
    final updated = deal.copyWith(status: DealStatus.findingBestPrice);
    _deals = _deals.map((d) => d.id == dealId ? updated : d).toList();
    _bumpLists();
    ProductAnalytics.instance.track(AnalyticsEvents.dealKeepGoing, {
      'deal_id': dealId,
    });
    return _delay(updated);
  }

  String _getNextLetter() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[_deals.length % 26];
  }

  // ============== CHAT ==============

  ChatThread _chatThread = ChatThread(
    id: 'chat_main',
    mode: ChatMode.ask,
    createdAt: DateTime.now(),
  );

  List<ChatThread> _chatHistory = [];

  Future<ChatThread> getChatThread() async {
    return _delay(_chatThread);
  }

  /// Get chat history for the drawer (v1.6.1)
  /// Deal-scoped chats are excluded per spec §6.13
  Future<List<ChatThread>> getChatHistory() async {
    if (_chatHistory.isEmpty) {
      _chatHistory = _demoChatHistory;
    }
    return _delay(_chatHistory);
  }

  static final _demoChatHistory = [
    ChatThread(
      id: 'chat_001',
      mode: ChatMode.ask,
      title: 'RAV4 Hybrid under \$35k',
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
      messages: [
        ChatMessage(
          id: 'msg_001',
          role: MessageRole.user,
          contentType: MessageContentType.text,
          text: 'What are the best RAV4 Hybrids under \$35k near me?',
          timestamp: DateTime.now().subtract(const Duration(hours: 2)),
        ),
      ],
    ),
    ChatThread(
      id: 'chat_002',
      mode: ChatMode.shop,
      title: 'SUV search',
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      updatedAt: DateTime.now().subtract(const Duration(days: 1)),
      sourcesCount: 24,
    ),
    ChatThread(
      id: 'chat_003',
      mode: ChatMode.ask,
      title: 'Honda CR-V vs Toyota RAV4',
      createdAt: DateTime.now().subtract(const Duration(days: 3)),
      updatedAt: DateTime.now().subtract(const Duration(days: 3)),
      messages: [
        ChatMessage(
          id: 'msg_003',
          role: MessageRole.user,
          contentType: MessageContentType.text,
          text: 'Should I get a Honda CR-V or Toyota RAV4 for my family?',
          timestamp: DateTime.now().subtract(const Duration(days: 3)),
        ),
      ],
    ),
    ChatThread(
      id: 'chat_004',
      mode: ChatMode.ask,
      title: 'Fair price for Mazda CX-50',
      createdAt: DateTime.now().subtract(const Duration(days: 8)),
      updatedAt: DateTime.now().subtract(const Duration(days: 8)),
      messages: [
        ChatMessage(
          id: 'msg_004',
          role: MessageRole.user,
          contentType: MessageContentType.text,
          text: 'Is \$29,950 fair for a 2024 Mazda CX-50 with 28k miles?',
          timestamp: DateTime.now().subtract(const Duration(days: 8)),
        ),
      ],
    ),
  ];

  Future<ChatThread> sendMessage(
    String text, {
    Set<String>? enabledMemoryIds,
  }) async {
    final userMsg = ChatMessage(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
      role: MessageRole.user,
      contentType: MessageContentType.text,
      text: text,
      timestamp: DateTime.now(),
    );

    _chatThread = _chatThread.copyWith(
      messages: [..._chatThread.messages, userMsg],
    );

    // Simulate agent response
    await Future.delayed(const Duration(milliseconds: 1500));

    final memory = chatMemoryItems(enabledMemoryIds);
    final agentMsg = ChatMessage(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}_agent',
      role: MessageRole.agent,
      contentType: MessageContentType.text,
      text: _getDemoResponse(text, memory),
      timestamp: DateTime.now(),
      memoryItemIds: memory.map((item) => item.id).toList(),
    );

    _chatThread = _chatThread.copyWith(
      messages: [..._chatThread.messages, agentMsg],
      sourcesCount: 214,
    );

    return _chatThread;
  }

  /// Rewrites the latest answer so toggles in the memory sheet apply to this chat only.
  Future<ChatThread> applyChatMemory(Set<String> enabledIds) async {
    final messages = List<ChatMessage>.from(_chatThread.messages);
    final agentIndex = messages.lastIndexWhere((message) => message.isAgent);
    if (agentIndex < 0) return _chatThread;

    var userText = '';
    for (var index = agentIndex - 1; index >= 0; index--) {
      final message = messages[index];
      if (message.isUser && message.text != null) {
        userText = message.text!;
        break;
      }
    }

    final memory = chatMemoryItems(enabledIds);
    final current = messages[agentIndex];
    messages[agentIndex] = ChatMessage(
      id: current.id,
      chatId: current.chatId,
      role: current.role,
      contentType: current.contentType,
      text: _getDemoResponse(userText, memory),
      listings: current.listings,
      handoff: current.handoff,
      timestamp: DateTime.now(),
      memoryItemIds: memory.map((item) => item.id).toList(),
    );
    _chatThread = _chatThread.copyWith(messages: messages);
    return _chatThread;
  }

  Future<ChatThread> switchMode(ChatMode mode) async {
    _chatThread = _chatThread.copyWith(mode: mode);
    return _delay(_chatThread);
  }

  String _getDemoResponse(String input, [List<MemoryItem> memory = const []]) {
    final String answer;
    if (input.toLowerCase().contains('rav4')) {
      answer =
          'The Toyota RAV4 Hybrid is one of the most popular compact SUVs. '
          'Based on 214 listings nearby, the median price for a 2024 RAV4 Hybrid XLE '
          'is around \$34,600. With your budget, you have several good options within 50 miles.';
    } else {
      answer = 'I can help you find the right car. What features are most important to you?';
    }
    if (memory.isEmpty) return answer;

    final remembered = memory
        .map((item) => '${item.kind.label.toLowerCase()} ${item.displayValue}')
        .join(', ');
    final search = latestSearchTitle();
    final intro = search == null
        ? 'Using what you saved: $remembered.'
        : 'You searched $search. Using $remembered.';
    return '$intro $answer';
  }

  // ============== STATS ==============

  Future<DealStats> getDealStats() async {
    final deals = await getDeals();
    final balance = await getCreditBalance();

    int totalSavings = 0;
    int offersToReview = 0;

    for (final deal in deals) {
      if (deal.savings != null && deal.savings! > 0) {
        totalSavings += deal.savings!;
      }
      if (deal.status == DealStatus.offerReceived) {
        offersToReview++;
      }
    }

    // v1.7: Stats now use credit balance, not monthly usage
    return _delay(
      DealStats(
        underListedTotal: totalSavings,
        offersToReview: offersToReview,
        carsRemaining: balance.balance,
      ),
    );
  }

  // ============== DEMO DATA ==============

  static final _demoListings = [
    const Listing(
      id: 'listing_001',
      vin: '2T3P1RFV5RC123456',
      stockNo: 'T12345',
      price: 32995,
      miles: 18420,
      build: ListingBuild(
        year: 2024,
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE',
        bodyType: 'SUV',
        drivetrain: 'AWD',
        powertrainType: 'Hybrid',
        engine: '2.5L 4-Cylinder',
        cityMpg: 41,
        highwayMpg: 38,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/rav4b.jpg']),
      carLocation: CarLocation(
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        latitude: 39.7817,
        longitude: -89.6501,
      ),
      dist: 12,
      domActive: 67,
      inventoryType: 'used',
      carfax1Owner: true,
      carfaxCleanTitle: true,
      extra: ListingExtra(
        highValueFeatures: [
          'Blind Spot Monitor',
          'Apple CarPlay',
          'Heated Seats',
          'Adaptive Cruise Control',
        ],
      ),
      colors: ListingColors(exteriorColor: 'Sage Gray', interiorColor: 'Black'),
      vdpUrl: 'https://springfieldtoyota.example/used/listing_001',
      rooftopMatch: RooftopMatch(
        matched: true,
        rooftopId: StubRooftopMatchEndpoint.demoRooftopId,
        vdpUrl: 'https://springfieldtoyota.example/used/listing_001',
        source: RooftopMatchSource.stub,
      ),
    ),
    const Listing(
      id: 'listing_002',
      vin: '2HKRW2H50NH123456',
      stockNo: 'H67890',
      price: 31490,
      miles: 22150,
      build: ListingBuild(
        year: 2024,
        make: 'Honda',
        model: 'CR-V',
        trim: 'EX-L',
        bodyType: 'SUV',
        drivetrain: 'AWD',
        powertrainType: 'Hybrid',
        engine: '2.0L 4-Cylinder',
        cityMpg: 40,
        highwayMpg: 34,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/crv.jpg']),
      dist: 8,
      domActive: 45,
      inventoryType: 'used',
      extra: ListingExtra(
        highValueFeatures: ['Leather Seats', 'Sunroof', 'Lane Keep Assist'],
      ),
      colors: ListingColors(
        exteriorColor: 'Crystal Black Pearl',
        interiorColor: 'Gray',
      ),
      vdpUrl: 'https://offnetworkhonda.example/used/listing_002',
    ),
    const Listing(
      id: 'listing_003',
      vin: '19XFL2H78NE123456',
      stockNo: 'C11111',
      price: 26780,
      miles: 15230,
      build: ListingBuild(
        year: 2024,
        make: 'Honda',
        model: 'Civic',
        trim: 'Sport',
        bodyType: 'Sedan',
        drivetrain: 'FWD',
        powertrainType: 'Gas',
        engine: '2.0L 4-Cylinder',
        cityMpg: 31,
        highwayMpg: 40,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/civic.jpg']),
      dist: 15,
      domActive: 30,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Rallye Red',
        interiorColor: 'Black',
      ),
    ),
    const Listing(
      id: 'listing_004',
      vin: 'JM3KFBCM5N0123456',
      stockNo: 'M22222',
      price: 29950,
      miles: 28900,
      build: ListingBuild(
        year: 2024,
        make: 'Mazda',
        model: 'CX-50',
        trim: 'Premium',
        bodyType: 'SUV',
        drivetrain: 'AWD',
        powertrainType: 'Gas',
        engine: '2.5L Turbo',
        cityMpg: 23,
        highwayMpg: 29,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/cx50.jpg']),
      dist: 22,
      domActive: 52,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Zircon Sand',
        interiorColor: 'Terracotta',
      ),
    ),
    const Listing(
      id: 'listing_005',
      vin: '5YJ3E1EA5NF123456',
      stockNo: 'E33333',
      price: 38900,
      miles: 12500,
      build: ListingBuild(
        year: 2024,
        make: 'Tesla',
        model: 'Model 3',
        trim: 'Long Range',
        bodyType: 'Sedan',
        drivetrain: 'AWD',
        powertrainType: 'Electric',
        cityMpg: 134, // MPGe
        highwayMpg: 126,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/model3.jpg']),
      dist: 18,
      domActive: 21,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Pearl White',
        interiorColor: 'Black',
      ),
    ),
    const Listing(
      id: 'listing_006',
      vin: 'KM8JBCA19NU123456',
      stockNo: 'K44444',
      price: 28450,
      miles: 19800,
      build: ListingBuild(
        year: 2024,
        make: 'Hyundai',
        model: 'Tucson',
        trim: 'SEL',
        bodyType: 'SUV',
        drivetrain: 'AWD',
        powertrainType: 'Hybrid',
        engine: '1.6L Turbo Hybrid',
        cityMpg: 38,
        highwayMpg: 38,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/tucson.jpg']),
      dist: 25,
      domActive: 38,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Amazon Gray',
        interiorColor: 'Black',
      ),
    ),
    // New car listing for screen 44
    const Listing(
      id: 'listing_007',
      vin: '5TFBY5F13NX123456',
      stockNo: 'N55555',
      price: 48990,
      msrp: 52500,
      miles: 0,
      build: ListingBuild(
        year: 2025,
        make: 'Toyota',
        model: 'Tacoma',
        trim: 'TRD Off-Road',
        bodyType: 'Truck',
        drivetrain: '4WD',
        powertrainType: 'Gas',
        engine: '2.4L Turbo',
        cityMpg: 20,
        highwayMpg: 24,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/tacoma.jpg']),
      dist: 15,
      domActive: 12,
      inventoryType: 'new',
      extra: ListingExtra(
        highValueFeatures: [
          'TRD Off-Road Package',
          'Multi-Terrain Select',
          'Panoramic View Monitor',
        ],
      ),
      colors: ListingColors(
        exteriorColor: 'Solar Octane',
        interiorColor: 'Black',
      ),
      vdpUrl: 'https://springfieldtoyota.example/new/listing_007',
      rooftopMatch: RooftopMatch(
        matched: true,
        rooftopId: StubRooftopMatchEndpoint.demoRooftopId,
        vdpUrl: 'https://springfieldtoyota.example/new/listing_007',
        source: RooftopMatchSource.stub,
      ),
    ),
    const Listing(
      id: 'listing_008',
      vin: '19XFC2F59NE123456',
      stockNo: 'H80808',
      price: 21990,
      miles: 41200,
      build: ListingBuild(
        year: 2022,
        make: 'Honda',
        model: 'Civic',
        trim: 'Sport',
        bodyType: 'Sedan',
        drivetrain: 'FWD',
        powertrainType: 'Gas',
        engine: '2.0L',
        cityMpg: 31,
        highwayMpg: 40,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/civic.jpg']),
      dist: 9,
      domActive: 18,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Sonic Gray',
        interiorColor: 'Black',
      ),
    ),
    const Listing(
      id: 'listing_009',
      vin: '5XYP3DHC5NG123456',
      stockNo: 'K90909',
      price: 26880,
      miles: 22140,
      build: ListingBuild(
        year: 2023,
        make: 'Kia',
        model: 'Sportage',
        trim: 'LX',
        bodyType: 'SUV',
        drivetrain: 'AWD',
        powertrainType: 'Gas',
        engine: '2.5L',
        cityMpg: 23,
        highwayMpg: 28,
        seatingCapacity: 5,
      ),
      media: ListingMedia(photoLinks: ['assets/images/tucson.jpg']),
      dist: 14,
      domActive: 27,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Steel Gray',
        interiorColor: 'Black',
      ),
    ),
  ];

  /// Still resolvable for Saved, and kept out of Shop because the car is gone.
  static const _retiredListings = [
    Listing(
      id: 'listing_sold_010',
      vin: '4S4BTANC5M3123456',
      price: 24800,
      miles: 48600,
      build: ListingBuild(
        year: 2021,
        make: 'Subaru',
        model: 'Outback',
        trim: 'Premium',
        bodyType: 'SUV',
        drivetrain: 'AWD',
      ),
      media: ListingMedia(photoLinks: []),
      dist: 31,
    ),
  ];

  List<DealerTimeline> get _rav4Timelines => [
    DealerTimeline(
      letter: 'A',
      status: DealStatus.offerReceived,
      rounds: [
        DealerQuoteRound(
          id: 'tl_a_1',
          round: 1,
          receivedAt: DateTime.now().subtract(const Duration(days: 4)),
          otd: 36450,
          vehiclePrice: 32100,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 32100),
            OfferLine(key: 'Doc fee', amount: 499),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 2006),
            OfferLine(key: 'Paint protection', amount: 895),
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
        ),
        DealerQuoteRound(
          id: 'tl_a_2',
          round: 2,
          receivedAt: DateTime.now().subtract(const Duration(days: 2)),
          otd: 35120,
          vehiclePrice: 31200,
          lines: const [
            OfferLine(
              key: 'Vehicle price',
              amount: 31200,
              subLine: 'Down from \$32,100',
            ),
            OfferLine(key: 'Doc fee', amount: 499),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1950),
            OfferLine(key: 'Paint protection', amount: 895),
          ],
          removedFees: const [OfferLine(key: 'Nitrogen fill', amount: 199)],
        ),
        DealerQuoteRound(
          id: 'tl_a_3',
          round: 3,
          receivedAt: DateTime.now().subtract(const Duration(hours: 2)),
          otd: 33415,
          vehiclePrice: 30700,
          lines: const [
            OfferLine(
              key: 'Vehicle price',
              amount: 30700,
              subLine: 'Down from \$31,200',
            ),
            OfferLine(key: 'Doc fee', amount: 399, subLine: 'Down from \$499'),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1919),
          ],
          removedFees: const [
            OfferLine(key: 'Paint protection', amount: 895),
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
        ),
      ],
    ),
    DealerTimeline(
      letter: 'B',
      status: DealStatus.findingBestPrice,
      rounds: [
        DealerQuoteRound(
          id: 'tl_b_1',
          round: 1,
          receivedAt: DateTime.now().subtract(const Duration(days: 3)),
          otd: 36977,
          vehiclePrice: 32950,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 32950),
            OfferLine(key: 'Doc fee', amount: 599),
            OfferLine(key: 'Title & registration', amount: 275),
            OfferLine(key: 'Sales tax (6.25%)', amount: 2059),
            OfferLine(key: 'Paint protection', amount: 895),
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
        ),
        DealerQuoteRound(
          id: 'tl_b_2',
          round: 2,
          receivedAt: DateTime.now().subtract(const Duration(days: 1)),
          otd: 34880,
          vehiclePrice: 32100,
          lines: const [
            OfferLine(
              key: 'Vehicle price',
              amount: 32100,
              subLine: 'Down from \$32,950',
            ),
            OfferLine(key: 'Doc fee', amount: 499, subLine: 'Down from \$599'),
            OfferLine(key: 'Title & registration', amount: 275),
            OfferLine(key: 'Sales tax (6.25%)', amount: 2006),
          ],
          removedFees: const [
            OfferLine(key: 'Paint protection', amount: 895),
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
        ),
      ],
    ),
    const DealerTimeline(letter: 'C', status: DealStatus.noResponse),
  ];

  List<Deal> get _demoDealsList => [
    // Offer received - main demo deal
    Deal(
      id: 'deal_001',
      listingId: 'listing_001',
      letter: 'A',
      status: DealStatus.offerReceived,
      listedAtStart: 32995,
      addedAt: DateTime.now().subtract(const Duration(days: 6)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 6)),
      listing: _demoListings[0],
      marketContext: const MarketContext(
        fairVehiclePrice: 33900, // Must be between low and high
        fairOtd: 37400,
        lowPrice: 30400, // p25
        medianPrice: 34600, // p50
        highPrice: 38200, // p75
        comparablesCount: 14,
        daysListedMedian: 38,
        priceDrops: 2,
      ),
      offers: [
        Offer(
          id: 'offer_001_1',
          receivedAt: DateTime.now().subtract(const Duration(days: 4)),
          otd: 36450,
          vehiclePrice: 32100,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 32100),
            OfferLine(key: 'Doc fee', amount: 499),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 2006),
            OfferLine(key: 'Paint protection', amount: 895),
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
          validUntil: DateTime.now().add(const Duration(days: 3)),
        ),
        Offer(
          id: 'offer_001_2',
          receivedAt: DateTime.now().subtract(const Duration(days: 2)),
          otd: 35120,
          vehiclePrice: 31200,
          lines: const [
            OfferLine(
              key: 'Vehicle price',
              amount: 31200,
              subLine: 'Down from \$32,100',
            ),
            OfferLine(key: 'Doc fee', amount: 499),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1950),
            OfferLine(key: 'Paint protection', amount: 895),
          ],
          removedAddOns: const [OfferLine(key: 'Nitrogen fill', amount: 199)],
          validUntil: DateTime.now().add(const Duration(days: 5)),
        ),
        Offer(
          id: 'offer_001_3',
          receivedAt: DateTime.now().subtract(const Duration(hours: 2)),
          otd: 33415,
          vehiclePrice: 30700,
          lines: const [
            OfferLine(
              key: 'Vehicle price',
              amount: 30700,
              subLine: 'Down from \$31,200',
            ),
            OfferLine(key: 'Doc fee', amount: 399, subLine: 'Down from \$499'),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1919),
          ],
          removedAddOns: const [
            OfferLine(key: 'Paint protection', amount: 895),
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
          validUntil: DateTime.now().add(const Duration(days: 7)),
        ),
      ],
      comms: const DealComms(emails: 7, texts: 4, calls: 0),
      events: [
        DealEvent(
          id: 'evt_001_1',
          timestamp: DateTime.now().subtract(const Duration(days: 6)),
          heading: 'Drevvy started working on this deal',
          detail: 'Reached out to Dealer A by email',
        ),
        DealEvent(
          id: 'evt_001_2',
          timestamp: DateTime.now().subtract(const Duration(days: 5)),
          heading: 'Dealer A replied',
          detail: 'Sent an initial quote',
        ),
        DealEvent(
          id: 'evt_001_3',
          timestamp: DateTime.now().subtract(const Duration(days: 4)),
          heading: 'First offer received',
          detail: '\$36,450 out the door',
        ),
        DealEvent(
          id: 'evt_001_4',
          timestamp: DateTime.now().subtract(const Duration(days: 2)),
          heading: 'Improved offer received',
          detail: '\$35,120 out the door · removed nitrogen fill',
        ),
        DealEvent(
          id: 'evt_001_5',
          timestamp: DateTime.now().subtract(const Duration(hours: 2)),
          heading: 'New offer received',
          detail: '\$33,415 out the door · \$2,295 under listed',
          isLatest: true,
        ),
      ],
      dealerTimelines: _rav4Timelines,
    ),

    // Finding best price
    Deal(
      id: 'deal_002',
      listingId: 'listing_002',
      letter: 'B',
      status: DealStatus.findingBestPrice,
      listedAtStart: 31490,
      addedAt: DateTime.now().subtract(const Duration(days: 3)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 3)),
      listing: _demoListings[1],
      marketContext: const MarketContext(
        fairVehiclePrice: 32000,
        fairOtd: 35500,
        lowPrice: 29500,
        medianPrice: 32200,
        highPrice: 35000,
        comparablesCount: 11,
        daysListedMedian: 42,
      ),
      offers: [
        Offer(
          id: 'offer_002_1',
          receivedAt: DateTime.now().subtract(const Duration(days: 1)),
          otd: 34890,
          vehiclePrice: 30990,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 30990),
            OfferLine(key: 'Doc fee', amount: 599),
            OfferLine(key: 'Title & registration', amount: 275),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1937),
          ],
          validUntil: DateTime.now().add(const Duration(days: 5)),
        ),
      ],
      comms: const DealComms(emails: 4, texts: 2, calls: 0),
      dealerTimelines: [
        DealerTimeline(
          letter: 'A',
          status: DealStatus.findingBestPrice,
          rounds: [
            DealerQuoteRound(
              id: 'tl_002_a',
              round: 1,
              receivedAt: DateTime.now().subtract(const Duration(days: 1)),
              otd: 34890,
              vehiclePrice: 30990,
              lines: const [
                OfferLine(key: 'Vehicle price', amount: 30990),
                OfferLine(key: 'Doc fee', amount: 599),
                OfferLine(key: 'Title & registration', amount: 275),
                OfferLine(key: 'Sales tax (6.25%)', amount: 1937),
              ],
            ),
          ],
        ),
        const DealerTimeline(letter: 'B', status: DealStatus.reachingOut),
      ],
    ),

    // Reaching out (new, with undo window)
    Deal(
      id: 'deal_003',
      listingId: 'listing_003',
      letter: 'C',
      status: DealStatus.reachingOut,
      listedAtStart: 26780,
      addedAt: DateTime.now().subtract(const Duration(minutes: 5)),
      listing: _demoListings[2],
      comms: const DealComms(emails: 0, texts: 0, calls: 0),
    ),

    // Official offer received (dealer revealed)
    Deal(
      id: 'deal_004',
      listingId: 'listing_004',
      letter: 'D',
      status: DealStatus.officialOfferReceived,
      listedAtStart: 29950,
      addedAt: DateTime.now().subtract(const Duration(days: 10)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 10)),
      listing: _demoListings[3],
      marketContext: const MarketContext(
        fairVehiclePrice: 30500,
        fairOtd: 34000,
        lowPrice: 28000,
        medianPrice: 30800,
        highPrice: 33500,
        comparablesCount: 9,
        daysListedMedian: 35,
      ),
      offers: [
        Offer(
          id: 'offer_004_1',
          receivedAt: DateTime.now().subtract(const Duration(days: 5)),
          otd: 32450,
          vehiclePrice: 28900,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 28900),
            OfferLine(key: 'Doc fee', amount: 399),
            OfferLine(key: 'Title & registration', amount: 245),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1806),
          ],
          validUntil: DateTime.now().add(const Duration(days: 7)),
        ),
      ],
      comms: const DealComms(emails: 8, texts: 5, calls: 1),
      dealer: const RevealedDealer(
        name: 'Metro Mazda',
        address: '2150 Shoreline Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        latitude: 39.7817,
        longitude: -89.6501,
        distance: 22,
        rep: DealerRep(
          name: 'Jordan Ellis',
          role: 'Internet Sales Manager',
          phone: '(555) 014-2290',
          email: 'jordan.ellis@example.com',
        ),
      ),
      officialOffer: OfficialOffer(
        id: 'official_004',
        receivedAt: DateTime.now().subtract(const Duration(days: 1)),
        otd: 32450,
        vehiclePrice: 28900,
        lines: const [
          OfferLine(key: 'Vehicle price', amount: 28900),
          OfferLine(key: 'Doc fee', amount: 399),
          OfferLine(key: 'Title & registration', amount: 245),
          OfferLine(key: 'Sales tax (6.25%)', amount: 1806),
        ],
        validUntil: DateTime.now().add(const Duration(days: 7)),
        vin: 'JM3KFBCM5N0123456',
        fromEmail: 'sales@metrohyundai.example.com',
        forwardedAt: DateTime.now().subtract(const Duration(hours: 23)),
      ),
    ),

    // No longer listed (likely sold)
    Deal(
      id: 'deal_005',
      listingId: 'listing_broken',
      letter: 'E',
      status: DealStatus.noLongerListed,
      listedAtStart: 27500,
      addedAt: DateTime.now().subtract(const Duration(days: 8)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 8)),
      listing: const Listing(
        id: 'listing_broken',
        vin: '4S4BSANC8N3123456',
        price: 27500,
        miles: 35200,
        build: ListingBuild(
          year: 2023,
          make: 'Subaru',
          model: 'Outback',
          trim: 'Premium',
          bodyType: 'SUV',
          drivetrain: 'AWD',
        ),
        media: ListingMedia(photoLinks: []),
      ),
      comms: const DealComms(emails: 3, texts: 1, calls: 0),
    ),

    // No response
    Deal(
      id: 'deal_006',
      listingId: 'listing_006',
      letter: 'F',
      status: DealStatus.noResponse,
      listedAtStart: 28450,
      addedAt: DateTime.now().subtract(const Duration(days: 7)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 7)),
      listing: _demoListings[5],
      comms: const DealComms(emails: 5, texts: 3, calls: 2),
    ),

    // v1.6: Watching for drops
    Deal(
      id: 'deal_007',
      listingId: 'listing_005',
      letter: 'G',
      status: DealStatus.watchingForDrops,
      listedAtStart: 38900,
      addedAt: DateTime.now().subtract(const Duration(days: 4)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 4)),
      listing: _demoListings[4],
      marketContext: const MarketContext(
        fairVehiclePrice: 37500,
        fairOtd: 41000,
        lowPrice: 35000,
        medianPrice: 38000,
        highPrice: 42000,
        comparablesCount: 6,
        daysListedMedian: 28,
      ),
      comms: const DealComms(emails: 3, texts: 1, calls: 0),
    ),

    // v1.6: Changed after accepted
    Deal(
      id: 'deal_008',
      listingId: 'listing_002',
      letter: 'H',
      status: DealStatus.changedAfterAccepted,
      listedAtStart: 31490,
      addedAt: DateTime.now().subtract(const Duration(days: 5)),
      firstContactAt: DateTime.now().subtract(const Duration(days: 5)),
      listing: _demoListings[1],
      marketContext: const MarketContext(
        fairVehiclePrice: 32000,
        fairOtd: 35500,
        lowPrice: 29500,
        medianPrice: 32200,
        highPrice: 35000,
        comparablesCount: 11,
        daysListedMedian: 42,
      ),
      offers: [
        Offer(
          id: 'offer_008_1',
          receivedAt: DateTime.now().subtract(const Duration(days: 3)),
          otd: 34200,
          vehiclePrice: 30500,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 30500),
            OfferLine(key: 'Doc fee', amount: 399),
            OfferLine(key: 'Title & registration', amount: 275),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1906),
          ],
        ),
      ],
      acceptedOffer: Offer(
        id: 'offer_008_1',
        receivedAt: DateTime.now().subtract(const Duration(days: 3)),
        otd: 34200,
        vehiclePrice: 30500,
        lines: const [
          OfferLine(key: 'Vehicle price', amount: 30500),
          OfferLine(key: 'Doc fee', amount: 399),
          OfferLine(key: 'Title & registration', amount: 275),
          OfferLine(key: 'Sales tax (6.25%)', amount: 1906),
        ],
      ),
      changedOffer: Offer(
        id: 'offer_008_2',
        receivedAt: DateTime.now().subtract(const Duration(hours: 6)),
        otd: 35400,
        vehiclePrice: 31200,
        lines: const [
          OfferLine(key: 'Vehicle price', amount: 31200),
          OfferLine(key: 'Doc fee', amount: 499),
          OfferLine(key: 'Title & registration', amount: 275),
          OfferLine(key: 'Sales tax (6.25%)', amount: 1950),
          OfferLine(key: 'Market adjustment', amount: 500),
        ],
      ),
      comms: const DealComms(emails: 6, texts: 3, calls: 1),
    ),
  ];
}

class DealStats {
  const DealStats({
    required this.underListedTotal,
    required this.offersToReview,
    required this.carsRemaining,
  });

  final int underListedTotal;
  final int offersToReview;

  /// Keys remaining from credit balance (no longer monthly usage).
  final int carsRemaining;

  /// Display text for keys remaining.
  String get carsRemainingFormatted =>
      carsRemaining == 1 ? '1 key left' : '$carsRemaining keys left';

  /// Whether the shopper can spend another key.
  bool get canUnlock => carsRemaining > 0;
}

// ============== SEARCH PROFILE (v1.6.1) ==============

SearchProfile _newDemoSearchProfile() {
  return SearchProfile(
    userId: 'user_demo_001',
    personalize: true,
    items: [
      MemoryItem(
        id: 'mem_001',
        kind: MemoryKind.budget,
        value: 40000,
        source: MemorySource.onboarding,
        updatedAt: DateTime.now().subtract(const Duration(days: 30)),
      ),
      MemoryItem(
        id: 'mem_002',
        kind: MemoryKind.bodyTypes,
        value: ['SUV', 'Sedan'],
        source: MemorySource.inferred,
        updatedAt: DateTime.now().subtract(const Duration(days: 7)),
        lastUsedAt: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      MemoryItem(
        id: 'mem_003',
        kind: MemoryKind.makes,
        value: ['Toyota', 'Honda', 'Mazda'],
        source: MemorySource.inferred,
        updatedAt: DateTime.now().subtract(const Duration(days: 14)),
      ),
      MemoryItem(
        id: 'mem_004',
        kind: MemoryKind.fuel,
        value: ['Hybrid', 'Gas'],
        source: MemorySource.inferred,
        updatedAt: DateTime.now().subtract(const Duration(days: 5)),
      ),
      MemoryItem(
        id: 'mem_005',
        kind: MemoryKind.location,
        value: {'zip': '94105', 'radius': 50},
        source: MemorySource.explicit,
        updatedAt: DateTime.now().subtract(const Duration(days: 30)),
      ),
    ],
    searches: [
      SavedSearch(
        id: 'search_001',
        filters: SearchFilters(
          makes: ['Toyota'],
          models: ['RAV4'],
          priceMax: 35000,
          zip: '94105',
          radiusMi: 30,
        ),
        lastRunAt: DateTime.now().subtract(const Duration(hours: 2)),
        runCount: 5,
      ),
      SavedSearch(
        id: 'search_002',
        filters: SearchFilters(
          makes: ['Honda'],
          models: ['CR-V'],
          bodyTypes: ['SUV'],
          priceMax: 40000,
          zip: '94105',
          radiusMi: 50,
        ),
        lastRunAt: DateTime.now().subtract(const Duration(days: 3)),
        runCount: 2,
      ),
    ],
  );
}

extension DemoRepositorySearchProfile on DemoRepository {
  static SearchProfile _searchProfile = _newDemoSearchProfile();

  /// Restores the in-memory demo search profile between tests.
  void resetDemoSearchProfile() {
    _searchProfile = _newDemoSearchProfile();
  }

  /// Stores first-run answers on the shopper and as onboarding memory.
  /// Asking and shopping stay available when these are left blank.
  Future<void> saveOnboardingAnswers({
    int? budgetOtd,
    List<String> bodyTypes = const [],
    TradeInPref tradeIn = TradeInPref.unsure,
    PaymentPref payment = PaymentPref.unsure,
    String? zip,
    bool locationGranted = false,
  }) async {
    final user = await getCurrentUser();
    await updateUser(
      user.copyWith(
        prefs: UserPrefs(
          budgetOtd: budgetOtd ?? user.prefs?.budgetOtd,
          bodyTypes: bodyTypes.isEmpty
              ? (user.prefs?.bodyTypes ?? const [])
              : bodyTypes,
          tradeIn: tradeIn,
          payment: payment,
          radius: user.prefs?.radius ?? 50,
        ),
        zipCode: zip ?? user.zipCode,
        locationState: zip != null
            ? LocationState.zipFallback
            : locationGranted
            ? LocationState.granted
            : user.locationState,
      ),
    );
    if (budgetOtd != null) {
      _remember(MemoryKind.budget, budgetOtd);
    }
    if (bodyTypes.isNotEmpty) {
      _remember(MemoryKind.bodyTypes, bodyTypes);
    }
    if (zip != null && zip.isNotEmpty) {
      _remember(MemoryKind.location, {
        'zip': zip,
        'radius': user.prefs?.radius ?? 50,
      });
    }
  }

  void _remember(MemoryKind kind, Object value) {
    final items = List<MemoryItem>.from(_searchProfile.items);
    final index = items.indexWhere((item) => item.kind == kind);
    final next = MemoryItem(
      id: index >= 0 ? items[index].id : 'mem_onboarding_${kind.name}',
      kind: kind,
      value: value,
      source: MemorySource.onboarding,
      updatedAt: DateTime.now(),
    );
    if (index >= 0) {
      items[index] = next;
    } else {
      items.add(next);
    }
    _searchProfile = _searchProfile.copyWith(items: items);
  }

  List<MemoryItem> chatMemoryItems(Set<String>? enabledIds) {
    if (!_searchProfile.personalize) return const [];
    if (enabledIds == null) return List<MemoryItem>.from(_searchProfile.items);
    return _searchProfile.items
        .where((item) => enabledIds.contains(item.id))
        .toList();
  }

  String? latestSearchTitle() {
    if (_searchProfile.searches.isEmpty) return null;
    return _searchProfile.searches.first.displayTitle;
  }

  void markSavedSearchRun(String searchId) {
    SavedSearch? updated;
    final searches = _searchProfile.searches.map((search) {
      if (search.id != searchId) return search;
      final next = search.copyWith(
        lastRunAt: DateTime.now(),
        runCount: search.runCount + 1,
      );
      updated = next;
      return next;
    }).toList()..sort((a, b) => b.lastRunAt.compareTo(a.lastRunAt));
    _searchProfile = _searchProfile.copyWith(searches: searches);
    final ran = updated;
    if (ran != null) onSavedSearchRun?.call(ran);
  }

  void deleteSavedSearch(String searchId) {
    _searchProfile = _searchProfile.copyWith(
      searches: _searchProfile.searches
          .where((search) => search.id != searchId)
          .toList(),
    );
  }

  void restoreSavedSearch(SavedSearch search, int index) {
    if (_searchProfile.searches.any((item) => item.id == search.id)) return;
    final searches = List<SavedSearch>.from(_searchProfile.searches);
    searches.insert(index.clamp(0, searches.length), search);
    _searchProfile = _searchProfile.copyWith(searches: searches);
  }

  void clearSavedSearches() {
    _searchProfile = _searchProfile.copyWith(searches: const []);
  }

  Future<SearchProfile> getSearchProfile() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return _searchProfile;
  }

  Future<SearchProfile> updateSearchProfile(SearchProfile profile) async {
    _searchProfile = profile;
    await Future.delayed(const Duration(milliseconds: 300));
    return _searchProfile;
  }

  Future<void> deleteMemoryItem(String itemId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    _searchProfile = _searchProfile.copyWith(
      items: _searchProfile.items.where((i) => i.id != itemId).toList(),
    );
  }

  Future<void> clearHistory() async {
    await Future.delayed(const Duration(milliseconds: 500));
    _searchProfile = SearchProfile(
      userId: _searchProfile.userId,
      personalize: _searchProfile.personalize,
      items: _searchProfile.items
          .where((i) => i.source == MemorySource.explicit)
          .toList(),
      searches: [],
      viewed: [],
    );
  }

  Future<List<StarterCard>> getStarters() async {
    await Future.delayed(const Duration(milliseconds: 300));

    if (!_searchProfile.personalize || _searchProfile.searches.isEmpty) {
      return _genericStarters;
    }

    final starters = <StarterCard>[];

    // Back to search - last saved search
    if (_searchProfile.searches.isNotEmpty) {
      final lastSearch = _searchProfile.searches.first;
      starters.add(
        StarterCard(
          kind: StarterKind.backToSearch,
          kicker: 'BACK TO YOUR SEARCH',
          title: lastSearch.displayTitle,
          action: StarterAction(mode: 'shop', filters: lastSearch.filters),
        ),
      );
    }

    // Price drops
    starters.add(
      const StarterCard(
        kind: StarterKind.priceDrops,
        kicker: 'PRICE DROPS',
        title: '3 price drops on cars like ones you viewed',
        action: StarterAction(mode: 'shop'),
      ),
    );

    // New listings
    starters.add(
      const StarterCard(
        kind: StarterKind.newListings,
        kicker: 'NEW LISTINGS',
        title: '5 new CR-V Hybrids within 30 mi',
        action: StarterAction(mode: 'shop'),
      ),
    );

    // Fair price
    starters.add(
      const StarterCard(
        kind: StarterKind.fairPrice,
        kicker: 'FAIR PRICE',
        title: 'Is \$32,995 fair for the RAV4 you viewed?',
        action: StarterAction(
          mode: 'ask',
          prompt: 'Is \$32,995 fair for the 2024 RAV4 Hybrid XLE?',
        ),
      ),
    );

    return starters.take(4).toList();
  }

  static const _genericStarters = [
    StarterCard(
      kind: StarterKind.generic,
      kicker: 'ASK DREVVY',
      title: 'Which hybrid SUV fits a family of four?',
      action: StarterAction(
        mode: 'ask',
        prompt: 'Which hybrid SUV fits a family of four?',
      ),
    ),
    StarterCard(
      kind: StarterKind.generic,
      kicker: 'FAIR PRICE',
      title: 'Is \$33k fair for a 2024 RAV4 Hybrid?',
      action: StarterAction(
        mode: 'ask',
        prompt: 'Is \$33k fair for a 2024 RAV4 Hybrid?',
      ),
    ),
    StarterCard(
      kind: StarterKind.generic,
      kicker: 'DEALER FEES',
      title: 'Which dealer fees should I never pay?',
      action: StarterAction(
        mode: 'ask',
        prompt: 'Which dealer fees should I never pay?',
      ),
    ),
    StarterCard(
      kind: StarterKind.generic,
      kicker: 'SHOP',
      title: 'Find EVs under \$35k near me',
      action: StarterAction(mode: 'shop', prompt: 'EVs under \$35k'),
    ),
  ];
}
