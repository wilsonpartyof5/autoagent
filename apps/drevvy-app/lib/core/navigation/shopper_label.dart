import 'package:intl/intl.dart';

import '../../data/models/user.dart';

/// Shoppers are first-name only. A profile with no given name keeps its
/// neutral status ("Signed in", "Not signed in") and does not invent one.
String shopperFirstName(User user) {
  if (!user.nameIsKnown) return user.firstName;
  final parts = user.firstName
      .split(' ')
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return user.firstName;
  return parts.first;
}

/// Letter for a known first name. Null when the account has no given name.
String? shopperAvatarLetter(User user) {
  if (!user.nameIsKnown) return null;
  final name = shopperFirstName(user).trim();
  if (name.isEmpty) return null;
  return name[0].toUpperCase();
}

/// Short relative time from a real timestamp. No date is invented.
String relativeTimeLabel(DateTime time, {DateTime? now}) {
  final clock = now ?? DateTime.now();
  var delta = clock.difference(time);
  if (delta.isNegative) delta = Duration.zero;
  if (delta.inMinutes < 1) return 'just now';
  if (delta.inMinutes < 60) return '${delta.inMinutes}m ago';
  if (delta.inHours < 24) return '${delta.inHours}h ago';
  if (delta.inDays == 1) return 'Yesterday';
  if (delta.inDays < 7) return '${delta.inDays}d ago';
  return DateFormat.MMMd().format(time);
}
