import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/providers/app_services.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/auth/auth_controller.dart';

/// Apple and Google sign-in. Does not open a purchase.
class ShopperSignInActions extends ConsumerStatefulWidget {
  const ShopperSignInActions({super.key, required this.onSuccess});

  final Future<void> Function() onSuccess;

  @override
  ConsumerState<ShopperSignInActions> createState() =>
      _ShopperSignInActionsState();
}

class _ShopperSignInActionsState extends ConsumerState<ShopperSignInActions> {
  String? _busy;

  Future<void> _signIn(String provider) async {
    if (_busy != null) return;
    setState(() => _busy = provider);
    ProductAnalytics.instance.track(AnalyticsEvents.signInStarted, {
      'provider': provider,
    });
    final auth = ref.read(authControllerProvider);
    final result = provider == 'apple'
        ? await auth.signInWithApple()
        : await auth.signInWithGoogle();
    if (!mounted) return;
    switch (result) {
      case AuthSuccess():
        ProductAnalytics.instance.track(AnalyticsEvents.signInCompleted, {
          'provider': provider,
          'identified': true,
        });
        await widget.onSuccess();
      case AuthCancelled():
        ProductAnalytics.instance.track(AnalyticsEvents.signInCancelled, {
          'provider': provider,
        });
      case AuthFailure(:final message):
        ProductAnalytics.instance.track(AnalyticsEvents.signInFailed, {
          'provider': provider,
          'reason': 'auth_rejected',
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
    }
    if (mounted) setState(() => _busy = null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DrevvyButton(
          label: 'Continue with Apple',
          icon: LucideIcons.smartphone,
          variant: DrevvyButtonVariant.secondary,
          isLoading: _busy == 'apple',
          onPressed: _busy == null ? () => _signIn('apple') : null,
          isFullWidth: true,
        ),
        const SizedBox(height: DrevvySpace.s3),
        DrevvyButton(
          label: 'Continue with Google',
          icon: LucideIcons.mail,
          variant: DrevvyButtonVariant.secondary,
          isLoading: _busy == 'google',
          onPressed: _busy == null ? () => _signIn('google') : null,
          isFullWidth: true,
        ),
      ],
    );
  }
}
