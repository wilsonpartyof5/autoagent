import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../widgets/progress_dots.dart';

/// Screen 04: Onboarding - Location pre-prompt
class LocationScreen extends StatefulWidget {
  const LocationScreen({super.key});

  @override
  State<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen> {
  final _zipController = TextEditingController();
  bool _showZipInput = false;

  @override
  void dispose() {
    _zipController.dispose();
    super.dispose();
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

                  const SizedBox(height: DrevvySpace.s4),

                  const ProgressDots(current: 2, total: 5),

                  const Spacer(),

                  // Location illustration
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      gradient: DrevvyColors.brandGradient,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      LucideIcons.mapPin,
                      color: Colors.white,
                      size: 48,
                    ),
                  ),

                  const SizedBox(height: DrevvySpace.s6),

                  Text(
                    'Where are you\nshopping?',
                    style: text.headline,
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: DrevvySpace.s3),

                  Text(
                    'Drevvy uses your location to find nearby\nlistings and estimate local taxes and fees.',
                    style: text.body.copyWith(color: colors.muted),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: DrevvySpace.s6),

                  // Permission bullets
                  _PermissionBullet(
                    icon: LucideIcons.search,
                    text: 'Find cars within your chosen radius',
                  ),
                  const SizedBox(height: DrevvySpace.s3),
                  _PermissionBullet(
                    icon: LucideIcons.receipt,
                    text: 'Estimate sales tax and registration fees',
                  ),
                  const SizedBox(height: DrevvySpace.s3),
                  _PermissionBullet(
                    icon: LucideIcons.shieldCheck,
                    text: 'Never shared with dealers',
                  ),

                  const Spacer(),

                  if (_showZipInput) ...[
                    GlassCard(
                      padding: const EdgeInsets.all(DrevvySpace.s4),
                      child: TextField(
                        controller: _zipController,
                        keyboardType: TextInputType.number,
                        maxLength: 5,
                        decoration: InputDecoration(
                          hintText: 'Enter ZIP code',
                          hintStyle: text.body.copyWith(
                            color: colors.placeholder,
                          ),
                          border: InputBorder.none,
                          counterText: '',
                        ),
                        style: text.body,
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    const SizedBox(height: DrevvySpace.s4),
                    DrevvyButton(
                      label: 'Continue',
                      onPressed: _zipController.text.length == 5
                          ? () => context.push('/onboarding/preferences')
                          : null,
                      isFullWidth: true,
                    ),
                  ] else ...[
                    DrevvyButton(
                      label: 'Allow location',
                      icon: LucideIcons.mapPin,
                      onPressed: () {
                        // TODO: Request location permission
                        context.push('/onboarding/preferences');
                      },
                      isFullWidth: true,
                    ),
                    const SizedBox(height: DrevvySpace.s3),
                    DrevvyButton(
                      label: 'Enter ZIP code instead',
                      variant: DrevvyButtonVariant.secondary,
                      onPressed: () => setState(() => _showZipInput = true),
                      isFullWidth: true,
                    ),
                  ],

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

class _PermissionBullet extends StatelessWidget {
  const _PermissionBullet({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textTheme = context.drevvyText;

    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: colors.lilacTint,
            borderRadius: BorderRadius.circular(DrevvyRadius.xs),
          ),
          child: Icon(icon, color: colors.violet, size: 18),
        ),
        const SizedBox(width: DrevvySpace.s3),
        Expanded(child: Text(text, style: textTheme.body)),
      ],
    );
  }
}
