import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/chat.dart';
import 'package:drevvy_app/data/models/search_profile.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/account/widgets/memory_facts_sheet.dart';
import 'package:drevvy_app/features/account/widgets/recent_searches_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/memory_sheet.dart';

void main() {
  final budget = MemoryItem(
    id: 'mem_budget',
    kind: MemoryKind.budget,
    value: 40000,
    source: MemorySource.explicit,
    updatedAt: DateTime.utc(2026, 1, 1),
  );
  final makes = MemoryItem(
    id: 'mem_makes',
    kind: MemoryKind.makes,
    value: ['Toyota'],
    source: MemorySource.inferred,
    updatedAt: DateTime.utc(2026, 1, 2),
  );

  SavedSearch sampleSearch({String id = 'search_a', int runCount = 1}) {
    return SavedSearch(
      id: id,
      filters: const SearchFilters(
        makes: ['Toyota'],
        models: ['RAV4'],
        priceMax: 35000,
        zip: '94105',
        radiusMi: 30,
      ),
      lastRunAt: DateTime.utc(2026, 4, 1),
      runCount: runCount,
    );
  }

  Future<void> openSheet(WidgetTester tester, Widget sheet) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () {
                showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => sheet,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
  }

  group('Memory sheet', () {
    testWidgets('turning a fact off reports the remaining set', (tester) async {
      Set<String>? enabled;
      await openSheet(
        tester,
        MemorySheet(
          items: [budget, makes],
          enabledItemIds: {budget.id, makes.id},
          onItemsChanged: (ids) => enabled = ids,
        ),
      );

      expect(find.text('Using your past searches'), findsOneWidget);
      await tester.tap(find.byType(Switch).first);
      await tester.pumpAndSettle();

      expect(enabled, isNotNull);
      expect(enabled, isNot(contains(budget.id)));
      expect(enabled, contains(makes.id));
    });
  });

  group('Remembered facts', () {
    testWidgets('edits, deletes, and adds a fact', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final saved = <List<MemoryItem>>[];
      await openSheet(
        tester,
        MemoryFactsSheet(items: [budget], onChanged: saved.add),
      );

      expect(find.text('Budget'), findsOneWidget);
      expect(find.text('\$40,000'), findsOneWidget);

      await tester.tap(find.byTooltip('Edit Budget'));
      await tester.pumpAndSettle();
      expect(find.text('Edit Budget'), findsOneWidget);
      await tester.tap(find.text('\$35,000'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Save'));
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(saved.last.single.displayValue, '\$35,000');

      await tester.tap(find.byTooltip('Delete Budget'));
      await tester.pumpAndSettle();
      expect(find.text('Budget'), findsNothing);
      expect(saved.last, isEmpty);

      await tester.tap(find.text('Undo'));
      await tester.pumpAndSettle();
      expect(find.text('Budget'), findsOneWidget);

      await tester.tap(find.text('Add a fact'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Must-haves'));
      await tester.pumpAndSettle();
      expect(find.text('Edit Must-haves'), findsOneWidget);
      await tester.tap(find.text('Apple CarPlay'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Save'));
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(find.text('Must-haves'), findsOneWidget);
      expect(find.text('Apple CarPlay'), findsOneWidget);
      expect(
        saved.last.map((item) => item.kind),
        contains(MemoryKind.mustHaves),
      );
    });
  });

  group('Recent searches', () {
    testWidgets('runs again, deletes, and clears all', (tester) async {
      final searches = [
        sampleSearch(),
        sampleSearch(id: 'search_b', runCount: 2),
      ];
      SavedSearch? ran;
      final deleted = <String>[];
      var cleared = false;

      await openSheet(
        tester,
        RecentSearchesSheet(
          searches: searches,
          onRun: (search) => ran = search,
          onDelete: (search) => deleted.add(search.id),
          onRestore: (_, _) {},
          onClearAll: () => cleared = true,
        ),
      );

      expect(find.text('Run again'), findsNWidgets(2));
      await tester.tap(find.byKey(const Key('delete_search_b')));
      await tester.pumpAndSettle();
      expect(deleted, ['search_b']);
      expect(find.byKey(const Key('delete_search_b')), findsNothing);

      await tester.tap(find.byKey(const Key('run_search_a')));
      await tester.pumpAndSettle();
      expect(ran?.id, 'search_a');
      expect(find.text('Recent searches'), findsNothing);

      await openSheet(
        tester,
        RecentSearchesSheet(
          searches: searches,
          onRun: (_) {},
          onDelete: (_) {},
          onRestore: (_, _) {},
          onClearAll: () => cleared = true,
        ),
      );
      await tester.tap(find.text('Clear all'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Clear all'));
      await tester.pumpAndSettle();
      expect(cleared, isTrue);
      expect(find.text('No recent searches'), findsOneWidget);
    });
  });

  group('Demo search profile', () {
    final repo = DemoRepository.instance;

    setUp(repo.resetDemoSearchProfile);
    tearDown(() {
      repo.resetDemoSearchProfile();
      repo.onSavedSearchRun = null;
    });

    test('saved search filters the demo inventory', () async {
      final listings = await repo.searchListings(
        filters: const SearchFilters(
          makes: ['Honda'],
          models: ['CR-V'],
          bodyTypes: ['SUV'],
          priceMax: 40000,
          radiusMi: 50,
        ),
      );

      expect(listings, hasLength(1));
      expect(listings.single.build.model, 'CR-V');
    });

    test('run again updates the search and notifies the shop', () async {
      SavedSearch? ran;
      repo.onSavedSearchRun = (search) => ran = search;
      repo.markSavedSearchRun('search_001');

      expect(ran?.id, 'search_001');
      expect(ran?.runCount, 6);
      final profile = await repo.getSearchProfile();
      expect(profile.searches.first.id, 'search_001');
      expect(profile.searches.first.runCount, 6);
    });

    test('delete and clear all update saved searches', () async {
      repo.deleteSavedSearch('search_002');
      final afterDelete = await repo.getSearchProfile();
      expect(afterDelete.searches.map((search) => search.id), ['search_001']);

      final removed = afterDelete.searches.single;
      repo.deleteSavedSearch(removed.id);
      repo.restoreSavedSearch(removed, 0);
      final restored = await repo.getSearchProfile();
      expect(restored.searches.single.id, removed.id);

      repo.clearSavedSearches();
      final cleared = await repo.getSearchProfile();
      expect(cleared.searches, isEmpty);
      expect(cleared.items, isNotEmpty);
    });

    test('turning every fact off drops memory from the answer', () async {
      final thread = await repo.sendMessage('What should I shop for?');
      final answer = thread.messages.last;
      expect(answer.memoryItemIds, isNotEmpty);
      expect(answer.text, contains('budget'));

      final updated = await repo.applyChatMemory({});
      final rewritten = updated.messages.last;
      expect(rewritten.memoryItemIds, isEmpty);
      expect(rewritten.text, isNot(contains('Using')));
    });
  });
}
