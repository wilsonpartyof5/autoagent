import 'package:flutter/material.dart';
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

/// Screens 07-11, 17, 51-52: Shop tab with Ask/Shop toggle and history drawer (v1.6.1)
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

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final thread = await _repo.getChatThread();
    final user = await _repo.getCurrentUser();
    final history = await _repo.getChatHistory();
    final starters = await _repo.getStarters();
    final searchProfile = await _repo.getSearchProfile();
    setState(() {
      _thread = thread;
      _user = user;
      _chatHistory = history;
      _starters = starters;
      _searchProfile = searchProfile;
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.isEmpty) return;
    
    setState(() => _isLoading = true);
    
    final thread = await _repo.sendMessage(text);
    
    setState(() {
      _thread = thread;
      _isLoading = false;
    });
  }

  Future<void> _search(String query) async {
    setState(() {
      _mode = ChatMode.shop;
      _isSearching = true;
    });
    
    final listings = await _repo.searchListings(query: query);
    
    setState(() {
      _listings = listings;
      _isSearching = false;
    });
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

  @override
  Widget build(BuildContext context) {
    final isEmpty = _thread?.isEmpty ?? true;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

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
      ),
      body: Stack(
        children: [
          Column(
            children: [
              ChatHeader(
                mode: _mode,
                onModeChanged: _switchMode,
                onMenuTap: _openHistoryDrawer,
              ),
              
              Expanded(
                child: _mode == ChatMode.ask
                    ? isEmpty
                        ? ChatEmpty(
                            userName: _user?.firstName ?? 'there',
                            onPromptTap: (prompt) => _sendMessage(prompt),
                            onShopTap: (query) => _search(query),
                            starters: _starters,
                            hasHistory: _searchProfile?.personalize == true && 
                                       (_searchProfile?.searches.isNotEmpty == true ||
                                        _searchProfile?.items.isNotEmpty == true),
                          )
                        : ChatMessages(
                            thread: _thread!,
                            isLoading: _isLoading,
                            onShopTap: (query) => _search(query),
                            memoryItems: _searchProfile?.items,
                          )
                    : ShopResults(
                        listings: _listings,
                        isLoading: _isSearching,
                        isPro: _user?.isPro ?? false,
                        onListingTap: (listing) {
                          context.push('/vdp/${listing.id}');
                        },
                      ),
              ),
            ],
          ),
          
          // Floating composer: 12pt above the floating tab bar per §6.5a
          // Tab bar: bottom = tabBarBottomInset (24) + safe area
          // Composer: bottom = tabBarBottomInset + tabBarHeight (64) + 12pt gap
          Positioned(
            left: DrevvySpace.gutter,
            right: DrevvySpace.gutter,
            bottom: DrevvySpace.tabBarBottomInset + DrevvySpace.tabBarHeight + 12 + bottomPadding,
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
