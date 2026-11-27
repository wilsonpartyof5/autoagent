import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/discover_intent.dart';
import '../../../core/navigation/drevvy_nav_scope.dart';
import '../../../core/widgets/nav_top_bar.dart';
import '../../../core/widgets/shop_bottom_chrome.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/analytics/search_analytics.dart';
import '../../../core/config/api_config_exception.dart';
import '../../../data/discover/discover_catalog.dart';
import '../../../data/discover/discover_client.dart';
import '../../../data/discover/discover_config.dart';
import '../../../data/discover/discover_filters.dart';
import '../../../data/discover/discover_shop_controller.dart';
import '../../../data/services/saved_cars_endpoint.dart';
import '../../../data/location/device_location.dart';
import '../../../data/location/location_sources.dart';
import '../../../data/location/place_search.dart';
import '../../../data/location/shop_location_store.dart';
import '../../../data/models/models.dart';
import '../../../data/notifications/local_flags.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/shopper_session_store.dart';
import '../widgets/chat_messages.dart';
import '../widgets/discover_home.dart';
import '../widgets/shop_composer_overlay.dart';
import '../widgets/shop_results.dart';
import '../widgets/discover_filter_sheet.dart';
import '../widgets/discover_location_sheet.dart';
import '../widgets/discover_shop_pane.dart';

/// Screens 07-11, 17, 51-52: Shop tab with Ask/Shop toggle and history drawer (v1.6.1)
/// v1.8: Added save/heart support on inventory cards.
/// App always launches here on a new, unsaved Ask chat per spec §1.1
class ShopScreen extends StatefulWidget {
  const ShopScreen({
    super.key,
    this.discoverConfig,
    this.discoverCatalog,
    this.deviceLocation,
    this.placeSearch,
    this.locationFlags,
    this.repository,
  });

  /// Overrides the dart-define. Tests pass a live config with a fake catalog.
  final DiscoverConfig? discoverConfig;
  final DiscoverCatalog? discoverCatalog;
  final DeviceLocationSource? deviceLocation;
  final PlaceSearch? placeSearch;
  final LocalFlags? locationFlags;

  /// Overrides [DemoRepository.instance]. Tests use this to watch searches.
  final DemoRepository? repository;

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  late final DemoRepository _repo;
  DiscoverIntent? _intent;
  late final bool _liveDiscover;
  late final bool _discoverUnconfigured;
  DiscoverShopController? _discover;
  late final DeviceLocationSource _deviceLocation;
  late final PlaceSearch _placeSearch;
  bool _discoverBooted = false;

  ChatMode _mode = ChatMode.ask;
  ChatThread? _thread;
  List<Listing>? _listings;
  bool _isLoading = false;
  bool _isSearching = false;
  SearchProfile? _searchProfile;
  Set<String>? _enabledMemoryIds;
  int _memoryRevision = 0;

  /// v1.8: Track saved and deals listing IDs
  Set<String> _savedListingIds = {};
  Set<String> _dealsListingIds = {};
  List<Listing> _nearby = const [];
  bool _nearbyLoading = false;
  int _heartGeneration = 0;
  bool _reportedShopEmpty = false;
  late final ShopperAccountWatch _accountWatch;
  int? _discoverAccount;

  /// Bumped whenever the visible chat changes on this screen (send, retry,
  /// new chat, open from history). A slower [_loadData] read started before
  /// the change must not put an older thread back.
  int _threadRevision = 0;

