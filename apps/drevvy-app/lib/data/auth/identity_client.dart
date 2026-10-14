import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../core/config/drevvy_config.dart';
import 'auth_exception.dart';
import 'identity_nonce.dart';

class ProviderIdentity {
  const ProviderIdentity({required this.identityToken, this.nonce});

  final String identityToken;
  final String? nonce;
}

abstract class IdentityClient {
  Future<ProviderIdentity> signIn();
}

class AppleIdentityClient implements IdentityClient {
  @override
  Future<ProviderIdentity> signIn() async {
    final needsWeb = kIsWeb || defaultTargetPlatform == TargetPlatform.android;
    if (needsWeb && !DrevvyConfig.appleWebConfigured) {
      throw const AuthException(
        code: 'apple_not_configured',
        message: 'Sign in with Apple on this platform needs a Services ID and redirect URL.',
      );
    }

    final rawNonce = createRawNonce();
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: sha256Nonce(rawNonce),
        webAuthenticationOptions: needsWeb
            ? WebAuthenticationOptions(
                clientId: DrevvyConfig.appleServiceId,
                redirectUri: Uri.parse(DrevvyConfig.appleRedirectUri),
              )
            : null,
      );
      final token = credential.identityToken;
      if (token == null || token.isEmpty) {
        throw const AuthException(
          code: 'invalid_request',
          message: 'Sign in with Apple did not include a token.',
        );
      }
      return ProviderIdentity(identityToken: token, nonce: rawNonce);
    } on SignInWithAppleAuthorizationException catch (error) {
      if (error.code == AuthorizationErrorCode.canceled) {
        throw const AuthCancelledException();
      }
      throw AuthException(code: error.code.name, message: error.message);
    } on SignInWithAppleNotSupportedException catch (error) {
      throw AuthException(code: 'apple_unavailable', message: error.message);
    } on AuthException {
      rethrow;
    } on AuthCancelledException {
      rethrow;
    } catch (_) {
      throw const AuthException(code: 'apple_failed', message: 'Apple sign-in was rejected.');
    }
  }
}

class GoogleIdentityClient implements IdentityClient {
  bool _initialized = false;

  @override
  Future<ProviderIdentity> signIn() async {
    if (!DrevvyConfig.googleConfigured) {
      throw const AuthException(
        code: 'google_not_configured',
        message: 'Google sign-in needs an OAuth client ID. Add it in DrevvyConfig.',
      );
    }
    if (!GoogleSignIn.instance.supportsAuthenticate()) {
      throw const AuthException(
        code: 'google_unavailable',
        message: 'Google sign-in is not available on this platform yet.',
      );
    }

    try {
      if (!_initialized) {
        await GoogleSignIn.instance.initialize(
          clientId: DrevvyConfig.googleIosClientId.isEmpty ? null : DrevvyConfig.googleIosClientId,
          serverClientId:
              DrevvyConfig.googleServerClientId.isEmpty ? null : DrevvyConfig.googleServerClientId,
        );
        _initialized = true;
      }
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw const AuthException(
          code: 'invalid_request',
          message: 'Google sign-in did not include a token.',
        );
      }
      return ProviderIdentity(identityToken: token);
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        throw const AuthCancelledException();
      }
      throw AuthException(
        code: error.code.name,
        message: error.description ?? 'Google sign-in was rejected.',
      );
    } on AuthException {
      rethrow;
    } on AuthCancelledException {
      rethrow;
    } catch (_) {
      throw const AuthException(code: 'google_failed', message: 'Google sign-in was rejected.');
    }
  }
}
