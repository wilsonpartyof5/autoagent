import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../matters_v5.dart';

/// Single soft blob. Diff: no gradient behind text.
class OnboardingBackground extends StatelessWidget {
  const OnboardingBackground({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final size = MediaQuery.of(context).size;

    return SizedBox.expand(
      child: DecoratedBox(
        decoration: BoxDecoration(color: colors.canvas),
        child: Stack(
          children: [
            Positioned(
              top: -120,
              right: -80,
              child: IgnorePointer(
                child: Container(
                  width: 260,
                  height: 200,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.violet.withValues(alpha: 0.22),
                  ),
                ),
              ),
            ),
            Positioned(
              top: -size.height * 0.04,
              right: -size.width * 0.12,
              child: IgnorePointer(
                child: Container(
                  width: size.width * 0.7,
                  height: size.width * 0.55,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        colors.blobs[0].withValues(alpha: 0.55),
                        colors.blobs[0].withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingProgressHeader extends StatelessWidget {
  const OnboardingProgressHeader({
    super.key,
    required this.stepIndex,
    required this.total,
    this.onBack,
  });

  final int stepIndex;
  final int total;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final n = stepIndex + 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(mattersV5Margin, 6, mattersV5Margin, 0),
      child: Row(
        children: [
          if (onBack != null)
            _RoundBack(onPressed: onBack!)
          else
            const SizedBox(width: 40, height: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: SizedBox(
                    height: 6,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        const ColoredBox(color: Color(0xFFD6DAE8)),
                        FractionallySizedBox(
                          widthFactor: n / total,
                          alignment: Alignment.centerLeft,
                          child: const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: DrevvyColors.brandGradient,
                            ),
                            child: SizedBox.expand(),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$n of $total',
                  style: text.micro.copyWith(
                    color: colors.muted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          const SizedBox(width: 40, height: 40),
        ],
      ),
    );
  }
}

class _RoundBack extends StatelessWidget {
  const _RoundBack({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(LucideIcons.chevronLeft, color: colors.ink, size: 22),
        ),
      ),
    );
  }
}

class OnboardingHeadline extends StatelessWidget {
  const OnboardingHeadline(
    this.text, {
    super.key,
    this.size = 28,
    this.textAlign = TextAlign.start,
  });

  final String text;
  final double size;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: textAlign,
      style: context.drevvyText.headline.copyWith(
        fontSize: size,
        height: 1.15,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
      ),
    );
  }
}

class OnboardingLead extends StatelessWidget {
  const OnboardingLead(this.text, {super.key, this.size = 16});

  final String text;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: context.drevvyText.body.copyWith(
        fontSize: size,
        height: 1.45,
        color: context.drevvy.muted,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

class OnboardingCta extends StatelessWidget {
  const OnboardingCta({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final active = enabled && onPressed != null;

    return Opacity(
      opacity: active ? 1 : 0.38,
      child: GestureDetector(
        onTap: active ? onPressed : null,
        child: Container(
          height: mattersV5CtaHeight,
          decoration: BoxDecoration(
            gradient: DrevvyColors.brandGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: active ? colors.elevBrand : null,
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, color: Colors.white, size: 18),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: text.bodyStrong.copyWith(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OnboardingTextButton extends StatelessWidget {
  const OnboardingTextButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: context.drevvy.violet,
        minimumSize: const Size.fromHeight(44),
        textStyle: context.drevvyText.bodyStrong.copyWith(
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
      child: Text(label),
    );
  }
}

class AnswerCard<T> extends StatelessWidget {
  const AnswerCard({
    super.key,
    required this.choice,
    required this.selected,
    required this.onTap,
    this.compact = false,
  });

  final MattersChoice<T> choice;
  final bool selected;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(mattersV5CardRadius),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          transform: Matrix4.identity()
            ..scaleByDouble(
              selected ? 0.985 : 1.0,
              selected ? 0.985 : 1.0,
              1,
              1,
            ),
          transformAlignment: Alignment.center,
          constraints: BoxConstraints(
            minHeight: compact ? 50 : mattersV5CardMinHeight,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: 16,
            vertical: compact ? 8 : 12,
          ),
          decoration: BoxDecoration(
            color: selected ? colors.lilacTint : Colors.white,
            borderRadius: BorderRadius.circular(mattersV5CardRadius),
            border: Border.all(
              color: selected ? colors.violet : Colors.white,
              width: 2,
            ),
          ),
          child: Row(
            children: [
              if (choice.icon != null) ...[
                _ChoiceIcon(icon: choice.icon!, brand: choice.brandIcon),
                const SizedBox(width: 14),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      choice.label,
                      style: text.cardTitle.copyWith(
                        fontSize: compact ? 15 : 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (choice.sub != null)
                      Text(
                        choice.sub!,
                        style: text.callout.copyWith(
                          color: colors.muted,
                          fontWeight: FontWeight.w500,
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _RadioCheck(selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChoiceIcon extends StatelessWidget {
  const _ChoiceIcon({required this.icon, required this.brand});

  final IconData icon;
  final bool brand;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        gradient: brand ? DrevvyColors.brandGradient : null,
        color: brand ? null : const Color(0xFFEEF1F7),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(
        icon,
        size: 19,
        color: brand ? Colors.white : context.drevvy.ink,
      ),
    );
  }
}

class _RadioCheck extends StatelessWidget {
  const _RadioCheck({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? colors.violet : Colors.transparent,
        border: Border.all(
          color: selected ? colors.violet : const Color(0xFFC9CDE0),
          width: 2,
        ),
      ),
      child: selected
          ? const Icon(LucideIcons.check, size: 13, color: Colors.white)
          : null,
    );
  }
}

class FilterChipButton extends StatelessWidget {
  const FilterChipButton({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          // Hug the label. Center/alignment expands to Wrap's max width,
          // stacking every chip on its own row (iPhone 16 bottom overflow).
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? colors.lilacTint : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? colors.violet : Colors.white,
              width: 2,
            ),
          ),
          child: Text(
            label,
            style: context.drevvyText.bodyStrong.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: selected ? colors.violet : colors.ink,
            ),
          ),
        ),
      ),
    );
  }
}

class OnboardingField extends StatelessWidget {
  const OnboardingField({
    super.key,
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.maxLength,
    this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;
  final int? maxLength;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLength: maxLength,
      onChanged: onChanged,
      style: text.bodyStrong.copyWith(fontSize: 17, color: colors.ink),
      decoration: InputDecoration(
        counterText: '',
        hintText: hint,
        hintStyle: text.body.copyWith(color: colors.placeholder),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(mattersV5CardRadius),
          borderSide: const BorderSide(color: Colors.white, width: 2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(mattersV5CardRadius),
          borderSide: BorderSide(color: colors.violet, width: 2),
        ),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: context.drevvyText.label.copyWith(
        color: context.drevvy.muted,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.6,
        fontSize: 12,
      ),
    );
  }
}
