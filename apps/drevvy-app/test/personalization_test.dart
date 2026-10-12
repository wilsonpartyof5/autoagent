import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/features/shop/widgets/chat_empty.dart';
import 'package:drevvy_app/data/models/search_profile.dart';
import 'package:drevvy_app/data/models/chat.dart';

void main() {
  group('Personalization Tests (v1.6.1)', () {
    final personalizedStarters = [
      const StarterCard(
        kind: StarterKind.backToSearch,
        kicker: 'BACK TO YOUR SEARCH',
        title: 'RAV4 Hybrid · under \$35k · 30 mi',
        action: StarterAction(mode: 'shop'),
      ),
      const StarterCard(
        kind: StarterKind.priceDrops,
        kicker: 'PRICE DROPS',
        title: '3 price drops on cars like ones you viewed',
        action: StarterAction(mode: 'shop'),
      ),
      const StarterCard(
        kind: StarterKind.newListings,
        kicker: 'NEW LISTINGS',
        title: '5 new CR-V Hybrids within 30 mi',
        action: StarterAction(mode: 'shop'),
      ),
      const StarterCard(
        kind: StarterKind.fairPrice,
        kicker: 'FAIR PRICE',
        title: 'Is \$32,995 fair for the RAV4 you viewed?',
        action: StarterAction(mode: 'ask', prompt: 'Is \$32,995 fair?'),
      ),
    ];

    Widget buildTestWidget({
      List<StarterCard>? starters,
      bool hasHistory = false,
      String userName = 'Dana',
    }) {
      return MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: ChatEmpty(
            userName: userName,
            onPromptTap: (_) {},
            onShopTap: (_) {},
            starters: starters,
            hasHistory: hasHistory,
          ),
        ),
      );
    }

    group('ChatEmpty Widget', () {
      testWidgets('Shows generic greeting without history', (tester) async {
        await tester.pumpWidget(buildTestWidget());
        await tester.pumpAndSettle();

        expect(find.text('Hi Dana,\nwhat are you shopping for?'), findsOneWidget);
      });

      testWidgets('Shows personalized greeting with history', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
        expect(find.text('Pick up where you left off, or ask anything.'), findsOneWidget);
      });

      testWidgets('Shows generic starters without history', (tester) async {
        await tester.pumpWidget(buildTestWidget());
        await tester.pumpAndSettle();

        // Generic starters
        expect(find.text('Best hybrid SUVs'), findsOneWidget);
        expect(find.text('Value picks'), findsOneWidget);
      });

      testWidgets('Shows personalized starters with history', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('RAV4 Hybrid · under \$35k · 30 mi'), findsOneWidget);
        expect(find.text('3 price drops on cars like ones you viewed'), findsOneWidget);
      });

      testWidgets('Shows uppercase kickers on personalized cards', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('BACK TO YOUR SEARCH'), findsOneWidget);
        expect(find.text('PRICE DROPS'), findsOneWidget);
      });

      testWidgets('Shows "Based on your past searches" link with history', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Based on your past searches'), findsOneWidget);
        expect(find.text('Manage'), findsOneWidget);
      });

      testWidgets('Hides "Based on" link without history', (tester) async {
        await tester.pumpWidget(buildTestWidget());
        await tester.pumpAndSettle();

        expect(find.text('Based on your past searches'), findsNothing);
        expect(find.text('Manage'), findsNothing);
      });

      testWidgets('Shows trust line', (tester) async {
        await tester.pumpWidget(buildTestWidget());
        await tester.pumpAndSettle();

        expect(find.text('Dealers never see your contact info.'), findsOneWidget);
      });

      testWidgets('Shows gradient orb', (tester) async {
        await tester.pumpWidget(buildTestWidget());
        await tester.pumpAndSettle();

        // The orb is a 72x72 container with gradient (tightened per frame 51)
        final orbFinder = find.byWidgetPredicate((widget) =>
          widget is Container &&
          widget.constraints?.maxWidth == 72 &&
          widget.constraints?.maxHeight == 72
        );
        expect(orbFinder, findsOneWidget);
      });
    });

    group('SearchProfile Model', () {
      test('SearchProfile has correct default values', () {
        const profile = SearchProfile(userId: 'test');
        
        expect(profile.personalize, isTrue);
        expect(profile.items, isEmpty);
        expect(profile.searches, isEmpty);
        expect(profile.viewed, isEmpty);
      });

      test('SearchProfile copyWith works', () {
        const profile = SearchProfile(userId: 'test');
        final updated = profile.copyWith(personalize: false);
        
        expect(updated.personalize, isFalse);
        expect(updated.userId, equals('test'));
      });

      test('MemoryItem displayValue formats budget correctly', () {
        final item = MemoryItem(
          id: 'test',
          kind: MemoryKind.budget,
          value: 40000,
          source: MemorySource.explicit,
          updatedAt: DateTime.now(),
        );
        
        expect(item.displayValue, equals('\$40,000'));
      });

      test('MemoryItem displayValue formats list correctly', () {
        final item = MemoryItem(
          id: 'test',
          kind: MemoryKind.bodyTypes,
          value: ['SUV', 'Sedan'],
          source: MemorySource.inferred,
          updatedAt: DateTime.now(),
        );
        
        expect(item.displayValue, equals('SUV, Sedan'));
      });

      test('MemoryItem displayValue formats location correctly', () {
        final item = MemoryItem(
          id: 'test',
          kind: MemoryKind.location,
          value: {'zip': '94105', 'radius': 50},
          source: MemorySource.explicit,
          updatedAt: DateTime.now(),
        );
        
        expect(item.displayValue, equals('94105 · 50 mi'));
      });

      test('MemoryItem isInferred returns true for inferred source', () {
        final item = MemoryItem(
          id: 'test',
          kind: MemoryKind.makes,
          value: ['Toyota'],
          source: MemorySource.inferred,
          updatedAt: DateTime.now(),
        );
        
        expect(item.isInferred, isTrue);
      });

      test('SavedSearch displayTitle shows filters', () {
        final search = SavedSearch(
          id: 'test',
          filters: const SearchFilters(
            makes: ['Toyota'],
            models: ['RAV4'],
            priceMax: 35000,
            zip: '94105',
            radiusMi: 30,
          ),
          lastRunAt: DateTime.now(),
        );
        
        expect(search.displayTitle, contains('Toyota'));
        expect(search.displayTitle, contains('RAV4'));
        expect(search.displayTitle, contains('35000'));
      });
    });

    group('StarterCard Model', () {
      test('StarterCard has all required fields', () {
        const card = StarterCard(
          kind: StarterKind.backToSearch,
          kicker: 'TEST',
          title: 'Test title',
          action: StarterAction(mode: 'shop'),
        );
        
        expect(card.kind, equals(StarterKind.backToSearch));
        expect(card.kicker, equals('TEST'));
        expect(card.title, equals('Test title'));
        expect(card.action.mode, equals('shop'));
      });

      test('StarterKind has all expected values', () {
        expect(StarterKind.values, contains(StarterKind.backToSearch));
        expect(StarterKind.values, contains(StarterKind.priceDrops));
        expect(StarterKind.values, contains(StarterKind.newListings));
        expect(StarterKind.values, contains(StarterKind.fairPrice));
        expect(StarterKind.values, contains(StarterKind.generic));
      });
    });

    group('ChatThread Model Updates', () {
      test('ChatThread has new v1.6.1 fields', () {
        final thread = ChatThread(
          id: 'test',
          mode: ChatMode.ask,
          title: 'Test chat',
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
          usedMemory: true,
        );
        
        expect(thread.title, equals('Test chat'));
        expect(thread.createdAt, isNotNull);
        expect(thread.updatedAt, isNotNull);
        expect(thread.usedMemory, isTrue);
      });

      test('ChatThread displayTitle uses title when set', () {
        final thread = ChatThread(
          id: 'test',
          mode: ChatMode.ask,
          title: 'My custom title',
          messages: const [
            ChatMessage(
              id: 'msg1',
              role: MessageRole.user,
              contentType: MessageContentType.text,
              text: 'This should not be the title',
            ),
          ],
        );
        
        expect(thread.displayTitle, equals('My custom title'));
      });

      test('ChatThread displayTitle falls back to first message', () {
        const thread = ChatThread(
          id: 'test',
          mode: ChatMode.ask,
          messages: [
            ChatMessage(
              id: 'msg1',
              role: MessageRole.user,
              contentType: MessageContentType.text,
              text: 'What is the best hybrid SUV?',
            ),
          ],
        );
        
        expect(thread.displayTitle, equals('What is the best hybrid SUV?'));
      });

      test('ChatThread displayTitle truncates long messages', () {
        const thread = ChatThread(
          id: 'test',
          mode: ChatMode.ask,
          messages: [
            ChatMessage(
              id: 'msg1',
              role: MessageRole.user,
              contentType: MessageContentType.text,
              text: 'This is a very long message that should be truncated to forty characters',
            ),
          ],
        );
        
        expect(thread.displayTitle.length, lessThanOrEqualTo(40));
        expect(thread.displayTitle, endsWith('...'));
      });

      test('ChatMessage has memoryItemIds field', () {
        const message = ChatMessage(
          id: 'test',
          role: MessageRole.agent,
          contentType: MessageContentType.text,
          text: 'Response',
          memoryItemIds: ['mem_001', 'mem_002'],
        );
        
        expect(message.memoryItemIds, hasLength(2));
        expect(message.usedMemory, isTrue);
      });

      test('ChatMessage usedMemory is false when empty', () {
        const message = ChatMessage(
          id: 'test',
          role: MessageRole.agent,
          contentType: MessageContentType.text,
          text: 'Response',
        );
        
        expect(message.usedMemory, isFalse);
      });
    });
  });
}
