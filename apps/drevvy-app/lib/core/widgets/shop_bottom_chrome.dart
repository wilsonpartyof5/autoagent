import 'package:flutter/material.dart';

import '../theme/drevvy_tokens.dart';

/// Which piece of the Shop bottom chrome a transform applies to.
enum ShopChromePart { pill, tabs }

/// Committed visibility. Scroll never tracks the finger 1:1.
enum ShopChromePhase { shown, hidden, searchFocused }

enum ShopChromeScrollDecision { none, show, hide }

/// Distances and timings for the Shop search pill + tab bar unit.
abstract final class ShopBottomChromeMetrics {
  /// Router branch index of the Shop tab in [router.dart].
  static const shopBranchIndex = 0;

  static const pillKey = Key('shop-bottom-chrome-pill');
  static const tabsKey = Key('shop-bottom-chrome-tabs');
  static const listKey = Key('shop-results-list');

  static const hideDragPx = 24.0;
  static const showDragPx = 16.0;
  static const minDeltaPx = 2.0;
  static const topLockPx = 56.0;
  static const listClearancePx = 16.0;

  static const hideDuration = Duration(milliseconds: 200);
  static const showDuration = Duration(milliseconds: 220);
  static const reducedDuration = Duration(milliseconds: 120);

  /// Pill, the gap above the tab bar, the tab bar, and its bottom inset.
  /// The safe area is added separately so the hidden unit clears the home indicator.
  static const chromeHeight =
      DrevvySpace.composerMinHeight +
      DrevvySpace.composerTabBarGap +
      DrevvySpace.tabBarHeight +
      DrevvySpace.tabBarBottomInset;

  static double travel(double safeBottom) => chromeHeight + safeBottom;

  /// Constant list padding so the last card clears the visible chrome.
  static double listBottomPadding(double safeBottom) =>
      travel(safeBottom) + listClearancePx;

  static double restingComposerBottom(double safeBottom) =>
      DrevvySpace.tabBarBottomInset +
      DrevvySpace.tabBarHeight +
      DrevvySpace.composerTabBarGap +
      safeBottom;
}

/// Accumulates user scroll and commits show/hide. Pure: no widgets.
class ShopChromeScrollTracker {
  double _accum = 0;

  void reset() => _accum = 0;

  ShopChromeScrollDecision consume({
    required double delta,
    required double pixels,
    required double minScrollExtent,
    required double maxScrollExtent,
    required bool programmatic,
    required bool currentlyVisible,
  }) {
    if (programmatic) {
      _accum = 0;
      return ShopChromeScrollDecision.show;
    }

    final atTop = pixels <= 0 || pixels <= minScrollExtent;
    final atBottom = maxScrollExtent > 0 && pixels >= maxScrollExtent - 0.5;
    if (atTop || atBottom) {
      _accum = 0;
      return ShopChromeScrollDecision.show;
    }

    // Overscroll bounce / glow that isn't an end rule: keep the current state.
    if (pixels < minScrollExtent || pixels > maxScrollExtent) {
      return ShopChromeScrollDecision.none;
    }

    if (delta.abs() < ShopBottomChromeMetrics.minDeltaPx) {
      return ShopChromeScrollDecision.none;
    }

    if (delta > 0) {
      if (_accum < 0) _accum = 0;
      _accum += delta;
      if (!currentlyVisible || pixels < ShopBottomChromeMetrics.topLockPx) {
        return ShopChromeScrollDecision.none;
      }
      if (_accum >= ShopBottomChromeMetrics.hideDragPx) {
        _accum = 0;
        return ShopChromeScrollDecision.hide;
      }
    } else {
      if (_accum > 0) _accum = 0;
      _accum += delta;
      if (currentlyVisible) return ShopChromeScrollDecision.none;
      if (_accum <= -ShopBottomChromeMetrics.showDragPx) {
        _accum = 0;
        return ShopChromeScrollDecision.show;
      }
    }
    return ShopChromeScrollDecision.none;
  }
}

/// Drives the Shop pill and tab bar as one slide.
///
/// Deals and Saved keep the shell's older tab-bar animation. This model is
/// only consulted while the Shop branch is visible.
class ShopBottomChromeModel extends ChangeNotifier {
  ShopBottomChromeModel({required TickerProvider vsync})
    : _controller = AnimationController(
        vsync: vsync,
        duration: ShopBottomChromeMetrics.hideDuration,
        reverseDuration: ShopBottomChromeMetrics.showDuration,
      );

  final AnimationController _controller;
  final ShopChromeScrollTracker _tracker = ShopChromeScrollTracker();

