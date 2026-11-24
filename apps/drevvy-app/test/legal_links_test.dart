import 'package:drevvy_app/core/config/drevvy_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/features/common/open_drevvy_page.dart';
import 'package:drevvy_app/features/shop/widgets/account_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/pack_picker_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

void main() {
  late _FakeUrlLauncher launcher;

  setUp(() {
    launcher = _FakeUrlLauncher();
    UrlLauncherPlatform.instance = launcher;
  });

  testWidgets('account Terms and Privacy open the public pages', (
    tester,
  ) async {
    await _pumpAccount(tester);

    await tester.scrollUntilVisible(find.text('Terms'), 200);
    await tester.tap(find.text('Terms'));
    await tester.pump();
    expect(launcher.launchedUrl, DrevvyConfig.termsUrl);
    expect(launcher.mode, PreferredLaunchMode.externalApplication);

    await tester.scrollUntilVisible(find.text('Privacy'), 200);
    await tester.tap(find.text('Privacy'));
    await tester.pump();
    expect(launcher.launchedUrl, DrevvyConfig.privacyPolicyUrl);
    expect(find.text(couldNotOpenPageMessage), findsNothing);
  });

  testWidgets('account page launch failure says the page did not open', (
    tester,
  ) async {
    launcher.result = false;
    await _pumpAccount(tester);

    await tester.scrollUntilVisible(find.text('Privacy'), 200);
    await tester.tap(find.text('Privacy'));
    await tester.pump();
    expect(find.text(couldNotOpenPageMessage), findsOneWidget);
  });

  testWidgets('key pack Terms opens the terms page', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const Scaffold(
          body: PackPickerSheet(
            onPurchase: _noopPurchase,
            onRestore: _noop,
            onKeepShopping: _noop,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Terms'));
    await tester.pump();
    expect(launcher.launchedUrl, DrevvyConfig.termsUrl);
    expect(launcher.mode, PreferredLaunchMode.externalApplication);

    await tester.tap(find.text('Privacy'));
    await tester.pumpAndSettle();
    expect(find.text('Close'), findsOneWidget);
    expect(launcher.launchedUrl, DrevvyConfig.termsUrl);
  });
}

Future<void> _pumpAccount(WidgetTester tester) async {
  final repo = DemoRepository(networkDelay: Duration.zero);
  await tester.pumpWidget(
    MaterialApp(
      theme: drevvyTheme(Brightness.light),
      home: Scaffold(body: AccountSheet(repository: repo)),
    ),
  );
  // Search profile load waits 300ms even when the repository delay is zero.
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _noopPurchase(CarPackType pack) async {}

void _noop() {}

class _FakeUrlLauncher extends UrlLauncherPlatform
    with MockPlatformInterfaceMixin {
  String? launchedUrl;
  PreferredLaunchMode? mode;
  bool result = true;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launchedUrl = url;
    mode = options.mode;
    return result;
  }
}
