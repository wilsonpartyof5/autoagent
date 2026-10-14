import 'dart:io';

/// `flutter test` sets FLUTTER_TEST on the tester process.
bool get isFlutterTest => Platform.environment['FLUTTER_TEST'] == 'true';