  ShopChromePhase phase = ShopChromePhase.shown;
  double keyboardInset = 0;

  bool _reduceMotion = false;
  bool _accessibleNavigation = false;

  /// True while the current scroll session started from a pointer drag.
  /// A finger fling stays user-driven through its ballistic phase. animateTo
  /// and jumpTo start with no drag details and count as programmatic.
  bool _pointerScroll = false;

  bool get reduceMotion => _reduceMotion;
  bool get accessibleNavigation => _accessibleNavigation;

  /// Linear 0 (shown) → 1 (hidden). Motion widgets listen to this.
  Animation<double> get motion => _controller;

  double get visualProgress {
    final t = _controller.value.clamp(0.0, 1.0);
    if (_controller.status == AnimationStatus.reverse) {
      final showProgress = 1 - t;
      return 1 - Curves.easeOutCubic.transform(showProgress);
    }
    return Curves.easeOutCubic.transform(t);
  }

  void applyMedia({
    required bool reduceMotion,
    required bool accessibleNavigation,
  }) {
    final changed =
        _reduceMotion != reduceMotion ||
        _accessibleNavigation != accessibleNavigation;
    _reduceMotion = reduceMotion;
    _accessibleNavigation = accessibleNavigation;
    if (_accessibleNavigation && phase == ShopChromePhase.hidden) {
      _tracker.reset();
      phase = ShopChromePhase.shown;
      _controller.value = 0;
      notifyListeners();
      return;
    }
    if (changed) notifyListeners();
  }

  void setKeyboardInset(double inset) {
    if ((keyboardInset - inset).abs() < 0.5) return;
    keyboardInset = inset;
    if (phase == ShopChromePhase.searchFocused) {
      _syncKeyboardTabs();
    }
    notifyListeners();
  }

  /// Search field focused on the Shop results composer.
  ///
  /// The pill stays put. The tab bar hides only while the keyboard is open,
  /// which is what docks the pill on the keyboard instead of leaving a gap.
  void setSearchFocused(bool focused) {
    if (focused) {
      if (_accessibleNavigation) {
        if (phase == ShopChromePhase.hidden) {
          show(force: true, animate: false);
        }
        return;
      }
      if (phase != ShopChromePhase.searchFocused) {
        _tracker.reset();
        phase = ShopChromePhase.searchFocused;
        notifyListeners();
      }
      _syncKeyboardTabs();
      return;
    }
    if (phase != ShopChromePhase.searchFocused) return;
    _tracker.reset();
    phase = ShopChromePhase.shown;
    notifyListeners();
    _moveToward(0);
  }

  void show({bool animate = true, bool force = false}) {
    if (!force && phase == ShopChromePhase.searchFocused) {
      _tracker.reset();
      return;
    }
    _tracker.reset();
    final changed = phase != ShopChromePhase.shown;
    phase = ShopChromePhase.shown;
    if (changed) notifyListeners();
    if (!animate) {
      _controller.value = 0;
      return;
    }
    _moveToward(0);
  }

  void hide() {
    if (_accessibleNavigation || phase == ShopChromePhase.searchFocused) return;
    _tracker.reset();
    final changed = phase != ShopChromePhase.hidden;
    phase = ShopChromePhase.hidden;
    if (changed) notifyListeners();
    _moveToward(1);
  }

  /// Shop branch became visible again. Chrome is shown; Deals/Saved state is untouched.
  void onShopTabShown() => _snapShown();

  /// Shop branch went offstage. Reset the offstage pill so it doesn't return mid-slide.
  void onShopTabHidden() => _snapShown();

  void handleScroll({
    required ScrollNotification notification,
    required bool accessibleNavigation,
    required bool reduceMotion,
  }) {
    _reduceMotion = reduceMotion;
    _accessibleNavigation = accessibleNavigation;
    if (notification is ScrollStartNotification) {
      _pointerScroll = notification.dragDetails != null;
    }
    if (accessibleNavigation) {
      if (phase == ShopChromePhase.hidden) {
        show(force: true, animate: false);
      }
      return;
    }
    if (phase == ShopChromePhase.searchFocused) return;
    if (notification.metrics.axis != Axis.vertical) return;

    if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta;
      if (delta == null) return;
      final decision = _tracker.consume(
        delta: delta,
        pixels: notification.metrics.pixels,
        minScrollExtent: notification.metrics.minScrollExtent,
        maxScrollExtent: notification.metrics.maxScrollExtent,
        programmatic: _isProgrammatic(notification),
        currentlyVisible: phase != ShopChromePhase.hidden,
      );
      _apply(decision);
      return;
    }

