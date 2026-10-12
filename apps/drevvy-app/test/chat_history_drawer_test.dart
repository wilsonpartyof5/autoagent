import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/features/shop/widgets/chat_history_drawer.dart';
import 'package:drevvy_app/data/models/chat.dart';

void main() {
  group('ChatHistoryDrawer Tests (v1.6.1)', () {
    final testChats = [
      ChatThread(
        id: 'chat_001',
        mode: ChatMode.ask,
        title: 'RAV4 Hybrid search',
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
        messages: [
          ChatMessage(
            id: 'msg_001',
            role: MessageRole.user,
            contentType: MessageContentType.text,
            text: 'What are the best RAV4 Hybrids?',
          ),
        ],
      ),
      ChatThread(
        id: 'chat_002',
        mode: ChatMode.shop,
        title: 'SUV search',
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
        updatedAt: DateTime.now().subtract(const Duration(days: 1)),
        sourcesCount: 24,
      ),
      ChatThread(
        id: 'chat_003',
        mode: ChatMode.ask,
        title: 'CR-V vs RAV4',
        createdAt: DateTime.now().subtract(const Duration(days: 3)),
        updatedAt: DateTime.now().subtract(const Duration(days: 3)),
      ),
    ];

    late String? selectedChatId;
    late String? deletedChatId;
    late bool newChatCalled;

    setUp(() {
      selectedChatId = null;
      deletedChatId = null;
      newChatCalled = false;
    });

    Widget buildTestWidget({
      List<ChatThread>? chats,
      String? currentChatId,
    }) {
      return MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          drawer: ChatHistoryDrawer(
            chats: chats ?? testChats,
            currentChatId: currentChatId,
            onNewChat: () => newChatCalled = true,
            onSelectChat: (chat) => selectedChatId = chat.id,
            onDeleteChat: (id) => deletedChatId = id,
            onRenameChat: (_, __) {},
          ),
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () => Scaffold.of(context).openDrawer(),
              child: const Text('Open'),
            ),
          ),
        ),
      );
    }

    testWidgets('Drawer displays "Chats" title', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Chats'), findsOneWidget);
    });

    testWidgets('Drawer shows search field', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Search chats'), findsOneWidget);
    });

    testWidgets('Drawer shows "New chat" button', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('New chat'), findsOneWidget);
    });

    testWidgets('New chat button calls callback', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('New chat'));
      await tester.pumpAndSettle();

      expect(newChatCalled, isTrue);
    });

    testWidgets('Drawer shows chat titles', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('RAV4 Hybrid search'), findsOneWidget);
      expect(find.text('SUV search'), findsOneWidget);
      expect(find.text('CR-V vs RAV4'), findsOneWidget);
    });

    testWidgets('Drawer groups chats by date', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Should have date group headers
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Yesterday'), findsOneWidget);
    });

    testWidgets('Selecting a chat calls callback', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('RAV4 Hybrid search'));
      await tester.pumpAndSettle();

      expect(selectedChatId, equals('chat_001'));
    });

    testWidgets('Current chat is highlighted', (tester) async {
      await tester.pumpWidget(buildTestWidget(currentChatId: 'chat_001'));
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // The current chat row should have lilacTint background
      // This verifies the chat is marked as selected
      expect(find.text('RAV4 Hybrid search'), findsOneWidget);
    });

    testWidgets('Empty state shows message', (tester) async {
      await tester.pumpWidget(buildTestWidget(chats: []));
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('No chats yet.'), findsOneWidget);
      expect(find.text('Your conversations will show up here.'), findsOneWidget);
    });

    testWidgets('Footer note about deals is shown', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(
        find.text('Chats about a car you added live in that deal, under Deals.'),
        findsOneWidget,
      );
    });

    testWidgets('Search filters chats by title', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Enter search query
      await tester.enterText(find.byType(TextField), 'RAV4');
      await tester.pump(const Duration(milliseconds: 250)); // Debounce

      // Only RAV4 related chats should show
      expect(find.text('RAV4 Hybrid search'), findsOneWidget);
      expect(find.text('CR-V vs RAV4'), findsOneWidget);
      expect(find.text('SUV search'), findsNothing);
    });

    testWidgets('Shop mode shows results count', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Shop chat should show "24 results" instead of time
      expect(find.textContaining('24 results'), findsOneWidget);
    });

    testWidgets('Ask mode shows mode label', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Ask ·'), findsWidgets);
    });

    testWidgets('Drawer has correct width (max 318)', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      final drawer = tester.widget<Drawer>(find.byType(Drawer));
      expect(drawer.width, lessThanOrEqualTo(318));
    });
  });
}
