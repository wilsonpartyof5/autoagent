import 'package:flutter/material.dart';
import '../theme/drevvy_theme.dart';
import '../theme/drevvy_tokens.dart';

enum DrevvyButtonVariant { primary, secondary, tertiary, destructive, compactPill, accept }

class DrevvyButton extends StatefulWidget {
  const DrevvyButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.variant = DrevvyButtonVariant.primary,
    this.isLoading = false,
    this.isFullWidth = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final DrevvyButtonVariant variant;
  final bool isLoading;
  final bool isFullWidth;

  @override
  State<DrevvyButton> createState() => _DrevvyButtonState();
}

class _DrevvyButtonState extends State<DrevvyButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: DrevvyMotion.buttonPress.duration,
      reverseDuration: DrevvyMotion.buttonPress.reverseDuration,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: DrevvyMotion.buttonPress.curve),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    if (widget.onPressed != null && !widget.isLoading) {
      setState(() => _isPressed = true);
      _controller.forward();
    }
  }

  void _handleTapUp(TapUpDetails details) {
    setState(() => _isPressed = false);
    _controller.reverse();
  }

  void _handleTapCancel() {
    setState(() => _isPressed = false);
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final enabled = widget.onPressed != null && !widget.isLoading;
    
    final height = switch (widget.variant) {
      DrevvyButtonVariant.primary || DrevvyButtonVariant.secondary || DrevvyButtonVariant.accept => DrevvySpace.ctaHeight,
      DrevvyButtonVariant.tertiary || DrevvyButtonVariant.destructive => DrevvySpace.tertiaryHeight,
      DrevvyButtonVariant.compactPill => DrevvySpace.compactPillHeight,
    };

    final radius = widget.variant == DrevvyButtonVariant.compactPill
        ? DrevvyRadius.pill
        : DrevvyRadius.md;

    final (bgDecoration, textColor, borderColor, shadow) = switch (widget.variant) {
      DrevvyButtonVariant.primary => (
          BoxDecoration(gradient: DrevvyColors.brandGradient, borderRadius: BorderRadius.circular(radius)),
          Colors.white,
          null as Color?,
          colors.elevBrand,
        ),
      DrevvyButtonVariant.secondary => (
          BoxDecoration(color: colors.tile, borderRadius: BorderRadius.circular(radius)),
          colors.ink,
          colors.glassBorder,
          <BoxShadow>[],
        ),
      DrevvyButtonVariant.tertiary => (
          BoxDecoration(color: Colors.white.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(radius)),
          colors.ink,
          const Color(0xFFD6DBE7),
          <BoxShadow>[],
        ),
      DrevvyButtonVariant.destructive => (
          BoxDecoration(color: Colors.white.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(radius)),
          colors.danger,
          colors.dangerBorder,
          <BoxShadow>[],
        ),
      DrevvyButtonVariant.compactPill => (
          BoxDecoration(gradient: DrevvyColors.brandGradient, borderRadius: BorderRadius.circular(radius)),
          Colors.white,
          null,
          colors.elevBrand,
        ),
      DrevvyButtonVariant.accept => (
          BoxDecoration(color: colors.accept, borderRadius: BorderRadius.circular(radius)),
          Colors.white,
          null as Color?,
          colors.elev1,
        ),
    };

    final fontSize = widget.variant == DrevvyButtonVariant.compactPill ? 14.0 : 16.0;

    Widget child = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.icon != null && !widget.isLoading) ...[
          Icon(widget.icon, size: 20, color: textColor),
          const SizedBox(width: DrevvySpace.s2),
        ],
        if (widget.isLoading)
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation(textColor),
            ),
          )
        else
          Text(
            widget.label,
            style: text.bodyStrong.copyWith(
              color: textColor,
              fontSize: fontSize,
              fontWeight: FontWeight.w800,
            ),
          ),
      ],
    );

    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      onTap: enabled ? widget.onPressed : null,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: Opacity(
              opacity: enabled ? 1.0 : 0.4,
              child: Container(
                height: height,
                constraints: widget.isFullWidth ? null : const BoxConstraints(minWidth: 120),
                width: widget.isFullWidth ? double.infinity : null,
                decoration: bgDecoration.copyWith(
                  border: borderColor != null ? Border.all(color: borderColor) : null,
                  boxShadow: enabled ? shadow : null,
                ),
                child: Stack(
                  children: [
                    if (_isPressed)
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(radius),
                          ),
                        ),
                      ),
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s4),
                        child: child,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
        child: child,
      ),
    );
  }
}

class DrevvyPrimaryButton extends StatelessWidget {
  const DrevvyPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return DrevvyButton(
      label: label,
      onPressed: onPressed,
      icon: icon,
      variant: DrevvyButtonVariant.primary,
      isLoading: isLoading,
      isFullWidth: true,
    );
  }
}

class DrevvyGhostButton extends StatelessWidget {
  const DrevvyGhostButton({
    super.key,
    required this.label,
    this.onPressed,
    this.color,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;
    final colors = context.drevvy;
    
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        height: DrevvySpace.minTap,
        padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s4),
        child: Center(
          child: Text(
            label,
            style: text.bodyStrong.copyWith(color: color ?? colors.violet),
          ),
        ),
      ),
    );
  }
}
