import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/analytics/product_analytics.dart';
import 'floating_tab_bar.dart';
import 'canvas_background.dart';
import 'offline_banner.dart';
import '../theme/drevvy_tokens.dart';

/// v1.8: InheritedWidget to share scroll visibility state with child screens.
/// Screens can call HideOnScroll.of(context)?.hide() or .show() to control visibility.
class HideOnScroll extends InheritedWidget {
  const HideOnScroll({
    super.key,
    required super.child,
    required this.isVisible,
    required this.show,
    required this.hide,
    required this.setFromScroll,
  });

  final bool isVisible;
  final VoidCallback show;
  final VoidCallback hide;
  final void Function(double delta) setFromScroll;

  static HideOnScroll? of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<HideOnScroll>();
  }

  @override
  bool updateShouldNotify(HideOnScroll oldWidget) => isVisible != oldWidget.isVisible;
}

/// Shell scaffold per spec §1.1/§6.5a: extendBody true, frosted tab bar pinned at bottom
/// v1.8: Added hide-on-scroll behavior for tab bar.
class ShellScaffold extends StatefulWidget {
  const ShellScaffold({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  @override
  State<ShellScaffold> createState() => _ShellScaffoldState();
}

class _ShellScaffoldState extends State<ShellScaffold> with SingleTickerProviderStateMixin {
  bool _isOffline = false;
  
  /// v1.8: Track whether the tab bar is visible (true) or hidden (false).
  bool _isTabBarVisible = true;
  late final AnimationController _tabBarAnimController;
  late final Animation<Offset> _tabBarOffset;

  @override
  void initState() {
    super.initState();
    _tabBarAnimController = AnimationController(
      vsync: this,
      duration: DrevvyMotion.tabSwitch.duration,
    );
    _tabBarOffset = Tween<Offset>(
      begin: Offset.zero,
      end: const Offset(0, 1.5),
    ).animate(CurvedAnimation(
      parent: _tabBarAnimController,
      curve: DrevvyMotion.tabSwitch.curve,
    ));
  }

  @override
  void dispose() {
    _tabBarAnimController.dispose();
    super.dispose();
  }

  void _simulateOffline() {
    ProductAnalytics.instance.track(AnalyticsEvents.offlineBannerRetried);
    setState(() => _isOffline = !_isOffline);
  }

  void _showTabBar() {
    if (!_isTabBarVisible) {
      setState(() => _isTabBarVisible = true);
      _tabBarAnimController.reverse();
    }
  }

  void _hideTabBar() {
    if (_isTabBarVisible) {
      setState(() => _isTabBarVisible = false);
      _tabBarAnimController.forward();
    }
  }

  void _setFromScroll(double delta) {
    if (delta > 8) {
      _hideTabBar();
    } else if (delta < -8) {
      _showTabBar();
    }
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    
    return HideOnScroll(
      isVisible: _isTabBarVisible,
      show: _showTabBar,
      hide: _hideTabBar,
      setFromScroll: _setFromScroll,
      child: Scaffold(
        extendBody: true,
        body: Stack(
          children: [
            const CanvasBackground(),
            widget.navigationShell,
            Positioned(
              left: DrevvySpace.tabBarSideInset,
              right: DrevvySpace.tabBarSideInset,
              bottom: DrevvySpace.tabBarBottomInset + MediaQuery.of(context).padding.bottom,
              child: SlideTransition(
                position: _tabBarOffset,
                child: FloatingTabBar(
                  currentIndex: widget.navigationShell.currentIndex,
                  onTap: (index) {
                    const tabs = ['shop', 'deals', 'saved'];
                    final reselected = index == widget.navigationShell.currentIndex;
                    ProductAnalytics.instance.track(AnalyticsEvents.tabSelected, {
                      'tab': tabs[index],
                      'reselected': reselected,
                    });
                    ProductAnalytics.instance.recordLocation('/${tabs[index]}');
                    widget.navigationShell.goBranch(
                      index,
                      initialLocation: reselected,
                    );
                  },
                ),
              ),
            ),
            if (_isOffline)
              Positioned(
                top: topPadding + DrevvySpace.s2,
                left: DrevvySpace.gutter,
                right: DrevvySpace.gutter,
                child: OfflineBanner(
                  lastSyncedAt: DateTime.now().subtract(const Duration(minutes: 5)),
                  onRetry: _simulateOffline,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
