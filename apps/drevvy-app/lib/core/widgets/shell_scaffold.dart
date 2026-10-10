import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'floating_tab_bar.dart';
import 'canvas_background.dart';
import 'offline_banner.dart';
import '../theme/drevvy_tokens.dart';

class ShellScaffold extends StatefulWidget {
  const ShellScaffold({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  @override
  State<ShellScaffold> createState() => _ShellScaffoldState();
}

class _ShellScaffoldState extends State<ShellScaffold> {
  bool _isOffline = false;

  void _simulateOffline() {
    setState(() => _isOffline = !_isOffline);
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    
    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          widget.navigationShell,
          FloatingTabBar(
            currentIndex: widget.navigationShell.currentIndex,
            onTap: (index) {
              widget.navigationShell.goBranch(
                index,
                initialLocation: index == widget.navigationShell.currentIndex,
              );
            },
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
    );
  }
}
