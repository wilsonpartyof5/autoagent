import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// Raw nonce sent to the backend. Apple receives the SHA-256 hex digest instead,
/// which is what Supabase compares against the identity token.
String createRawNonce([int length = 32]) {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  final random = Random.secure();
  return List.generate(length, (_) => charset[random.nextInt(charset.length)], growable: false).join();
}

String sha256Nonce(String rawNonce) {
  return sha256.convert(utf8.encode(rawNonce)).toString();
}
