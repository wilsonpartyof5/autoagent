import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';

class ErrorScreen extends StatelessWidget {
  const ErrorScreen({
    super.key,
    this.code,
    this.message,
  });

  final String? code;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(DrevvySpace.gutter),
          child: Column(
            children: [
              const SizedBox(height: DrevvySpace.s8),
              Row(
                children: [
                  IconButton(
                    onPressed: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/shop');
                      }
                    },
                    icon: Icon(
                      LucideIcons.arrowLeft,
                      color: colors.ink,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: colors.dangerBorder,
                  borderRadius: BorderRadius.circular(DrevvyRadius.lg),
                ),
                child: Icon(
                  LucideIcons.triangleAlert,
                  size: 40,
                  color: colors.danger,
                ),
              ),
              const SizedBox(height: DrevvySpace.s6),
              Text(
                'Something went wrong',
                style: text.headline.copyWith(color: colors.ink),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: DrevvySpace.s3),
              Text(
                message ?? 'We ran into a problem. Please try again.',
                style: text.body.copyWith(color: colors.muted),
                textAlign: TextAlign.center,
              ),
              if (code != null) ...[
                const SizedBox(height: DrevvySpace.s4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: DrevvySpace.s3,
                    vertical: DrevvySpace.s2,
                  ),
                  decoration: BoxDecoration(
                    color: colors.tile,
                    borderRadius: BorderRadius.circular(DrevvyRadius.xs),
                  ),
                  child: Text(
                    'Error code: $code',
                    style: text.label.copyWith(color: colors.muted),
                  ),
                ),
              ],
              const Spacer(),
              DrevvyPrimaryButton(
                label: 'Try again',
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/shop');
                  }
                },
              ),
              const SizedBox(height: DrevvySpace.s3),
              DrevvyGhostButton(
                label: 'Go back',
                onPressed: () {
                  context.go('/shop');
                },
              ),
              const SizedBox(height: DrevvySpace.s8),
            ],
          ),
        ),
      ),
    );
  }
}
