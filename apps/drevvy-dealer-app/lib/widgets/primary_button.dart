import 'package:flutter/material.dart';

import '../theme/dealer_theme.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.buttonKey,
  });

  final String label;
  final VoidCallback? onPressed;
  final Key? buttonKey;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: enabled ? DealerColors.brandGradient : null,
        color: enabled
            ? null
            : Theme.of(context).brightness == Brightness.dark
                ? const Color(0x33FFFFFF)
                : const Color(0xFFD6DBE7),
        borderRadius: BorderRadius.circular(20),
        boxShadow: enabled
            ? const [
                BoxShadow(
                  color: Color(0x4C4650DC),
                  blurRadius: 24,
                  offset: Offset(0, 10),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: buttonKey,
          onTap: onPressed,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Center(
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
