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
  static const honeyTint = Color(0x29D9A23E);
  static const mint = Color(0xFF1FBF7A);
  static const danger = Color(0xFFF06A78);
  static const chat = Color(0xFF3AA6E0);

  /// Web chip twins: new / chat / wait / sold / closed.
  static const lilac = Color(0xFF8E86FF);
  static const lilacTint = Color(0x298E86FF);
  static const info = Color(0xFF3AA6E0);
  static const infoTint = Color(0x293AA6E0);
  static const sold = Color(0xFF1FBF7A);
  static const soldTint = Color(0x291FBF7A);
  static const closed = Color(0xFFF06A78);
  static const closedTint = Color(0x29F06A78);
  static const ended = Color(0xFFF06A78);
  static const endedTint = Color(0x29F06A78);

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

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color canvasOf(BuildContext context) =>
      isDark(context) ? canvasDark : canvasLight;

  static Color cardOf(BuildContext context) =>
      isDark(context) ? const Color(0xB81E2138) : glassLight;

  static Color inkOf(BuildContext context) =>
      isDark(context) ? inkDark : inkLight;

  static Color mutedOf(BuildContext context) =>
      isDark(context) ? mutedDark : mutedLight;

  static Color lineOf(BuildContext context) =>
      isDark(context) ? borderDark : borderLight;

  static Color accentOf(BuildContext context) =>
      isDark(context) ? accentDark : accentLight;

  static BoxDecoration cardDecoration(BuildContext context, {double radius = 20}) {
    return BoxDecoration(
      color: cardOf(context),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: lineOf(context)),
    );
  }
}

class DealerThemeController extends InheritedWidget {
  const DealerThemeController({
    super.key,
    required this.mode,
    required this.setMode,
    required super.child,
  });

  final ThemeMode mode;
  final ValueChanged<ThemeMode> setMode;

  bool get isDark => mode != ThemeMode.light;

  static DealerThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<DealerThemeController>();
    if (scope == null) {
      throw StateError('DealerThemeController missing');
    }
    return scope;
  }

  @override
  bool updateShouldNotify(DealerThemeController oldWidget) => mode != oldWidget.mode;
}

class DealerThemeToggle extends StatelessWidget {
  const DealerThemeToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = DealerThemeController.of(context);
    final dark = scope.isDark;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DealerColors.isDark(context)
            ? const Color(0x4D000000)
            : const Color(0x0D161A2B),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: DealerColors.lineOf(context)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ThemeChoice(
            label: 'Dark',
            selected: dark,
            onTap: () => scope.setMode(ThemeMode.dark),
          ),
          _ThemeChoice(
            label: 'Light',
            selected: !dark,
            onTap: () => scope.setMode(ThemeMode.light),
          ),
        ],
      ),
    );
  }
}

class _ThemeChoice extends StatelessWidget {
  const _ThemeChoice({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? DealerColors.inkOf(context) : Colors.transparent,
      shape: const StadiumBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const StadiumBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected
                  ? DealerColors.canvasOf(context)
                  : DealerColors.mutedOf(context),
            ),
          ),
        ),
      ),
    );
  }
}

ThemeData dealerTheme({Brightness brightness = Brightness.dark}) {
  final dark = brightness == Brightness.dark;
  final ink = dark ? DealerColors.inkDark : DealerColors.inkLight;
  final muted = dark ? DealerColors.mutedDark : DealerColors.mutedLight;
  final canvas = dark ? DealerColors.canvasDark : DealerColors.canvasLight;
  final card = dark ? const Color(0xB81E2138) : DealerColors.glassLight;
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
      backgroundColor: dark ? const Color(0xF007080C) : const Color(0xF0F4F6FB),
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
      backgroundColor: dark ? const Color(0x14FFFFFF) : const Color(0x14161A2B),
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
