import 'package:drevvy_dealer_app/data/demo_desk.dart';
import 'package:drevvy_dealer_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('magic-link stub opens the inbox and a chat reply', (tester) async {
    tester.view.physicalSize = const Size(900, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final desk = DealerDesk(now: DateTime.utc(2026, 10, 24, 15));
    await tester.pumpWidget(DrevvyDeskApp(desk: desk));
    await tester.pumpAndSettle();

    expect(find.text('Desk'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('work-email')), 'sam@demo-rooftop.test');
    await tester.tap(find.byKey(const Key('send-link')));
    await tester.pumpAndSettle();

    expect(find.textContaining('No email was sent'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('otp-code')), '123456');
    await tester.tap(find.byKey(const Key('continue-demo')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Jordan · #A7F2'), findsOneWidget);
    expect(find.textContaining('Sam · #B3C1'), findsOneWidget);
    expect(find.textContaining('555-'), findsNothing);
    expect(find.textContaining('@'), findsNothing);

    await tester.tap(find.textContaining('Jordan · #A7F2'));
    await tester.pumpAndSettle();

    expect(find.text('Conversation'), findsOneWidget);
    expect(find.textContaining('Get Best Price'), findsWidgets);
    await tester.enterText(find.byKey(const Key('chat-composer')), 'Yes, stock #R44118 is still here.');
    await tester.pump();
    await tester.tap(find.byKey(const Key('send-message')));
    await tester.pumpAndSettle();

    expect(find.text('Yes, stock #R44118 is still here.'), findsOneWidget);
    expect(desk.conversation('conv_rav4')!.stage, ConversationStage.inConversation);
  });
}
