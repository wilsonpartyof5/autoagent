import 'package:intl/intl.dart';

final _wholeDollars = NumberFormat.currency(
  locale: 'en_US',
  symbol: r'$',
  decimalDigits: 0,
);
final _centDollars = NumberFormat.currency(
  locale: 'en_US',
  symbol: r'$',
  decimalDigits: 2,
);

/// Shopper-facing USD. Whole dollars drop the cents; per-car prices keep them.
String formatUsd(num amount, {bool cents = false}) {
  if (!cents && amount == amount.roundToDouble()) {
    return _wholeDollars.format(amount);
  }
  return _centDollars.format(amount);
}
