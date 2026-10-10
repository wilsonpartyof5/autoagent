import 'package:equatable/equatable.dart';

enum Entitlement { free, pro, proCancelled }

enum TradeInPref { yes, no, unsure }

enum PaymentPref { cash, finance, unsure }

class User extends Equatable {
  const User({
    required this.id,
    required this.firstName,
    required this.email,
    required this.entitlement,
    required this.usage,
    this.prefs,
    this.notificationPrefs = const NotificationPrefs(),
    this.locationState = LocationState.notAsked,
    this.zipCode,
  });

  final String id;
  final String firstName;
  final String email;
  final Entitlement entitlement;
  final Usage usage;
  final UserPrefs? prefs;
  final NotificationPrefs notificationPrefs;
  final LocationState locationState;
  final String? zipCode;

  bool get isPro => entitlement == Entitlement.pro;
  bool get isCancelled => entitlement == Entitlement.proCancelled;
  bool get isFree => entitlement == Entitlement.free;

  bool get canAddCar => isPro && usage.used < usage.cap;
  int get carsRemaining => usage.cap - usage.used;

  @override
  List<Object?> get props => [id, email, entitlement];

  User copyWith({
    Entitlement? entitlement,
    Usage? usage,
    UserPrefs? prefs,
    NotificationPrefs? notificationPrefs,
    LocationState? locationState,
    String? zipCode,
  }) {
    return User(
      id: id,
      firstName: firstName,
      email: email,
      entitlement: entitlement ?? this.entitlement,
      usage: usage ?? this.usage,
      prefs: prefs ?? this.prefs,
      notificationPrefs: notificationPrefs ?? this.notificationPrefs,
      locationState: locationState ?? this.locationState,
      zipCode: zipCode ?? this.zipCode,
    );
  }
}

class Usage extends Equatable {
  const Usage({
    required this.used,
    required this.cap,
    required this.resetsOn,
  });

  final int used;
  final int cap;
  final DateTime resetsOn;

  String get formatted => '$used of $cap used';
  String get resetsFormatted => 'resets ${_formatDate(resetsOn)}';

  static String _formatDate(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[d.month - 1]} ${d.day}';
  }

  @override
  List<Object?> get props => [used, cap, resetsOn];
}

class UserPrefs extends Equatable {
  const UserPrefs({
    this.budgetOtd,
    this.bodyTypes = const [],
    this.tradeIn = TradeInPref.unsure,
    this.payment = PaymentPref.unsure,
    this.radius = 50,
  });

  final int? budgetOtd;
  final List<String> bodyTypes;
  final TradeInPref tradeIn;
  final PaymentPref payment;
  final int radius;

  @override
  List<Object?> get props => [budgetOtd, bodyTypes, tradeIn, payment];
}

class NotificationPrefs extends Equatable {
  const NotificationPrefs({
    this.enabled = false,
    this.hidePricesOnLockScreen = false,
  });

  final bool enabled;
  final bool hidePricesOnLockScreen;

  @override
  List<Object?> get props => [enabled, hidePricesOnLockScreen];
}

enum LocationState { notAsked, granted, denied, zipFallback }
