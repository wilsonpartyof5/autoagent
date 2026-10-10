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

/// Screens 07-11, 17: Shop tab with Ask/Shop toggle
class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final _repo = DemoRepository.instance;
  ChatMode _mode = ChatMode.ask;
  ChatThread? _thread;
  List<Listing>? _listings;
  bool _isLoading = false;
  bool _isSearching = false;
  User? _user;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final thread = await _repo.getChatThread();
    final user = await _repo.getCurrentUser();
    setState(() {
      _thread = thread;
      _user = user;
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

  @override
  Widget build(BuildContext context) {
    final isEmpty = _thread?.isEmpty ?? true;

    return Column(
      children: [
        ChatHeader(
          mode: _mode,
          onModeChanged: _switchMode,
          onMenuTap: () {
            // TODO: Open menu
          },
          onComposeTap: () {
            // TODO: New chat
          },
        ),
        
        Expanded(
          child: _mode == ChatMode.ask
              ? isEmpty
                  ? ChatEmpty(
                      userName: _user?.firstName ?? 'there',
                      onPromptTap: (prompt) => _sendMessage(prompt),
                      onShopTap: (query) => _search(query),
                    )
                  : ChatMessages(
                      thread: _thread!,
                      isLoading: _isLoading,
                      onShopTap: (query) => _search(query),
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
        
        ChatComposer(
          mode: _mode,
          onSend: _mode == ChatMode.ask ? _sendMessage : _search,
          isLoading: _isLoading,
        ),
        
        // Space for tab bar
        const SizedBox(height: DrevvySpace.rootScrollBottomPadding - 56),
      ],
    );
  }
}
