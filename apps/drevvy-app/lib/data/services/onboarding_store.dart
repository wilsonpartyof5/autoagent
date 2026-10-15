import 'package:shared_preferences/shared_preferences.dart';

/// Remembers that the shopper finished first-run onboarding.
abstract class OnboardingStore {
  Future<bool> isComplete();

  Future<void> markComplete();
}

/// In-memory flag used by tests and until the device store is installed.
class MemoryOnboardingStore implements OnboardingStore {
  MemoryOnboardingStore({this.complete = false});

  bool complete;

  @override
  Future<bool> isComplete() async => complete;

  @override
  Future<void> markComplete() async {
    complete = true;
  }
}

/// Device flag so a finished first run opens on Shop the next launch.
class PreferencesOnboardingStore implements OnboardingStore {
  static const storageKey = 'drevvy.onboarding.complete';

  @override
  Future<bool> isComplete() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(storageKey) ?? false;
  }

  @override
  Future<void> markComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(storageKey, true);
  }
}
