import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/features/shop/widgets/chat_empty.dart';
import 'package:drevvy_app/data/models/search_profile.dart';

void main() {
  group('Responsive Layout Tests (v1.6.1 §6.5a)', () {
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
      required Size screenSize,
      double textScale = 1.0,
      List<StarterCard>? starters,
      bool hasHistory = false,
    }) {
      return MaterialApp(
        theme: drevvyTheme(Brightness.light),
        builder: (context, child) {
          return MediaQuery(
            data: MediaQueryData(
              size: screenSize,
              padding: const EdgeInsets.only(top: 59, bottom: 34),
              textScaler: TextScaler.linear(textScale),
            ),
            child: child!,
          );
        },
        home: Scaffold(
          body: ChatEmpty(
            userName: 'Dana',
            onPromptTap: (_) {},
            onShopTap: (_) {},
            starters: starters,
            hasHistory: hasHistory,
          ),
        ),
      );
    }

    group('Computed bottom inset', () {
      test('contentBottomInset is computed correctly', () {
        // Per spec §6.5a: tabBarHeight + composerMinHeight + composerTabBarGap + 24
        const expected = DrevvySpace.tabBarHeight + 
            DrevvySpace.composerMinHeight + 
            DrevvySpace.composerTabBarGap + 
            24.0;
        
        expect(DrevvySpace.contentBottomInset, equals(expected));
        expect(DrevvySpace.contentBottomInset, equals(64.0 + 56.0 + 12.0 + 24.0));
        expect(DrevvySpace.contentBottomInset, equals(156.0));
      });
    });

    group('iPhone SE (375x667) - text scale 1.0', () {
      const screenSize = Size(375, 667);

      testWidgets('Generic starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.0,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Best hybrid SUVs'), findsOneWidget);
        expect(find.text('Value picks'), findsOneWidget);
      });

      testWidgets('Personalized starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.0,
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
        expect(find.text('Based on your past searches'), findsOneWidget);
      });
    });

    group('iPhone SE (375x667) - text scale 1.3', () {
      const screenSize = Size(375, 667);

      testWidgets('Generic starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.3,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Best hybrid SUVs'), findsOneWidget);
      });

      testWidgets('Personalized starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.3,
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
      });
    });

    group('iPhone 15 (393x852) - text scale 1.0', () {
      const screenSize = Size(393, 852);

      testWidgets('Generic starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.0,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Best hybrid SUVs'), findsOneWidget);
        expect(find.text('Value picks'), findsOneWidget);
      });

      testWidgets('Personalized starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.0,
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
        expect(find.text('Based on your past searches'), findsOneWidget);
      });
    });

    group('iPhone 15 (393x852) - text scale 1.3', () {
      const screenSize = Size(393, 852);

      testWidgets('Generic starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.3,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Best hybrid SUVs'), findsOneWidget);
      });

      testWidgets('Personalized starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.3,
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
      });
    });

    group('iPhone 15 Pro Max (430x932) - text scale 1.0', () {
      const screenSize = Size(430, 932);

      testWidgets('Generic starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.0,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Best hybrid SUVs'), findsOneWidget);
        expect(find.text('Value picks'), findsOneWidget);
      });

      testWidgets('Personalized starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.0,
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
        expect(find.text('Based on your past searches'), findsOneWidget);
      });
    });

    group('iPhone 15 Pro Max (430x932) - text scale 1.3', () {
      const screenSize = Size(430, 932);

      testWidgets('Generic starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.3,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Best hybrid SUVs'), findsOneWidget);
      });

      testWidgets('Personalized starters render without crash', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: screenSize,
          textScale: 1.3,
          starters: personalizedStarters,
          hasHistory: true,
        ));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back, Dana'), findsOneWidget);
      });
    });

    group('Card properties', () {
      testWidgets('Cards have min height constraint of 120', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: const Size(393, 852),
        ));
        await tester.pumpAndSettle();

        // Find ConstrainedBox with minHeight 120
        final constrainedBoxFinder = find.byWidgetPredicate((widget) =>
          widget is ConstrainedBox &&
          widget.constraints.minHeight == 120.0
        );
        
        // Should find 4 cards
        expect(constrainedBoxFinder, findsNWidgets(4));
      });

      testWidgets('Card titles have maxLines 2 with ellipsis', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: const Size(393, 852),
        ));
        await tester.pumpAndSettle();

        // Find Text widgets for card titles
        final titleFinder = find.text('Best hybrid SUVs');
        expect(titleFinder, findsOneWidget);
        
        final titleWidget = tester.widget<Text>(titleFinder);
        expect(titleWidget.maxLines, equals(2));
        expect(titleWidget.overflow, equals(TextOverflow.ellipsis));
      });
    });

    group('Responsive orb', () {
      testWidgets('Short screen (<750) uses compact orb', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: const Size(375, 667),
        ));
        await tester.pumpAndSettle();

        final orbFinder = find.byWidgetPredicate((widget) =>
          widget is Container &&
          widget.decoration is BoxDecoration &&
          (widget.decoration as BoxDecoration).shape == BoxShape.circle &&
          (widget.decoration as BoxDecoration).gradient != null
        );
        
        expect(orbFinder, findsOneWidget);
        final orbWidget = tester.widget<Container>(orbFinder);
        // On compact (height < 750), orb should be 64
        expect(orbWidget.constraints?.maxWidth, equals(64.0));
      });

      testWidgets('Tall screen (>=750) uses standard orb', (tester) async {
        await tester.pumpWidget(buildTestWidget(
          screenSize: const Size(393, 852),
        ));
        await tester.pumpAndSettle();

        final orbFinder = find.byWidgetPredicate((widget) =>
          widget is Container &&
          widget.decoration is BoxDecoration &&
          (widget.decoration as BoxDecoration).shape == BoxShape.circle &&
          (widget.decoration as BoxDecoration).gradient != null
        );
        
        expect(orbFinder, findsOneWidget);
        final orbWidget = tester.widget<Container>(orbFinder);
        // On standard (height >= 750), orb should be 72
        expect(orbWidget.constraints?.maxWidth, equals(72.0));
      });
    });
  });
}
