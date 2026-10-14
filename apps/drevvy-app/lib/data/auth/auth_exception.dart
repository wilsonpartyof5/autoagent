class AuthException implements Exception {
  const AuthException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'AuthException($code, $message)';
}

/// The shopper dismissed the provider sheet. Demo mode stays as it was.
class AuthCancelledException implements Exception {
  const AuthCancelledException();
}
