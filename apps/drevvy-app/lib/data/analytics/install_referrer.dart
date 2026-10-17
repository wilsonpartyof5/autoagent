import 'package:flutter/services.dart';

/// Reads the Play install referrer. Missing on iOS, web, and tests.
class InstallReferrer {
  const InstallReferrer();

  static const channelName = 'drevvy/install_referrer';

  Future<String?> read() async {
    try {
      final value = await const MethodChannel(channelName)
          .invokeMethod<String>('get')
          .timeout(const Duration(seconds: 2));
      final trimmed = value?.trim();
      if (trimmed == null || trimmed.isEmpty) return null;
      return trimmed;
    } catch (_) {
      return null;
    }
  }
}
