import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'floating_tab_bar.dart';
import 'canvas_background.dart';

class ShellScaffold extends StatelessWidget {
  const ShellScaffold({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          navigationShell,
          FloatingTabBar(
            currentIndex: navigationShell.currentIndex,
            onTap: (index) {
              navigationShell.goBranch(
                index,
                initialLocation: index == navigationShell.currentIndex,
              );
            },
          ),
        ],
      ),
    );
  }
}
