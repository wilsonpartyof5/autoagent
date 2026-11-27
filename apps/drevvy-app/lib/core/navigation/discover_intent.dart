import 'package:flutter/foundation.dart';

import '../../data/models/chat.dart';

/// Asks the open Discover surface to show a past ask.
///
/// The drawer sets [pendingChat] and notifies. Discover applies it only
/// while that route is current, then clears it.
class DiscoverIntent extends ChangeNotifier {
  ChatThread? pendingChat;

  void present(ChatThread chat) {
    pendingChat = chat;
    notifyListeners();
  }
}
