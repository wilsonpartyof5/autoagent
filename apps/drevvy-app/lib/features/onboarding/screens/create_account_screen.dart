import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../account/widgets/shopper_sign_in_actions.dart';
import '../onboarding_controller.dart';

/// Screen 15: Create account (before payment)
class CreateAccountScreen extends ConsumerStatefulWidget {
  const CreateAccountScreen({super.key});

  @override
  ConsumerState<CreateAccountScreen> createState() =>
      _CreateAccountScreenState();
}

class _CreateAccountScreenState extends ConsumerState<CreateAccountScreen> {
  static const emailSignInUnavailableMessage =
      'Email sign-in is not available.';

  Future<void> _afterSignIn() async {
    await DemoRepository.instance.pullSignedInBalance();
    await completeFirstRun(ref);
    if (!mounted) return;
    context.go('/shop');
  }

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
              padding: const EdgeInsets.symmetric(
                horizontal: DrevvySpace.gutter,
              ),
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
                    'Use Apple or Google to sign in. You do not have to buy anything.',
                    style: text.body.copyWith(color: colors.muted),
                  ),

                  const SizedBox(height: DrevvySpace.s4),

                  Text(
                    emailSignInUnavailableMessage,
                    style: text.body.copyWith(color: colors.ink),
                  ),

                  const Spacer(),

                  ShopperSignInActions(onSuccess: _afterSignIn),

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
