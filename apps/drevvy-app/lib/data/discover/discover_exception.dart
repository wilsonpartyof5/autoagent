/// Failure from `/api/public/discover/*`. Callers show [message] and retry.
/// They do not replace the result with demo cars.
class DiscoverException implements Exception {
  const DiscoverException({
    required this.status,
    required this.code,
    required this.message,
    this.retryAfterSeconds,
  });

  final int status;
  final String code;
  final String message;
  final int? retryAfterSeconds;

  @override
  String toString() => 'DiscoverException($status $code): $message';
}