  bool _sameAccount(int account) => mounted && _accountWatch.same(account);

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? DemoRepository.instance;
    final config = widget.discoverConfig ?? DiscoverConfig.fromEnvironment();
    _liveDiscover = config.isLive;
    _discoverUnconfigured = config.needsConfiguration;
    _deviceLocation = widget.deviceLocation ?? GeolocatorDeviceLocation();
    _placeSearch = widget.placeSearch ?? GeocodingPlaceSearch();
    if (_liveDiscover) {
      _discover = DiscoverShopController(
        catalog:
            widget.discoverCatalog ??
            HttpDiscoverCatalog(client: DiscoverClient(config: config)),
        locations: ShopLocationStore(
          widget.locationFlags ?? SharedPreferencesFlags(),
        ),
      );
      _discover!.addListener(_onDiscoverChanged);
    }
    ProductAnalytics.instance.screen('ask_chat');
    _repo.onSavedSearchRun = _handleSavedSearchRun;
    _repo.savedDealsTick.addListener(_refreshSavedAndDeals);
    _accountWatch = ShopperAccountWatch(_onAccountSessionChanged)..bind();
    if (!_liveDiscover && !_discoverUnconfigured) {
      _nearbyLoading = true;
    }
    _loadData();
    if (_liveDiscover) {
      _ensureDiscover();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = DrevvyNavScope.maybeOf(context)?.intent;
    if (!identical(next, _intent)) {
      _intent?.removeListener(_applyDiscoverIntent);
      _intent = next;
      _intent?.addListener(_applyDiscoverIntent);
    }
    _applyDiscoverIntent();
  }

  void _applyDiscoverIntent() {
    final intent = _intent;
    if (intent == null || !mounted) return;
    final chat = intent.pendingChat;
    if (chat == null) return;
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return;
    intent.pendingChat = null;
    _selectChat(chat);
  }

