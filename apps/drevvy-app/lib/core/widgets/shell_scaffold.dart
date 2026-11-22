import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/analytics/product_analytics.dart';
import '../../data/models/chat.dart';
import '../../data/models/user.dart';
import '../../data/repositories/demo_repository.dart';
import '../../features/shop/widgets/get_more_keys.dart';
import '../navigation/discover_intent.dart';
import '../navigation/drevvy_nav_scope.dart';
import '../theme/drevvy_tokens.dart';
import 'canvas_background.dart';
import 'nav_drawer.dart';
import 'offline_banner.dart';
import 'shop_bottom_chrome.dart';

/// App shell. Discover is the home. Deals, Saves, and Profile open from
/// the top-left drawer. There is no bottom tab bar.
class ShellScaffold extends StatefulWidget {
  const ShellScaffold({
    super.key,
    required this.child,
    required this.location,
    this.onShop = false,
  });

  final Widget child;
  final String location;
  final bool onShop;

  @override
  State<ShellScaffold> createState() => _ShellScaffoldState();
}

class _ShellScaffoldState extends State<ShellScaffold>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  bool _isOffline = false;
  late final ShopBottomChromeModel _shopChrome;
  late final AnimationController _drawerController;
  late final DiscoverIntent _intent;
  bool _drawerOpen = false;
  List<ChatThread> _recent = const [];
  bool _recentReady = false;
  int? _keyCount;
  User? _user;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _shopChrome = ShopBottomChromeModel(vsync: this);
    _drawerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _intent = DiscoverIntent();
    _loadNav();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncShopChromeEnvironment();
  }

  @override
  void didUpdateWidget(covariant ShellScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.onShop == widget.onShop) return;
    if (widget.onShop) {
      _shopChrome.onShopTabShown();
    } else {
      _shopChrome.onShopTabHidden();
    }
  }

  @override
  void didChangeMetrics() {
    _syncShopChromeEnvironment();
  }

  void _syncShopChromeEnvironment() {
    if (!mounted) return;
    final media = MediaQuery.of(context);
    _shopChrome.applyMedia(
      reduceMotion: media.disableAnimations,
      accessibleNavigation: media.accessibleNavigation,
    );
    final view = View.of(context);
    final dpr = view.devicePixelRatio == 0 ? 1.0 : view.devicePixelRatio;
    _shopChrome.setKeyboardInset(view.viewInsets.bottom / dpr);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _shopChrome.dispose();
    _drawerController.dispose();
    _intent.dispose();
    super.dispose();
  }

  Future<void> _loadNav() async {
    final repo = DemoRepository.instance;
    try {
      final user = await repo.getCurrentUser();
      final history = await repo.getChatHistory();
      final balance = await repo.getCreditBalance();
      if (!mounted) return;
      setState(() {
        _user = user;
        _recent = history;
        _keyCount = balance.balance;
        _recentReady = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _recentReady = true);
    }
  }

  void _openDrawer() {
    ProductAnalytics.instance.track(AnalyticsEvents.historyOpened);
    setState(() => _drawerOpen = true);
    final reduce = MediaQuery.disableAnimationsOf(context);
    if (reduce) {
      _drawerController.value = 1;
    } else {
      _drawerController.forward();
    }
    _loadNav();
  }

  void _closeDrawer() {
    final reduce = MediaQuery.disableAnimationsOf(context);
    if (reduce) {
      _drawerController.value = 0;
      setState(() => _drawerOpen = false);
      return;
    }
    _drawerController.reverse().whenComplete(() {
      if (mounted) setState(() => _drawerOpen = false);
    });
  }

  void _go(String path) {
    _closeDrawer();
    if (widget.location == path) return;
    context.go(path);
  }

  void _openRecent(ChatThread chat) {
    _closeDrawer();
    _intent.pendingChat = chat;
    if (navPathIsDiscover(widget.location)) {
      _intent.present(chat);
      return;
    }
    context.go('/discover');
  }

  Future<void> _openKeys() async {
    _closeDrawer();
    await showGetMoreKeys(context);
    await _loadNav();
  }

  void _simulateOffline() {
    ProductAnalytics.instance.track(AnalyticsEvents.offlineBannerRetried);
    setState(() => _isOffline = !_isOffline);
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.paddingOf(context).top;
    final reduce = MediaQuery.disableAnimationsOf(context);
    final size = MediaQuery.sizeOf(context);
    final width = navDrawerWidth(size);
    final showDrawer = _drawerOpen || _drawerController.value > 0;
    final selected = navDestinationFor(widget.location);

    return ShopBottomChromeScope(
      model: _shopChrome,
      child: DrevvyNavScope(
        intent: _intent,
        openDrawer: _openDrawer,
        closeDrawer: _closeDrawer,
        drawerOpen: _drawerOpen,
        child: PopScope(
          canPop: !_drawerOpen,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop && _drawerOpen) _closeDrawer();
          },
          child: Scaffold(
            body: Stack(
              children: [
                const CanvasBackground(),
                widget.child,
                if (showDrawer) ...[
                  Positioned.fill(
                    child: Semantics(
                      label: 'Close menu',
                      button: true,
                      child: GestureDetector(
                        key: const Key('nav-scrim'),
                        onTap: _closeDrawer,
                        child: const ColoredBox(color: Color(0x7514172B)),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: width,
                    child: AnimatedBuilder(
                      animation: _drawerController,
                      builder: (context, child) {
                        final t = reduce
                            ? (_drawerOpen ? 1.0 : 0.0)
                            : _drawerController.value;
                        return Transform.translate(
                          offset: Offset(reduce ? 0 : -width * (1 - t), 0),
                          child: Opacity(
                            opacity: reduce ? (_drawerOpen ? 1 : 0) : 1,
                            child: child,
                          ),
                        );
                      },
                      child: ClipRRect(
                        borderRadius: const BorderRadius.horizontal(
                          right: Radius.circular(28),
                        ),
                        child: GestureDetector(
                          key: const Key('nav-drawer'),
                          onHorizontalDragEnd: (details) {
                            final velocity = details.primaryVelocity ?? 0;
                            if (velocity < -200) _closeDrawer();
                          },
                          child: DrevvyNavDrawer(
                            selected: selected,
                            recent: _recent,
                            recentReady: _recentReady,
                            keyCount: _keyCount,
                            user: _user,
                            onDiscover: () => _go('/discover'),
                            onDeals: () => _go('/deals'),
                            onSaves: () => _go('/saves'),
                            onRecent: _openRecent,
                            onKeys: () => _openKeys(),
                            onProfile: () => _go('/profile'),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                if (_isOffline)
                  Positioned(
                    top: topPadding + DrevvySpace.s2,
                    left: DrevvySpace.gutter,
                    right: DrevvySpace.gutter,
                    child: OfflineBanner(
                      lastSyncedAt: DateTime.now().subtract(
                        const Duration(minutes: 5),
                      ),
                      onRetry: _simulateOffline,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
