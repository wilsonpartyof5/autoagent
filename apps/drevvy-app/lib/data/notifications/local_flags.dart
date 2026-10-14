import 'package:shared_preferences/shared_preferences.dart';

import '../../core/platform/plugin_errors.dart';

abstract class LocalFlags {
  Future<bool> getBool(String key);
  Future<void> setBool(String key, bool value);
  Future<String?> getString(String key);
  Future<void> setString(String key, String value);
}

class MemoryFlags implements LocalFlags {
  final Map<String, Object> _values = {};

  @override
  Future<bool> getBool(String key) async => _values[key] == true;

  @override
  Future<String?> getString(String key) async {
    final value = _values[key];
    return value is String ? value : null;
  }

  @override
  Future<void> setBool(String key, bool value) async {
    _values[key] = value;
  }

  @override
  Future<void> setString(String key, String value) async {
    _values[key] = value;
  }
}

class SharedPreferencesFlags implements LocalFlags {
  SharedPreferences? _prefs;

  Future<SharedPreferences?> _get() async {
    try {
      return _prefs ??= await SharedPreferences.getInstance();
    } catch (error) {
      if (isPluginMissing(error)) return null;
      rethrow;
    }
  }

  @override
  Future<bool> getBool(String key) async {
    final prefs = await _get();
    return prefs?.getBool(key) ?? false;
  }

  @override
  Future<String?> getString(String key) async {
    final prefs = await _get();
    return prefs?.getString(key);
  }

  @override
  Future<void> setBool(String key, bool value) async {
    final prefs = await _get();
    await prefs?.setBool(key, value);
  }

  @override
  Future<void> setString(String key, String value) async {
    final prefs = await _get();
    await prefs?.setString(key, value);
  }
}

abstract final class PushFlags {
  static const prompted = 'drevvy.notifications.prompted';
  static const optedIn = 'drevvy.notifications.optedIn';
  static const token = 'drevvy.notifications.fcmToken';
}