  void _onAccountSessionChanged() {
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _isSearching = false;
    });
    _loadData();
  }

  void _onDiscoverChanged() {
    final account = _discoverAccount;
    if (!mounted) return;
    if (account != null && !_accountWatch.same(account)) return;
    setState(() {});
  }

  @override
  void dispose() {
    if (identical(_repo.onSavedSearchRun, _handleSavedSearchRun)) {
      _repo.onSavedSearchRun = null;
    }
    _intent?.removeListener(_applyDiscoverIntent);
    _repo.savedDealsTick.removeListener(_refreshSavedAndDeals);
    _accountWatch.dispose();
    _discover?.removeListener(_onDiscoverChanged);
    _discover?.dispose();
    super.dispose();
  }

  Future<void> _refreshSavedAndDeals() async {
    final generation = ++_heartGeneration;
    final account = _accountWatch.capture();
    final savedCars = await _repo.getSavedCars();
    final deals = await _repo.getDeals();
    if (!mounted ||
        generation != _heartGeneration ||
        !_accountWatch.same(account)) {
      return;
    }
    setState(() {
      _savedListingIds = savedCars.map((car) => car.listingId).toSet();
      _dealsListingIds = deals.map((deal) => deal.listingId).toSet();
    });
  }

  Future<void> _loadData() async {
    final account = _accountWatch.capture();
    final threadRevision = _threadRevision;
    try {
      final thread = await _repo.getChatThread();
      final searchProfile = await _repo.getSearchProfile();

      // v1.8: Load saved and deals listing IDs for heart state
      final heartGeneration = ++_heartGeneration;
      final savedCars = await _repo.getSavedCars();
      final deals = await _repo.getDeals();
      List<Listing> nearby = _nearby;
      if (!_liveDiscover && !_discoverUnconfigured) {
        nearby = await _repo.searchListings(query: '');
        nearby.sort(
          (a, b) => (a.dist ?? 1e9).compareTo(b.dist ?? 1e9),
        );
        nearby = nearby.take(4).toList();
      }
      if (!mounted || !_accountWatch.same(account)) return;

      setState(() {
        if (threadRevision == _threadRevision) {
          _thread = thread;
        }
        _searchProfile = searchProfile;
        _enabledMemoryIds = searchProfile.items.map((item) => item.id).toSet();
        if (heartGeneration == _heartGeneration) {
          _savedListingIds = savedCars.map((sc) => sc.listingId).toSet();
          _dealsListingIds = deals.map((d) => d.listingId).toSet();
        }
        _nearby = nearby;
        _nearbyLoading = false;
      });
    } on ApiConfigException catch (error) {
      _showStaleAccountError(account, error.message);
    } on SavedCarsException catch (error) {
      _showStaleAccountError(account, error.message);
    } catch (_) {
      if (!mounted || !_accountWatch.same(account)) return;
    }
  }

  void _showStaleAccountError(int account, String message) {
    if (!mounted || !_accountWatch.same(account)) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  /// The chosen Discover place, sent with Ask so answers and cars are local.
  ({double? lat, double? lng, String? zip}) _askPlace() {
    final location = _discover?.location;
    if (location == null || !location.isUsable) {
      return (lat: null, lng: null, zip: null);
    }
    final label = location.label.trim();
    final zip = RegExp(r'^\d{5}$').hasMatch(label) ? label : null;
    return (lat: location.latitude, lng: location.longitude, zip: zip);
  }

  /// Composer entry for Ask. Returns true once the shopper's message is in
  /// the visible thread, so the composer clears only after that.
  bool _submitAsk(String text) {
    if (text.trim().isEmpty || _isLoading || !mounted) return false;
    return _sendMessage(text);
  }

  /// Adds the shopper's message right away, shows "Thinking…", and then the
  /// reply or a plain error with a retry. Returns false if nothing was sent.
  bool _sendMessage(String text, {String source = 'composer'}) {
    if (text.trim().isEmpty || !mounted || _isLoading) return false;
    final account = _accountWatch.capture();
    ProductAnalytics.instance.track(
      AnalyticsEvents.searchSubmitted,
      searchEventProperties(surface: 'ask', query: text, source: source),
    );
    final place = _askPlace();
    final revision = ++_threadRevision;
    final Future<ChatThread> pending;
    try {
      pending = _repo.sendMessage(
        text,
        enabledMemoryIds: _enabledMemoryIds,
        lat: place.lat,
        lng: place.lng,
        zip: place.zip,
      );
    } catch (_) {
      _showStaleAccountError(account, _askFailedCopy);
      return false;
    }
    setState(() {
      _thread = _repo.currentChatThread;
      _isLoading = true;
    });
    unawaited(_awaitAnswer(pending, account, revision));
    return true;
  }

  static const _askFailedCopy = "We couldn't send that. Try again.";

  Future<void> _awaitAnswer(
    Future<ChatThread> pending,
    int account,
    int revision,
  ) async {
    try {
      final thread = await pending;
      if (!_sameAccount(account)) return;
      setState(() {
        if (revision == _threadRevision) _thread = thread;
        _isLoading = false;
      });
    } on ApiConfigException catch (error) {
      if (!_sameAccount(account)) return;
      setState(() => _isLoading = false);
      _showStaleAccountError(account, error.message);
    } catch (_) {
      if (!_sameAccount(account)) return;
      setState(() => _isLoading = false);
      _showStaleAccountError(account, _askFailedCopy);
    }
  }

  void _retryAsk() {
    if (_isLoading || !mounted) return;
    final account = _accountWatch.capture();
    final place = _askPlace();
    final revision = ++_threadRevision;
    final pending = _repo.retryLastAsk(
      lat: place.lat,
      lng: place.lng,
      zip: place.zip,
    );
    setState(() {
      _thread = _repo.currentChatThread;
      _isLoading = true;
    });
    unawaited(_awaitAnswer(pending, account, revision));
  }

  Future<void> _search(
    String query, {
    SearchFilters? filters,
    String source = 'composer',
    bool userInitiated = true,
  }) async {
    // Live with an empty origin is not the demo catalog. Ask-to-shop,
    // shop starters, and the shop composer all enter through here.
    if (_discoverUnconfigured) {
      setState(() {
        _mode = ChatMode.shop;
        _isSearching = false;
      });
      return;
    }
    if (userInitiated && (query.trim().isNotEmpty || filters != null)) {
      final properties = searchEventProperties(
        surface: 'shop',
        query: query,
        source: source,
        filters: filters,
      );
      ProductAnalytics.instance.track(
        filters != null && query.trim().isEmpty
            ? AnalyticsEvents.searchRefined
            : AnalyticsEvents.searchSubmitted,
        properties,
      );
    }
    if (!mounted) return;
    final account = _accountWatch.capture();
    ShopBottomChromeScope.read(context)?.show();
    setState(() {
      _mode = ChatMode.shop;
      _isSearching = true;
    });

    try {
      if (_liveDiscover) {
        final discover = _discover!;
        if (filters != null) {
          discover.setFilters(DiscoverFilters.fromSearchFilters(filters));
        }
        _discoverAccount = account;
        await discover.search(query: query, reset: true);
        if (!_sameAccount(account)) return;
        setState(() => _isSearching = false);
        return;
      }

      final listings = await _repo.searchListings(
        query: query,
        filters: filters,
      );
      if (!_sameAccount(account)) return;

      setState(() {
        _listings = listings;
        _isSearching = false;
      });
      if (listings.isEmpty) {
        if (!_reportedShopEmpty) {
          _reportedShopEmpty = true;
          ProductAnalytics.instance.track(AnalyticsEvents.emptyStateViewed, {
            'surface': 'shop',
          });
        }
      } else {
        _reportedShopEmpty = false;
      }
    } on ApiConfigException catch (error) {
      if (!_sameAccount(account)) return;
      setState(() => _isSearching = false);
      _showStaleAccountError(account, error.message);
    } catch (_) {
      if (!_sameAccount(account)) return;
      setState(() => _isSearching = false);
    }
  }

  void _handleSavedSearchRun(SavedSearch search) {
    _search('', filters: search.filters, source: 'saved_search');
  }

  Future<void> _onMemoryItemsChanged(Set<String> ids) async {
    if (!mounted) return;
    final account = _accountWatch.capture();
    final revision = ++_memoryRevision;
    setState(() => _enabledMemoryIds = ids);
    try {
      final thread = await _repo.applyChatMemory(ids);
      if (!_sameAccount(account) || revision != _memoryRevision) return;
      setState(() => _thread = thread);
    } catch (_) {
      if (!_sameAccount(account)) return;
    }
  }

  Future<void> _ensureDiscover() async {
    final discover = _discover;
    if (discover == null || _discoverBooted || !mounted) return;
    _discoverBooted = true;
    final account = _accountWatch.capture();
    _discoverAccount = account;
    try {
      await discover.restore();
      if (!_sameAccount(account)) return;
      if (discover.location?.isUsable == true &&
          discover.phase == DiscoverShopPhase.needsLocation) {
        await discover.search(reset: true);
      }
    } catch (_) {
      if (!_sameAccount(account)) return;
    }
  }

  Future<void> _pickLocation() async {
    if (!mounted) return;
    final account = _accountWatch.capture();
    final picked = await DiscoverLocationSheet.show(
      context,
      device: _deviceLocation,
      places: _placeSearch,
    );
    if (picked == null || !_sameAccount(account)) return;
    _discoverAccount = account;
    await _discover?.setLocation(picked);
  }

  Future<void> _pickFilters() async {
    final discover = _discover;
    if (discover == null || !mounted) return;
    final account = _accountWatch.capture();
    final next = await DiscoverFilterSheet.show(
      context,
      initial: discover.filters,
    );
    if (next == null || !_sameAccount(account)) return;
    _discoverAccount = account;
    try {
      discover.setFilters(next);
      await discover.search(query: discover.queryText, reset: true);
    } catch (_) {
      if (!_sameAccount(account)) return;
    }
  }

  void _onHomeChip(String label) {
    if (label == 'Is this a fair price?') {
      _sendMessage(label, source: 'starter');
      return;
    }
    _search(label, source: 'starter');
  }

  void _startNewChat() {
    ProductAnalytics.instance.track(AnalyticsEvents.chatStarted);
    _threadRevision++;
    final fresh = _repo.startNewAskChat();
    setState(() {
      _thread = fresh.isEmpty
          ? fresh
          : ChatThread(
              id: 'chat_${DateTime.now().millisecondsSinceEpoch}',
              mode: ChatMode.ask,
              createdAt: DateTime.now(),
            );
      _isLoading = false;
      _mode = ChatMode.ask;
      _listings = null;
      _enabledMemoryIds = _searchProfile?.items.map((item) => item.id).toSet();
    });
  }

  void _selectChat(ChatThread chat) {
    ProductAnalytics.instance.track(AnalyticsEvents.chatOpened, {
      'mode': chat.mode == ChatMode.ask ? 'ask' : 'shop',
    });
    _threadRevision++;
    setState(() {
      _thread = chat;
      _mode = chat.mode;
      if (chat.mode == ChatMode.shop) {
        _search('', userInitiated: false);
      }
    });
  }

  /// Heart save does not spend a key.
  /// v1.8: Handle heart tap on inventory card
  Future<void> _handleSaveToggle(Listing listing, bool isSaved) async {
    HapticFeedback.lightImpact();
    final account = _accountWatch.capture();

    try {
      if (isSaved) {
        await _repo.unsaveByListingId(listing.id, source: 'shop');
        if (!mounted || !_accountWatch.same(account)) return;
        setState(() {
          _savedListingIds = Set.from(_savedListingIds)..remove(listing.id);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Removed from Saved'),
            duration: Duration(seconds: 2),
          ),
        );
      } else {
        await _repo.saveCar(listing, source: 'shop');
        if (!mounted || !_accountWatch.same(account)) return;
        setState(() {
          _savedListingIds = Set.from(_savedListingIds)..add(listing.id);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Saved for later'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } on StaleAccountException {
      return;
    } on SavedCarsException catch (error) {
      _showStaleAccountError(account, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEmpty = _thread?.isEmpty ?? true;
    final discover = _discover;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          Column(
            children: [
              NavTopBar(
                showNewChat: true,
                onNewChat: _startNewChat,
                repository: _repo,
              ),
              Expanded(child: _homeBody(isEmpty, discover)),
            ],
          ),
          ShopComposerOverlay(
            mode: _mode,
            onSend: _mode == ChatMode.ask
                ? _submitAsk
                : (query) {
                    _search(query);
                    return true;
                  },
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  Widget _homeBody(bool isEmpty, DiscoverShopController? discover) {
    if (_mode == ChatMode.ask && isEmpty) {
      return DiscoverHome(
        cars: _liveDiscover ? (discover?.listings ?? const []) : _nearby,
        loading: _liveDiscover
            ? discover?.phase == DiscoverShopPhase.loading
            : _nearbyLoading,
        savedIds: _savedListingIds,
        onChip: _onHomeChip,
        onOpen: (listing) => context.push('/vdp/${listing.id}'),
        onSave: _handleSaveToggle,
        unavailableTitle: _discoverUnconfigured
            ? 'Live inventory is not configured'
            : null,
        unavailableMessage: _discoverUnconfigured
            ? apiNotConfiguredMessage
            : null,
        locationPrompt:
            _liveDiscover &&
                !_discoverUnconfigured &&
                discover?.phase == DiscoverShopPhase.needsLocation
            ? 'Set a location to see cars near you.'
            : null,
        onLocation: _pickLocation,
        emptyMessage: _liveDiscover && discover?.errorMessage != null
            ? discover!.errorMessage
            : null,
      );
    }
    if (_mode == ChatMode.ask) {
      return ChatMessages(
        thread: _thread!,
        isLoading: _isLoading,
        onShopTap: (query) => _search(query, source: 'ask_handoff'),
        onRetry: _retryAsk,
        onListingTap: (listing) => context.push('/vdp/${listing.id}'),
        memoryItems: _searchProfile?.personalize == true
            ? _searchProfile?.items
            : null,
        enabledMemoryIds: _enabledMemoryIds,
        onMemoryItemsChanged: _onMemoryItemsChanged,
      );
    }
    if (_discoverUnconfigured) {
      return const DiscoverUnavailable(message: apiNotConfiguredMessage);
    }
    if (_liveDiscover) {
      return DiscoverShopPane(
        controller: _discover!,
        onOpen: (listing) => context.push('/vdp/${listing.id}'),
        onLocation: _pickLocation,
        onFilters: _pickFilters,
      );
    }
    return ShopResults(
      listings: _listings,
      isLoading: _isSearching,
      hasCredits: false,
      savedListingIds: _savedListingIds,
      dealsListingIds: _dealsListingIds,
      onSaveToggle: _handleSaveToggle,
      onListingTap: (listing) => context.push('/vdp/${listing.id}'),
    );
  }
}
