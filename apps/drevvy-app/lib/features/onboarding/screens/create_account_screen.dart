import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/providers/app_services.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/auth/auth_controller.dart';
import '../onboarding_controller.dart';

/// Screen 15: Create account (before payment)
class CreateAccountScreen extends ConsumerStatefulWidget {
  const CreateAccountScreen({super.key});

  @override
  ConsumerState<CreateAccountScreen> createState() => _CreateAccountScreenState();
}

class _CreateAccountScreenState extends ConsumerState<CreateAccountScreen> {
  final _firstNameController = TextEditingController();
  final _emailController = TextEditingController();
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
    setState(() => _busy = null);
    switch (result) {
      case AuthSuccess():
        ProductAnalytics.instance.track(AnalyticsEvents.signInCompleted, {
          'provider': provider,
          'identified': true,
        });
        await completeFirstRun(ref);
        if (!mounted) return;
        context.go('/shop');
      case AuthCancelled():
        ProductAnalytics.instance.track(AnalyticsEvents.signInCancelled, {
          'provider': provider,
        });
      case AuthFailure():
        ProductAnalytics.instance.track(AnalyticsEvents.signInFailed, {
          'provider': provider,
          'reason': 'auth_rejected',
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result.message)));
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  bool get _canContinue =>
      _firstNameController.text.isNotEmpty &&
      _emailController.text.contains('@');

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top bar
                  Row(
                    children: [
                      IconButton(
                        icon: Icon(LucideIcons.chevronLeft, color: colors.ink),
                        onPressed: () => context.pop(),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  Text('Create your account', style: text.headline),
                  
                  const SizedBox(height: DrevvySpace.s2),
                  
                  Text(
                    'We\'ll send a verification code to your email.',
                    style: text.body.copyWith(color: colors.muted),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s8),
                  
                  // First name field
                  Text('First name', style: text.bodyStrong),
                  const SizedBox(height: DrevvySpace.s2),
                  GlassCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.s4,
                      vertical: DrevvySpace.s1,
                    ),
                    child: TextField(
                      controller: _firstNameController,
                      textCapitalization: TextCapitalization.words,
                      decoration: InputDecoration(
                        hintText: 'Dana',
                        hintStyle: text.body.copyWith(color: colors.placeholder),
                        border: InputBorder.none,
                      ),
                      style: text.body,
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  Text(
                    'This is the only thing dealers see.',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  // Email field
                  Text('Email', style: text.bodyStrong),
                  const SizedBox(height: DrevvySpace.s2),
                  GlassCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.s4,
                      vertical: DrevvySpace.s1,
                    ),
                    child: TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: InputDecoration(
                        hintText: 'dana@example.com',
                        hintStyle: text.body.copyWith(color: colors.placeholder),
                        border: InputBorder.none,
                      ),
                      style: text.body,
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  Text(
                    'Official offers are forwarded here. Never shared with dealers.',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                  
                  const Spacer(),
                  
                  // SSO buttons
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
                  
                  const SizedBox(height: DrevvySpace.s4),
                  
                  Row(
                    children: [
                      Expanded(child: Divider(color: colors.line)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s3),
                        child: Text('or', style: text.callout.copyWith(color: colors.muted)),
                      ),
                      Expanded(child: Divider(color: colors.line)),
                    ],
                  ),
                  
                  const SizedBox(height: DrevvySpace.s4),
                  
                  DrevvyButton(
                    label: 'Continue with email',
                    onPressed: _canContinue && _busy == null
                        ? () async {
                            // Email OTP is not a consumer auth route. Continue in demo mode.
                            ProductAnalytics.instance.track(AnalyticsEvents.signInStarted, {
                              'provider': 'email',
                            });
                            ProductAnalytics.instance.track(AnalyticsEvents.signInCompleted, {
                              'provider': 'email',
                              'identified': false,
                            });
                            await completeFirstRun(ref);
                            if (!context.mounted) return;
                            context.go('/shop');
                          }
                        : null,
                    isLoading: false,
                    isFullWidth: true,
                  ),
                  
                  SizedBox(height: DrevvySpace.s6 + bottomPadding),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
