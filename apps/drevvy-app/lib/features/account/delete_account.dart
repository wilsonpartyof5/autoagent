import 'package:flutter/material.dart';

import '../../core/theme/drevvy_theme.dart';
import '../../data/auth/auth_exception.dart';
import '../../data/services/shopper_session_store.dart';

const deleteAccountConfirmTitle = 'Delete my account';

const deleteAccountConfirmBody =
    'This deletes your Drevvy account. We erase your name, your saved cars, and your sign-in. '
    'Dealer chats and key purchases stay, with your name taken off. You cannot undo this.';

const deleteAccountKeepLabel = 'Keep my account';

const deleteAccountConfirmLabel = 'Delete my account';

const deleteAccountNeedsSignIn =
    'Sign in first. Then you can delete this account.';

const deleteAccountSuccess = 'Your account is deleted.';

const deleteAccountFailed = 'We could not delete your account. Try again.';

/// Confirm, then `DELETE /api/consumer/profile`.
///
/// [onDeleted] runs after the server accepts the delete and the local session
/// is cleared. Cancel and a missing sign-in do not call it.
Future<void> confirmAndDeleteAccount(
  BuildContext context, {
  VoidCallback? onDeleted,
}) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final text = context.drevvyText;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: Text(deleteAccountConfirmTitle, style: text.title),
        content: Text(deleteAccountConfirmBody, style: text.body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text(deleteAccountKeepLabel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(
              deleteAccountConfirmLabel,
              style: TextStyle(color: dialogContext.drevvy.danger),
            ),
          ),
        ],
      );
    },
  );
  if (confirmed != true || !context.mounted) return;

  final token = ShopperSessionStore.instance.accessToken;
  if (token == null || token.isEmpty) {
    _say(messenger, deleteAccountNeedsSignIn);
    return;
  }

  try {
    await ShopperSessionStore.instance.authApi.deleteAccount(token);
    try {
      await ShopperSessionStore.instance.clear();
    } catch (_) {
      ShopperSessionStore.instance.session = null;
    }
    if (!context.mounted) return;
    onDeleted?.call();
    _say(messenger, deleteAccountSuccess);
  } on AuthException catch (error) {
    _say(messenger, error.message);
  } catch (_) {
    _say(messenger, deleteAccountFailed);
  }
}

void _say(ScaffoldMessengerState? messenger, String message) {
  messenger?.showSnackBar(SnackBar(content: Text(message)));
}