    if (notification is OverscrollNotification ||
        notification is ScrollEndNotification) {
      final metrics = notification.metrics;
      final atTop =
          metrics.pixels <= 0 || metrics.pixels <= metrics.minScrollExtent;
      final atBottom =
          metrics.maxScrollExtent > 0 &&
          metrics.pixels >= metrics.maxScrollExtent - 0.5;
      final overscrollAtEnd =
          notification is OverscrollNotification &&
          ((notification.overscroll < 0 && atTop) ||
              (notification.overscroll > 0 &&
                  metrics.pixels >= metrics.maxScrollExtent - 1));
      if (atTop || atBottom || overscrollAtEnd) {
        _tracker.reset();
        show();
      }
      if (notification is ScrollEndNotification) _pointerScroll = false;
    }
  }

  double composerBottom(double safeBottom) {
    final dock =
        phase == ShopChromePhase.searchFocused &&
        keyboardInset > 0 &&
        !_accessibleNavigation;
    if (dock) return DrevvySpace.composerTabBarGap;
    return ShopBottomChromeMetrics.restingComposerBottom(safeBottom);
  }

  double translationFor(
    ShopChromePart part,
    double travel, {
    required bool accessibleNavigation,
    required bool reduceMotion,
  }) {
    if (accessibleNavigation) return 0;
    if (phase == ShopChromePhase.searchFocused && part == ShopChromePart.pill) {
      return 0;
    }
    if (phase == ShopChromePhase.searchFocused &&
        part == ShopChromePart.tabs &&
        keyboardInset <= 0) {
      return 0;
    }
    if (reduceMotion) {
      final hiding = _partWantsHidden(part);
      if (!hiding || _controller.status != AnimationStatus.completed) return 0;
      return travel;
    }
    return travel * visualProgress;
  }

  double opacityFor(
    ShopChromePart part, {
    required bool accessibleNavigation,
    required bool reduceMotion,
  }) {
    if (accessibleNavigation) return 1;
    if (phase == ShopChromePhase.searchFocused && part == ShopChromePart.pill) {
      return 1;
    }
    if (phase == ShopChromePhase.searchFocused &&
        part == ShopChromePart.tabs &&
        keyboardInset <= 0) {
      return 1;
    }
    if (reduceMotion) {
      return (1 - _controller.value).clamp(0.0, 1.0);
    }
    final t = visualProgress;
    if (t <= 0.7) return 1;
    return (1 - (t - 0.7) / 0.3).clamp(0.0, 1.0);
  }

  bool hidesPointer(ShopChromePart part, {required bool accessibleNavigation}) {
    if (accessibleNavigation) return false;
    return _partWantsHidden(part);
  }

  void revealFromFocus() {
    if (_accessibleNavigation) return;
    if (phase == ShopChromePhase.hidden ||
        phase == ShopChromePhase.searchFocused) {
      show(force: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _partWantsHidden(ShopChromePart part) {
    if (phase == ShopChromePhase.hidden) return true;
    return phase == ShopChromePhase.searchFocused &&
        part == ShopChromePart.tabs &&
        keyboardInset > 0;
  }

  void _apply(ShopChromeScrollDecision decision) {
    switch (decision) {
      case ShopChromeScrollDecision.none:
        return;
      case ShopChromeScrollDecision.show:
        show();
      case ShopChromeScrollDecision.hide:
        hide();
    }
  }

  void _snapShown() {
    _tracker.reset();
    phase = ShopChromePhase.shown;
    _controller.value = 0;
    notifyListeners();
  }

  void _syncKeyboardTabs() {
    if (phase != ShopChromePhase.searchFocused || _accessibleNavigation) {
      _moveToward(0);
      return;
    }
    _moveToward(keyboardInset > 0 ? 1 : 0);
  }

  void _moveToward(double target) {
    _prepareDurations();
    if (target >= 1) {
      if (_controller.value == 1 && !_controller.isAnimating) return;
      _controller.forward();
      return;
    }
    if (_controller.value == 0 && !_controller.isAnimating) return;
    _controller.reverse();
  }

  void _prepareDurations() {
    if (_reduceMotion) {
      _controller.duration = ShopBottomChromeMetrics.reducedDuration;
      _controller.reverseDuration = ShopBottomChromeMetrics.reducedDuration;
    } else {
      _controller.duration = ShopBottomChromeMetrics.hideDuration;
      _controller.reverseDuration = ShopBottomChromeMetrics.showDuration;
    }
  }

  bool _isProgrammatic(ScrollUpdateNotification notification) {
    if (notification.dragDetails != null) return false;
    return !_pointerScroll;
  }
}

class ShopBottomChromeScope extends InheritedNotifier<ShopBottomChromeModel> {
  const ShopBottomChromeScope({
    super.key,
    required ShopBottomChromeModel model,
    required super.child,
  }) : super(notifier: model);

  /// Subscribes the caller. Use from build methods only.
  static ShopBottomChromeModel? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<ShopBottomChromeScope>()
        ?.notifier;
  }

  /// Does not subscribe. Use from scroll and focus callbacks.
  static ShopBottomChromeModel? read(BuildContext context) {
    return context
        .getInheritedWidgetOfExactType<ShopBottomChromeScope>()
        ?.notifier;
  }
}

/// Slides or crossfades one chrome piece. Pill and tabs share [ShopBottomChromeModel.motion].
class ShopChromeMotion extends StatefulWidget {
  const ShopChromeMotion({
    super.key,
    required this.part,
    required this.child,
    this.lockOnFocus = false,
  });

  final ShopChromePart part;
  final Widget child;

  /// When true, focus inside this subtree locks the search pill on screen.
  final bool lockOnFocus;

  @override
  State<ShopChromeMotion> createState() => _ShopChromeMotionState();
}

class _ShopChromeMotionState extends State<ShopChromeMotion> {
  @override
  void initState() {
    super.initState();
    FocusManager.instance.addListener(_handleFocus);
  }

  @override
  void didUpdateWidget(covariant ShopChromeMotion oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.part != ShopChromePart.pill) return;
    final model = ShopBottomChromeScope.read(context);
    if (model == null) return;
    if (oldWidget.lockOnFocus && !widget.lockOnFocus) {
      model.setSearchFocused(false);
    } else if (!oldWidget.lockOnFocus &&
        widget.lockOnFocus &&
        _subtreeHasPrimaryFocus()) {
      model.setSearchFocused(true);
    }
  }

  @override
  void dispose() {
    FocusManager.instance.removeListener(_handleFocus);
    super.dispose();
  }

  void _handleFocus() {
    if (!mounted) return;
    final model = ShopBottomChromeScope.read(context);
    if (model == null) return;
    final focused = _subtreeHasPrimaryFocus();
    if (widget.part == ShopChromePart.pill) {
      if (!widget.lockOnFocus) return;
      model.setSearchFocused(focused);
      return;
    }
    if (focused) model.revealFromFocus();
  }

  bool _subtreeHasPrimaryFocus() {
    final focusContext = FocusManager.instance.primaryFocus?.context;
    if (focusContext == null || !focusContext.mounted) return false;
    var found = false;
    focusContext.visitAncestorElements((element) {
      if (element == context) {
        found = true;
        return false;
      }
      return true;
    });
    return found;
  }

  @override
  Widget build(BuildContext context) {
    final model = ShopBottomChromeScope.maybeOf(context);
    if (model == null) return widget.child;
    final media = MediaQuery.of(context);
    return AnimatedBuilder(
      animation: Listenable.merge([model, model.motion]),
      builder: (context, child) {
        final travel = ShopBottomChromeMetrics.travel(media.padding.bottom);
        final dy = model.translationFor(
          widget.part,
          travel,
          accessibleNavigation: media.accessibleNavigation,
          reduceMotion: media.disableAnimations,
        );
        final opacity = model.opacityFor(
          widget.part,
          accessibleNavigation: media.accessibleNavigation,
          reduceMotion: media.disableAnimations,
        );
        final ignore = model.hidesPointer(
          widget.part,
          accessibleNavigation: media.accessibleNavigation,
        );
        return Transform.translate(
          offset: Offset(0, dy),
          child: Opacity(
            opacity: opacity,
            child: ExcludeSemantics(
              excluding: ignore,
              child: IgnorePointer(ignoring: ignore, child: child),
            ),
          ),
        );
      },
      child: widget.child,
    );
  }
}

/// Forwards the Shop list's scroll notifications into [ShopBottomChromeModel].
class ShopChromeScrollListener extends StatelessWidget {
  const ShopChromeScrollListener({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.depth != 0) return false;
        final model = ShopBottomChromeScope.read(context);
        if (model == null) return false;
        final media = MediaQuery.of(context);
        model.handleScroll(
          notification: notification,
          accessibleNavigation: media.accessibleNavigation,
          reduceMotion: media.disableAnimations,
        );
        return false;
      },
      child: child,
    );
  }
}
