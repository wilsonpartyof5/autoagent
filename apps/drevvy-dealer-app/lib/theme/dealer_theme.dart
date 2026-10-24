import 'package:flutter/material.dart';

/// Halo colors, used as a dense work surface. The violet-blue gradient is
/// reserved for the primary button.
abstract final class DealerColors {
  static const canvas = Color(0xFFEEF1F7);
  static const card = Color(0xFFF7F8FC);
  static const ink = Color(0xFF171A2C);
  static const muted = Color(0xFF565D73);
  static const line = Color(0xFFE4E8F1);
  static const violet = Color(0xFF5B4FE9);
  static const blue = Color(0xFF3A6FF0);
  static const onBrand = Color(0xFFFFFFFF);
  static const honey = Color(0xFF8A5300);
  static const honeyTint = Color(0xFFFFF0D6);
  static const info = Color(0xFF2257C0);
  static const infoTint = Color(0xFFE3EEFF);
  static const lilac = Color(0xFF3C30C4);
  static const lilacTint = Color(0xFFECEAFF);
  static const mint = Color(0xFF0F7A55);
  static const danger = Color(0xFFB42828);
  static const ended = Color(0xFF5E5470);
  static const endedTint = Color(0xFFEEEAF3);
  static const sold = Color(0xFF7A4A3A);
  static const soldTint = Color(0xFFF4E9E4);
  static const closed = Color(0xFF4E5568);
  static const closedTint = Color(0xFFE7EAF1);

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [violet, blue],
  );
}

ThemeData dealerTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: DealerColors.violet,
    onPrimary: DealerColors.onBrand,
    secondary: DealerColors.blue,
    onSecondary: DealerColors.onBrand,
    error: DealerColors.danger,
    onError: DealerColors.onBrand,
    surface: DealerColors.card,
    onSurface: DealerColors.ink,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: DealerColors.canvas,
    fontFamily: 'Manrope',
    dividerColor: DealerColors.line,
    appBarTheme: const AppBarTheme(
      backgroundColor: DealerColors.card,
      foregroundColor: DealerColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: DealerColors.card,
      indicatorColor: Color(0xFFECEAFF),
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: DealerColors.canvas,
      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: DealerColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: DealerColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: DealerColors.violet),
      ),
    ),
  );
}
