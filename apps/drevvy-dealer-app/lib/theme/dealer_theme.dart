import 'package:flutter/material.dart';

/// Locked glass tokens from Glass-Review-Preview assets/glass.css.
abstract final class DealerColors {
  static const canvasDark = Color(0xFF07080C);
  static const canvasLight = Color(0xFFF4F6FB);
  static const inkDark = Color(0xFFE8EAF2);
  static const inkLight = Color(0xFF161A2B);
  static const mutedDark = Color(0xFF8A90A6);
  static const mutedLight = Color(0xFF5E6478);
  static const glassDark = Color(0x2E1E2138);
  static const glassLight = Color(0xC7FFFFFF);
  static const borderDark = Color(0x1FFFFFFF);
  static const borderLight = Color(0x17161A2B);
  static const accentDark = Color(0xFF8E86FF);
  static const accentLight = Color(0xFF5145DB);
  static const violet = Color(0xFF5B4FE9);
  static const blue = Color(0xFF3563E0);
  static const haloStart = Color(0xFF5145DB);
  static const haloEnd = Color(0xFF3563E0);
  static const onBrand = Color(0xFFFFFFFF);
  static const honey = Color(0xFFD9A23E);
  static const mint = Color(0xFF1FBF7A);
  static const danger = Color(0xFFF06A78);
  static const chat = Color(0xFF3AA6E0);

  static const canvas = canvasDark;
  static const card = Color(0xB81E2138);
  static const ink = inkDark;
  static const muted = mutedDark;
  static const line = borderDark;

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [haloStart, haloEnd],
  );
}

ThemeData dealerTheme({Brightness brightness = Brightness.dark}) {
  final dark = brightness == Brightness.dark;
  final ink = dark ? DealerColors.inkDark : DealerColors.inkLight;
  final muted = dark ? DealerColors.mutedDark : DealerColors.mutedLight;
  final canvas = dark ? DealerColors.canvasDark : DealerColors.canvasLight;
  final card = dark ? const Color(0xB81E2138) : const Color(0xC7FFFFFF);
  final line = dark ? DealerColors.borderDark : DealerColors.borderLight;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: DealerColors.violet,
    onPrimary: DealerColors.onBrand,
    secondary: DealerColors.blue,
    onSecondary: DealerColors.onBrand,
    error: DealerColors.danger,
    onError: DealerColors.onBrand,
    surface: card,
    onSurface: ink,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    fontFamily: 'Manrope',
    dividerColor: line,
    appBarTheme: AppBarTheme(
      backgroundColor: card,
      foregroundColor: ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xF005060E) : const Color(0xF0171A2C),
      indicatorColor: const Color(0x388B82FF),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? Colors.white : muted);
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: selected ? Colors.white : muted,
        );
      }),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: dark ? const Color(0x14FFFFFF) : const Color(0x14FFFFFF),
      selectedColor: DealerColors.violet,
      labelStyle: TextStyle(color: ink, fontWeight: FontWeight.w700, fontSize: 12),
      side: BorderSide(color: line),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0x0AFFFFFF) : const Color(0x99FFFFFF),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: const BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: const BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: line),
      ),
      focusedBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: DealerColors.violet),
      ),
    ),
  );
}
