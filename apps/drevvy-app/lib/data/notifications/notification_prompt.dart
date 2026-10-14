import 'local_flags.dart';

/// Asks for notification permission only after the shopper adds a car.
///
/// [shouldPromptAfterAdd] is the only entry point. Nothing calls it at launch.
class NotificationPromptGate {
  NotificationPromptGate({required this._flags});

  final LocalFlags _flags;

  Future<bool> shouldPromptAfterAdd() async {
    final prompted = await _flags.getBool(PushFlags.prompted);
    return !prompted;
  }

  Future<void> markPrompted() {
    return _flags.setBool(PushFlags.prompted, true);
  }
}
