import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const SizedBox(height: DrevvySpace.s4),
                  _buildHeader(context, colors, text),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSubscriptionBanner(context, colors, text),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Settings',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.palette,
                        label: 'Appearance',
                        trailing: _ProfileTrailingText(text: 'System'),
                        onTap: () {
                          // TODO: Navigate to appearance settings
                        },
                      ),
                      _ProfileRow(
                        icon: LucideIcons.bell,
                        label: 'Notifications',
                        onTap: () {
                          // TODO: Navigate to notification settings
                        },
                      ),
                      _ProfileRow(
                        icon: LucideIcons.shield,
                        label: 'Privacy',
                        onTap: () {
                          // TODO: Navigate to privacy settings
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Subscription',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.creditCard,
                        label: 'Manage subscription',
                        onTap: () {
                          // TODO: RevenueCat subscription management
                        },
                      ),
                      _ProfileRow(
                        icon: LucideIcons.rotateCcw,
                        label: 'Restore purchases',
                        onTap: () {
                          // TODO: RevenueCat restore purchases
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Account',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.user,
                        label: 'Edit profile',
                        onTap: () {
                          // TODO: Navigate to edit profile
                        },
                      ),
                      _ProfileRow(
                        icon: LucideIcons.mail,
                        label: 'Contact support',
                        onTap: () {
                          // TODO: Open support email
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Legal',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.fileText,
                        label: 'Terms of Service',
                        onTap: () {
                          // TODO: Open terms URL
                        },
                      ),
                      _ProfileRow(
                        icon: LucideIcons.lock,
                        label: 'Privacy Policy',
                        onTap: () {
                          // TODO: Open privacy URL
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildDangerSection(context, colors, text),
                  const SizedBox(height: DrevvySpace.rootScrollBottomPadding),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, DrevvyColors colors, DrevvyText text) {
    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: DrevvyBrand.gradient,
            borderRadius: BorderRadius.circular(32),
          ),
          child: Center(
            child: Text(
              'D',
              style: text.headline.copyWith(color: DrevvyColors.onBrand),
            ),
          ),
        ),
        const SizedBox(width: DrevvySpace.s4),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Dana',
                style: text.headline.copyWith(color: colors.ink),
              ),
              const SizedBox(height: DrevvySpace.s1),
              Text(
                'dana.w@example.com',
                style: text.body.copyWith(color: colors.muted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSubscriptionBanner(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(DrevvySpace.s4),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: DrevvySpace.s3,
                vertical: DrevvySpace.s2,
              ),
              decoration: BoxDecoration(
                gradient: DrevvyBrand.gradient,
                borderRadius: BorderRadius.circular(DrevvyRadius.pill),
              ),
              child: Text(
                'Pro',
                style: text.label.copyWith(color: DrevvyColors.onBrand),
              ),
            ),
            const SizedBox(width: DrevvySpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Drevvy Pro',
                    style: text.bodyStrong.copyWith(color: colors.ink),
                  ),
                  Text(
                    '3 of 10 cars used · resets Oct 20',
                    style: text.label.copyWith(color: colors.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text, {
    required String title,
    required List<_ProfileRow> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: DrevvySpace.s1,
            bottom: DrevvySpace.s3,
          ),
          child: Text(
            title,
            style: text.label.copyWith(color: colors.muted),
          ),
        ),
        GlassCard(
          child: Column(
            children: [
              for (int i = 0; i < items.length; i++) ...[
                items[i].build(context, colors, text),
                if (i < items.length - 1)
                  Divider(
                    height: 1,
                    color: colors.line,
                    indent: DrevvySpace.s4 + 24 + DrevvySpace.s3,
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDangerSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    return GlassCard(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            // TODO: Show sign out confirmation
          },
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          child: Padding(
            padding: const EdgeInsets.all(DrevvySpace.s4),
            child: Row(
              children: [
                Icon(
                  LucideIcons.logOut,
                  size: 24,
                  color: colors.danger,
                ),
                const SizedBox(width: DrevvySpace.s3),
                Text(
                  'Sign out',
                  style: text.body.copyWith(color: colors.danger),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileRow {
  const _ProfileRow({
    required this.icon,
    required this.label,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Widget? trailing;
  final VoidCallback? onTap;

  Widget build(BuildContext context, DrevvyColors colors, DrevvyText text) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(DrevvySpace.s4),
          child: Row(
            children: [
              Icon(
                icon,
                size: 24,
                color: colors.muted,
              ),
              const SizedBox(width: DrevvySpace.s3),
              Expanded(
                child: Text(
                  label,
                  style: text.body.copyWith(color: colors.ink),
                ),
              ),
              if (trailing != null) trailing!,
              const SizedBox(width: DrevvySpace.s2),
              Icon(
                LucideIcons.chevronRight,
                size: 20,
                color: colors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileTrailingText extends StatelessWidget {
  const _ProfileTrailingText({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Text(
      text,
      style: textStyle.label.copyWith(color: colors.muted),
    );
  }
}
