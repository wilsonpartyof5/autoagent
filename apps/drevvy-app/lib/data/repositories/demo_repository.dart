import '../models/models.dart';
import '../../core/theme/drevvy_tokens.dart';

/// Demo repository with realistic mock data modeled after MarketCheck API fields.
/// This allows for easy swap to the real backend later.
/// 
/// TODO: Replace with real API calls to:
/// - https://api.drevvy.com (Drevvy backend)
/// - Supabase auth
/// - RevenueCat/Superwall for billing
class DemoRepository {
  DemoRepository._();
  static final instance = DemoRepository._();

  // Simulated delay for realistic loading states
  Future<T> _delay<T>(T value, [Duration duration = const Duration(milliseconds: 500)]) async {
    await Future.delayed(duration);
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

  static final _demoUser = User(
    id: 'user_demo_001',
    firstName: 'Dana',
    email: 'dana.w@example.com',
    entitlement: Entitlement.pro,
    usage: Usage(
      used: 4,
      cap: 10,
      resetsOn: DateTime(2026, 10, 20),
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

  // ============== LISTINGS ==============

  Future<List<Listing>> searchListings({
    String? query,
    int? maxPrice,
    List<String>? bodyTypes,
    int? radius,
    int limit = 10,
  }) async {
    return _delay(_demoListings);
  }

  Future<Listing> getListingById(String id) async {
    final listing = _demoListings.firstWhere(
      (l) => l.id == id,
      orElse: () => _demoListings.first,
    );
    return _delay(listing);
  }

  Future<MarketContext> getMarketContext(Listing listing) async {
    // Mock market context with consistent math per audit
    // Fair price MUST be between low and high
    final isNew = listing.isNew;
    
    if (isNew) {
      final msrp = listing.msrp ?? listing.price + 2000;
      final discount = msrp - listing.price;
      return _delay(MarketContext(
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
      ));
    }
    
    // Used car: ensure fairVehiclePrice is between low and high
    // Using consistent percentiles (p25/p50/p75)
    final lowPrice = (listing.price * 0.92).round(); // p25
    final medianPrice = (listing.price * 1.02).round(); // p50
    final highPrice = (listing.price * 1.12).round(); // p75
    final fairVehicle = (listing.price * 1.03).round(); // MC Price between p50-p75
    
    return _delay(MarketContext(
      fairVehiclePrice: fairVehicle,
      fairOtd: fairVehicle + 3500, // +fees/tax estimate
      lowPrice: lowPrice,
      medianPrice: medianPrice,
      highPrice: highPrice,
      comparablesCount: 14,
      daysListedMedian: 38,
      priceDrops: 2,
      isNewCar: false,
    ));
  }

  // ============== DEALS ==============

  List<Deal> _deals = [];

  Future<List<Deal>> getDeals() async {
    if (_deals.isEmpty) {
      _deals = _demoDealsList;
    }
    return _delay(_deals);
  }

  Future<Deal> getDealById(String id) async {
    final deals = await getDeals();
    return deals.firstWhere((d) => d.id == id, orElse: () => deals.first);
  }

  Future<Deal> addDeal(Listing listing, {int? maxOtd}) async {
    final user = await getCurrentUser();
    final newDeal = Deal(
      id: 'deal_${DateTime.now().millisecondsSinceEpoch}',
      listingId: listing.id,
      letter: _getNextLetter(),
      status: DealStatus.reachingOut,
      listedAtStart: listing.price,
      addedAt: DateTime.now(),
      listing: listing,
      marketContext: await getMarketContext(listing),
      maxOtd: maxOtd,
    );
    _deals = [..._deals, newDeal];
    
    // Update usage
    _currentUser = user.copyWith(
      usage: Usage(
        used: user.usage.used + 1,
        cap: user.usage.cap,
        resetsOn: user.usage.resetsOn,
      ),
    );
    
    return _delay(newDeal);
  }

  Future<void> removeDeal(String dealId) async {
    final deal = await getDealById(dealId);
    _deals = _deals.where((d) => d.id != dealId).toList();
    
    // Refund slot if within undo window
    if (deal.canUndo) {
      final user = await getCurrentUser();
      _currentUser = user.copyWith(
        usage: Usage(
          used: user.usage.used - 1,
          cap: user.usage.cap,
          resetsOn: user.usage.resetsOn,
        ),
      );
    }
    
    return _delay(null);
  }

  Future<Deal> acceptOffer(String dealId) async {
    final deal = await getDealById(dealId);
    final updated = deal.copyWith(status: DealStatus.accepted);
    _deals = _deals.map((d) => d.id == dealId ? updated : d).toList();
    return _delay(updated);
  }

  Future<Deal> keepGoing(String dealId) async {
    final deal = await getDealById(dealId);
    final updated = deal.copyWith(status: DealStatus.findingBestPrice);
    _deals = _deals.map((d) => d.id == dealId ? updated : d).toList();
    return _delay(updated);
  }

  String _getNextLetter() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[_deals.length % 26];
  }

  // ============== CHAT ==============

  ChatThread _chatThread = const ChatThread(
    id: 'chat_main',
    mode: ChatMode.ask,
  );

  Future<ChatThread> getChatThread() async {
    return _delay(_chatThread);
  }

  Future<ChatThread> sendMessage(String text) async {
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

    final agentMsg = ChatMessage(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}_agent',
      role: MessageRole.agent,
      contentType: MessageContentType.text,
      text: _getDemoResponse(text),
      timestamp: DateTime.now(),
    );

    _chatThread = _chatThread.copyWith(
      messages: [..._chatThread.messages, agentMsg],
      sourcesCount: 214,
    );

    return _chatThread;
  }

  Future<ChatThread> switchMode(ChatMode mode) async {
    _chatThread = _chatThread.copyWith(mode: mode);
    return _delay(_chatThread);
  }

  String _getDemoResponse(String input) {
    if (input.toLowerCase().contains('rav4')) {
      return 'The Toyota RAV4 Hybrid is one of the most popular compact SUVs. '
          'Based on 214 listings nearby, the median price for a 2024 RAV4 Hybrid XLE '
          'is around \$34,600. With your budget, you have several good options within 50 miles.';
    }
    return 'I can help you find the right car. What features are most important to you?';
  }

  // ============== STATS ==============

  Future<DealStats> getDealStats() async {
    final deals = await getDeals();
    final user = await getCurrentUser();
    
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
    
    return _delay(DealStats(
      underListedTotal: totalSavings,
      offersToReview: offersToReview,
      used: user.usage.used,
      cap: user.usage.cap,
      resetsOn: user.usage.resetsOn,
    ));
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
      media: ListingMedia(
        photoLinks: ['assets/images/rav4b.jpg'],
      ),
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
        highValueFeatures: ['Blind Spot Monitor', 'Apple CarPlay', 'Heated Seats', 'Adaptive Cruise Control'],
      ),
      colors: ListingColors(
        exteriorColor: 'Sage Gray',
        interiorColor: 'Black',
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
      media: ListingMedia(
        photoLinks: ['assets/images/crv.jpg'],
      ),
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
      media: ListingMedia(
        photoLinks: ['assets/images/civic.jpg'],
      ),
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
      media: ListingMedia(
        photoLinks: ['assets/images/cx50.jpg'],
      ),
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
      media: ListingMedia(
        photoLinks: ['assets/images/model3.jpg'],
      ),
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
      media: ListingMedia(
        photoLinks: ['assets/images/tucson.jpg'],
      ),
      dist: 25,
      domActive: 38,
      inventoryType: 'used',
      colors: ListingColors(
        exteriorColor: 'Amazon Gray',
        interiorColor: 'Black',
      ),
    ),
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
            OfferLine(key: 'Vehicle price', amount: 31200, subLine: 'Down from \$32,100'),
            OfferLine(key: 'Doc fee', amount: 499),
            OfferLine(key: 'Title & registration', amount: 250),
            OfferLine(key: 'Sales tax (6.25%)', amount: 1950),
            OfferLine(key: 'Paint protection', amount: 895),
          ],
          removedAddOns: const [
            OfferLine(key: 'Nitrogen fill', amount: 199),
          ],
          validUntil: DateTime.now().add(const Duration(days: 5)),
        ),
        Offer(
          id: 'offer_001_3',
          receivedAt: DateTime.now().subtract(const Duration(hours: 2)),
          otd: 33415,
          vehiclePrice: 30700,
          lines: const [
            OfferLine(key: 'Vehicle price', amount: 30700, subLine: 'Down from \$31,200'),
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
  ];
}

class DealStats {
  const DealStats({
    required this.underListedTotal,
    required this.offersToReview,
    required this.used,
    required this.cap,
    required this.resetsOn,
  });

  final int underListedTotal;
  final int offersToReview;
  final int used;
  final int cap;
  final DateTime resetsOn;

  String get usageFormatted => '$used/$cap';
  String get resetsFormatted {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[resetsOn.month - 1]} ${resetsOn.day}';
  }
}
