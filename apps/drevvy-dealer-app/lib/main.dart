import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'data/demo_desk.dart';
import 'desk_scope.dart';
import 'router.dart';
import 'theme/dealer_theme.dart';

void main() {
  runApp(const DrevvyDeskApp());
}

class DrevvyDeskApp extends StatefulWidget {
  const DrevvyDeskApp({super.key, this.desk});

  final DealerDesk? desk;

  @override
  State<DrevvyDeskApp> createState() => _DrevvyDeskAppState();
}

class _DrevvyDeskAppState extends State<DrevvyDeskApp> {
  late final DealerDesk desk;
  late final GoRouter router;
  late final bool _ownsDesk;

  @override
  void initState() {
    super.initState();
    _ownsDesk = widget.desk == null;
    desk = widget.desk ?? DealerDesk();
    router = buildDeskRouter(desk);
  }

  @override
  void dispose() {
    router.dispose();
    if (_ownsDesk) desk.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DeskScope(
      desk: desk,
      child: MaterialApp.router(
        title: 'Drevvy Desk',
        debugShowCheckedModeBanner: false,
        theme: dealerTheme(),
        routerConfig: router,
      ),
    );
  }
}
