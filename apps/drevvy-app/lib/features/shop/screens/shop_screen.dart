import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/chat_header.dart';
import '../widgets/chat_empty.dart';
import '../widgets/chat_messages.dart';
import '../widgets/chat_composer.dart';
import '../widgets/shop_results.dart';
import '../widgets/chat_history_drawer.dart';
import '../widgets/account_sheet.dart';
import '../../account/widgets/recent_searches_sheet.dart';

/// Screens 07-11, 17, 51-52: Shop tab with Ask/Shop toggle and history drawer (v1.6.1)
/// v1.8: Added save/heart support on inventory cards.
/// App always launches here on a new, unsaved Ask chat per spec §1.1
class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final _repo = DemoRepository.instance;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  ChatMode _mode = ChatMode.ask;
  ChatThread? _thread;
  List<ChatThread> _chatHistory = [];
  List<Listing>? _listings;
  bool _isLoading = false;
  bool _isSearching = false;
  User? _user;
  List<StarterCard>? _starters;
  SearchProfile? _searchProfile;
  Set<String>? _enabledMemoryIds;
  int _memoryRevision = 0;

  /// v1.8: Track saved and deals listing IDs
  Set<String> _savedListingIds = {};
  Set<String> _dealsListingIds = {};

  @override
  void initState() {
    super.initState();
    _repo.onSavedSearchRun = _handleSavedSearchRun;
    _loadData();
  }

  @override
  void dispose() {
    if (identical(_repo.onSavedSearchRun, _handleSavedSearchRun)) {
      _repo.onSavedSearchRun = null;
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    final thread = await _repo.getChatThread();
    final user = await _repo.getCurrentUser();
    final history = await _repo.getChatHistory();
    final starters = await _repo.getStarters();
    final searchProfile = await _repo.getSearchProfile();

    // v1.8: Load saved and deals listing IDs for heart state
    final savedCars = await _repo.getSavedCars();
    final deals = await _repo.getDeals();
    if (!mounted) return;

    setState(() {
      _thread = thread;
      _user = user;
      _chatHistory = history;
      _starters = starters;
      _searchProfile = searchProfile;
      _enabledMemoryIds = searchProfile.items.map((item) => item.id).toSet();
      _savedListingIds = savedCars.map((sc) => sc.listingId).toSet();
      _dealsListingIds = deals.map((d) => d.listingId).toSet();
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.isEmpty) return;

    setState(() => _isLoading = true);

    final thread = await _repo.sendMessage(
      text,
      enabledMemoryIds: _enabledMemoryIds,
    );
    if (!mounted) return;

    setState(() {
      _thread = thread;
      _isLoading = false;
    });
  }

  Future<void> _search(String query, {SearchFilters? filters}) async {
    setState(() {
      _mode = ChatMode.shop;
      _isSearching = true;
    });

    final listings = await _repo.searchListings(query: query, filters: filters);
    if (!mounted) return;

    setState(() {
      _listings = listings;
      _isSearching = false;
    });
  }

  void _handleSavedSearchRun(SavedSearch search) {
    _search('', filters: search.filters);
  }

  Future<void> _onMemoryItemsChanged(Set<String> ids) async {
    final revision = ++_memoryRevision;
    setState(() => _enabledMemoryIds = ids);
    final thread = await _repo.applyChatMemory(ids);
    if (!mounted || revision != _memoryRevision) return;
    setState(() => _thread = thread);
  }

  Future<void> _reloadSearchProfile() async {
    final profile = await _repo.getSearchProfile();
    final starters = await _repo.getStarters();
    if (!mounted) return;
    setState(() {
      final previousIds =
          _searchProfile?.items.map((item) => item.id).toSet() ?? {};
      final nextIds = profile.items.map((item) => item.id).toSet();
      final enabled = _enabledMemoryIds ?? previousIds;
      _enabledMemoryIds = {
        ...enabled.where(nextIds.contains),
        ...nextIds.where((id) => !previousIds.contains(id)),
      };
      _searchProfile = profile;
      _starters = starters;
    });
  }

  Future<void> _openRecentSearches() async {
    final searches = List<SavedSearch>.from(
      _searchProfile?.searches ?? const [],
    );
    await RecentSearchesSheet.show(
      context,
      searches: searches,
      onRun: (search) {
        _repo.markSavedSearchRun(search.id);
      },
      onDelete: (search) {
        _repo.deleteSavedSearch(search.id);
      },
      onRestore: (search, index) {
        _repo.restoreSavedSearch(search, index);
      },
      onClearAll: _repo.clearSavedSearches,
    );
    if (!mounted) return;
    await _reloadSearchProfile();
  }

  void _switchMode(ChatMode mode) {
    setState(() => _mode = mode);
    if (mode == ChatMode.shop && _listings == null) {
      _search('');
    }
  }

  void _openHistoryDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  void _startNewChat() {
    setState(() {
      _thread = ChatThread(
        id: 'chat_${DateTime.now().millisecondsSinceEpoch}',
        mode: ChatMode.ask,
        createdAt: DateTime.now(),
      );
      _mode = ChatMode.ask;
      _listings = null;
      _enabledMemoryIds = _searchProfile?.items.map((item) => item.id).toSet();
    });
  }

  void _selectChat(ChatThread chat) {
    setState(() {
      _thread = chat;
      _mode = chat.mode;
      if (chat.mode == ChatMode.shop) {
        _search('');
      }
    });
  }

  void _deleteChat(String chatId) {
    setState(() {
      _chatHistory = _chatHistory.where((c) => c.id != chatId).toList();
      if (_thread?.id == chatId) {
        _startNewChat();
      }
    });
  }

  /// v1.8: Handle heart tap on inventory card
  Future<void> _handleSaveToggle(Listing listing, bool isSaved) async {
    HapticFeedback.lightImpact();

    if (isSaved) {
      // Unsave the car
      await _repo.unsaveByListingId(listing.id);
      if (!mounted) return;
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
      // Save the car
      await _repo.saveCar(listing);
      if (!mounted) return;
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
  }

  void _renameChat(String chatId, String newTitle) {
    setState(() {
      _chatHistory = _chatHistory.map((c) {
        if (c.id == chatId) {
          return c.copyWith(title: newTitle);
        }
        return c;
      }).toList();
      if (_thread?.id == chatId) {
        _thread = _thread?.copyWith(title: newTitle);
      }
    });
  }

  /// v1.8: Show Account sheet
  Future<void> _showAccountSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const AccountSheet(),
    );
    if (!mounted) return;
    await _reloadSearchProfile();
  }

  @override
  Widget build(BuildContext context) {
    final isEmpty = _thread?.isEmpty ?? true;
    final safeBottom = MediaQuery.of(context).padding.bottom;

    // Composer pinned 12pt above tab bar per spec §6.5a
    final composerBottom =
        DrevvySpace.tabBarBottomInset +
        DrevvySpace.tabBarHeight +
        DrevvySpace.composerTabBarGap +
        safeBottom;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.transparent,
      drawer: ChatHistoryDrawer(
        chats: _chatHistory,
        currentChatId: _thread?.id,
        onNewChat: _startNewChat,
        onSelectChat: _selectChat,
        onDeleteChat: _deleteChat,
        onRenameChat: _renameChat,
        onRecentSearches: () {
          _openRecentSearches();
        },
        recentSearchCount: _searchProfile?.searches.length,
      ),
      body: Stack(
        children: [
          Column(
            children: [
              ChatHeader(
                mode: _mode,
                onModeChanged: _switchMode,
                onMenuTap: _openHistoryDrawer,
                onAvatarTap: () {
                  _showAccountSheet();
                },
              ),

              Expanded(
                child: _mode == ChatMode.ask
                    ? isEmpty
                          ? ChatEmpty(
                              userName: _user?.firstName ?? 'there',
                              onPromptTap: (prompt) => _sendMessage(prompt),
                              onShopTap: (query) => _search(query),
                              starters: _starters,
                              hasHistory:
                                  _searchProfile?.personalize == true &&
                                  (_searchProfile?.searches.isNotEmpty ==
                                          true ||
                                      _searchProfile?.items.isNotEmpty == true),
                            )
                          : ChatMessages(
                              thread: _thread!,
                              isLoading: _isLoading,
                              onShopTap: (query) => _search(query),
                              memoryItems: _searchProfile?.personalize == true
                                  ? _searchProfile?.items
                                  : null,
                              enabledMemoryIds: _enabledMemoryIds,
                              onMemoryItemsChanged: _onMemoryItemsChanged,
                            )
                    : ShopResults(
                        listings: _listings,
                        isLoading: _isSearching,
                        // v1.7: hasCredits for future A/B testing (always false for now)
                        hasCredits: false,
                        savedListingIds: _savedListingIds,
                        dealsListingIds: _dealsListingIds,
                        onSaveToggle: _handleSaveToggle,
                        onListingTap: (listing) {
                          context.push('/vdp/${listing.id}');
                        },
                      ),
              ),
            ],
          ),

          // Composer pinned 12pt above tab bar, never overlapping content
          Positioned(
            left: DrevvySpace.gutter,
            right: DrevvySpace.gutter,
            bottom: composerBottom,
            child: ChatComposer(
              mode: _mode,
              onSend: _mode == ChatMode.ask ? _sendMessage : _search,
              isLoading: _isLoading,
            ),
          ),
        ],
      ),
    );
  }
}
