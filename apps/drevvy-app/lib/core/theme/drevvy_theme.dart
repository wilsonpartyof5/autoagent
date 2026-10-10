// Drevvy Halo theme (spec v1.5 §11). Light + dark ThemeData with ThemeExtensions.
// Depends on drevvy_tokens.dart (generated). Put both in lib/theme/.
import 'dart:ui' show FontFeature, ImageFilter;

import 'package:flutter/material.dart';

import 'drevvy_tokens.dart';

@immutable
class ChipColors {
  const ChipColors(this.fg, this.bg);
  final Color fg;
  final Color bg;
  static ChipColors lerp(ChipColors a, ChipColors b, double t) =>
      ChipColors(Color.lerp(a.fg, b.fg, t)!, Color.lerp(a.bg, b.bg, t)!);
}

/// Semantic colors, chips, gradients and shadows. Read with `context.drevvy`.
@immutable
class DrevvyColors extends ThemeExtension<DrevvyColors> {
  const DrevvyColors({
    required this.canvas,
    required this.blobs,
    required this.glass,
    required this.glassSolid,
    required this.glassBorder,
    required this.tile,
    required this.ink,
    required this.muted,
    required this.placeholder,
    required this.line,
    required this.track,
    required this.violet,
    required this.blue,
    required this.lilacTint,
    required this.onLilacTint,
    required this.mint,
    required this.mintTint,
    required this.accept,
    required this.acceptTint,
    required this.honey,
    required this.fair,
    required this.marketAboveText,
    required this.marketAboveFill,
    required this.marketBelowText,
    required this.marketBelowFill,
    required this.ended,
    required this.endedTint,
    required this.sold,
    required this.soldTint,
    required this.danger,
    required this.dangerBorder,
    required this.strike,
    required this.tabBar,
    required this.tabActiveFill,
    required this.tabInactive,
    required this.scrim,
    required this.progressGradient,
    required this.chips,
    required this.elev1,
    required this.elev2,
    required this.elevBrand,
    required this.elevSheet,
    this.useBlur = true,
  });

  final Color canvas, glass, glassSolid, glassBorder, tile, ink, muted, placeholder, line, track;
  final Color violet, blue, lilacTint, onLilacTint, mint, mintTint, accept, acceptTint, honey, fair;
  final Color marketAboveText, marketAboveFill, marketBelowText, marketBelowFill;
  final Color ended, endedTint, sold, soldTint;
  final Color danger, dangerBorder, strike, tabBar, tabActiveFill, tabInactive, scrim;
  final List<Color> blobs; // violet, blue, lilac ambient blobs
  final LinearGradient progressGradient;
  final Map<DealStatus, ChipColors> chips;
  final List<BoxShadow> elev1, elev2, elevBrand, elevSheet;

  /// false => solid surfaces and no BackdropFilter (spec §5.3 fallback).
  final bool useBlur;

  // Shared in both themes (white text passes AA on it).
  static const brandGradient = DrevvyBrand.gradient;
  static const onBrand = Color(0xFFFFFFFF);
  static const onBrandMuted = Color(0xFFE4E6FF);
  static const glassBlur = DrevvyBlur.glassSigma;

  static Map<DealStatus, ChipColors> _chips(Map<DealStatus, (Color, Color)> m) =>
      {for (final e in m.entries) e.key: ChipColors(e.value.$1, e.value.$2)};

  static final light = DrevvyColors(
    canvas: DrevvyPaletteLight.canvas,
    blobs: const [DrevvyPaletteLight.blobViolet, DrevvyPaletteLight.blobBlue, DrevvyPaletteLight.blobLilac],
    glass: DrevvyPaletteLight.glass,
    glassSolid: DrevvyPaletteLight.glassSolid,
    glassBorder: DrevvyPaletteLight.glassBorder,
    tile: DrevvyPaletteLight.tile,
    ink: DrevvyPaletteLight.ink,
    muted: DrevvyPaletteLight.muted,
    placeholder: DrevvyPaletteLight.placeholder,
    line: DrevvyPaletteLight.line,
    track: DrevvyPaletteLight.track,
    violet: DrevvyPaletteLight.violet,
    blue: DrevvyPaletteLight.blue,
    lilacTint: DrevvyPaletteLight.lilacTint,
    onLilacTint: DrevvyPaletteLight.onLilacTint,
    mint: DrevvyPaletteLight.mint,
    mintTint: DrevvyPaletteLight.mintTint,
    accept: DrevvyPaletteLight.accept,
    acceptTint: DrevvyPaletteLight.acceptTint,
    honey: DrevvyPaletteLight.honey,
    fair: DrevvyPaletteLight.fair,
    marketAboveText: DrevvyPaletteLight.marketAboveText,
    marketAboveFill: DrevvyPaletteLight.marketAboveFill,
    marketBelowText: DrevvyPaletteLight.marketBelowText,
    marketBelowFill: DrevvyPaletteLight.marketBelowFill,
    ended: DrevvyPaletteLight.ended,
    endedTint: DrevvyPaletteLight.endedTint,
    sold: DrevvyPaletteLight.sold,
    soldTint: DrevvyPaletteLight.soldTint,
    danger: DrevvyPaletteLight.danger,
    dangerBorder: DrevvyPaletteLight.dangerBorder,
    strike: DrevvyPaletteLight.strike,
    tabBar: DrevvyPaletteLight.tabBar,
    tabActiveFill: DrevvyPaletteLight.tabActiveFill,
    tabInactive: DrevvyPaletteLight.tabInactive,
    scrim: DrevvyPaletteLight.scrim,
    progressGradient: const LinearGradient(colors: DrevvyPaletteLight.progressGradient),
    chips: _chips(DrevvyPaletteLight.chips),
    elev1: DrevvyPaletteLight.shadows['elev1']!,
    elev2: DrevvyPaletteLight.shadows['elev2']!,
    elevBrand: DrevvyPaletteLight.shadows['elevBrand']!,
    elevSheet: DrevvyPaletteLight.shadows['elevSheet']!,
  );

  static final dark = DrevvyColors(
    canvas: DrevvyPaletteDark.canvas,
    blobs: const [DrevvyPaletteDark.blobViolet, DrevvyPaletteDark.blobBlue, DrevvyPaletteDark.blobLilac],
    glass: DrevvyPaletteDark.glass,
    glassSolid: DrevvyPaletteDark.glassSolid,
    glassBorder: DrevvyPaletteDark.glassBorder,
    tile: DrevvyPaletteDark.tile,
    ink: DrevvyPaletteDark.ink,
    muted: DrevvyPaletteDark.muted,
    placeholder: DrevvyPaletteDark.placeholder,
    line: DrevvyPaletteDark.line,
    track: DrevvyPaletteDark.track,
    violet: DrevvyPaletteDark.violet,
    blue: DrevvyPaletteDark.blue,
    lilacTint: DrevvyPaletteDark.lilacTint,
    onLilacTint: DrevvyPaletteDark.onLilacTint,
    mint: DrevvyPaletteDark.mint,
    mintTint: DrevvyPaletteDark.mintTint,
    accept: DrevvyPaletteDark.accept,
    acceptTint: DrevvyPaletteDark.acceptTint,
    honey: DrevvyPaletteDark.honey,
    fair: DrevvyPaletteDark.fair,
    marketAboveText: DrevvyPaletteDark.marketAboveText,
    marketAboveFill: DrevvyPaletteDark.marketAboveFill,
    marketBelowText: DrevvyPaletteDark.marketBelowText,
    marketBelowFill: DrevvyPaletteDark.marketBelowFill,
    ended: DrevvyPaletteDark.ended,
    endedTint: DrevvyPaletteDark.endedTint,
    sold: DrevvyPaletteDark.sold,
    soldTint: DrevvyPaletteDark.soldTint,
    danger: DrevvyPaletteDark.danger,
    dangerBorder: DrevvyPaletteDark.dangerBorder,
    strike: DrevvyPaletteDark.strike,
    tabBar: DrevvyPaletteDark.tabBar,
    tabActiveFill: DrevvyPaletteDark.tabActiveFill,
    tabInactive: DrevvyPaletteDark.tabInactive,
    scrim: DrevvyPaletteDark.scrim,
    progressGradient: const LinearGradient(colors: DrevvyPaletteDark.progressGradient),
    chips: _chips(DrevvyPaletteDark.chips),
    elev1: DrevvyPaletteDark.shadows['elev1']!,
    elev2: DrevvyPaletteDark.shadows['elev2']!,
    elevBrand: DrevvyPaletteDark.shadows['elevBrand']!,
    elevSheet: DrevvyPaletteDark.shadows['elevSheet']!,
  );

  @override
  DrevvyColors copyWith({bool? useBlur}) => DrevvyColors(
        canvas: canvas, blobs: blobs, glass: glass, glassSolid: glassSolid, glassBorder: glassBorder,
        tile: tile, ink: ink, muted: muted, placeholder: placeholder, line: line, track: track,
        violet: violet, blue: blue, lilacTint: lilacTint, onLilacTint: onLilacTint, mint: mint,
        mintTint: mintTint, accept: accept, acceptTint: acceptTint, honey: honey, fair: fair,
        marketAboveText: marketAboveText, marketAboveFill: marketAboveFill,
        marketBelowText: marketBelowText, marketBelowFill: marketBelowFill,
        ended: ended, endedTint: endedTint, sold: sold, soldTint: soldTint,
        danger: danger, dangerBorder: dangerBorder, strike: strike, tabBar: tabBar,
        tabActiveFill: tabActiveFill, tabInactive: tabInactive, scrim: scrim,
        progressGradient: progressGradient, chips: chips,
        elev1: elev1, elev2: elev2, elevBrand: elevBrand, elevSheet: elevSheet,
        useBlur: useBlur ?? this.useBlur,
      );

  @override
  DrevvyColors lerp(ThemeExtension<DrevvyColors>? other, double t) {
    if (other is! DrevvyColors) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    List<BoxShadow> s(List<BoxShadow> a, List<BoxShadow> b) => BoxShadow.lerpList(a, b, t)!;
    return DrevvyColors(
      canvas: c(canvas, other.canvas),
      blobs: [for (var i = 0; i < blobs.length; i++) c(blobs[i], other.blobs[i])],
      glass: c(glass, other.glass),
      glassSolid: c(glassSolid, other.glassSolid),
      glassBorder: c(glassBorder, other.glassBorder),
      tile: c(tile, other.tile),
      ink: c(ink, other.ink),
      muted: c(muted, other.muted),
      placeholder: c(placeholder, other.placeholder),
      line: c(line, other.line),
      track: c(track, other.track),
      violet: c(violet, other.violet),
      blue: c(blue, other.blue),
      lilacTint: c(lilacTint, other.lilacTint),
      onLilacTint: c(onLilacTint, other.onLilacTint),
      mint: c(mint, other.mint),
      mintTint: c(mintTint, other.mintTint),
      accept: c(accept, other.accept),
      acceptTint: c(acceptTint, other.acceptTint),
      honey: c(honey, other.honey),
      fair: c(fair, other.fair),
      marketAboveText: c(marketAboveText, other.marketAboveText),
      marketAboveFill: c(marketAboveFill, other.marketAboveFill),
      marketBelowText: c(marketBelowText, other.marketBelowText),
      marketBelowFill: c(marketBelowFill, other.marketBelowFill),
      ended: c(ended, other.ended),
      endedTint: c(endedTint, other.endedTint),
      sold: c(sold, other.sold),
      soldTint: c(soldTint, other.soldTint),
      danger: c(danger, other.danger),
      dangerBorder: c(dangerBorder, other.dangerBorder),
      strike: c(strike, other.strike),
      tabBar: c(tabBar, other.tabBar),
      tabActiveFill: c(tabActiveFill, other.tabActiveFill),
      tabInactive: c(tabInactive, other.tabInactive),
      scrim: c(scrim, other.scrim),
      progressGradient: LinearGradient.lerp(progressGradient, other.progressGradient, t)!,
      chips: {for (final st in DealStatus.values) st: ChipColors.lerp(chips[st]!, other.chips[st]!, t)},
      elev1: s(elev1, other.elev1),
      elev2: s(elev2, other.elev2),
      elevBrand: s(elevBrand, other.elevBrand),
      elevSheet: s(elevSheet, other.elevSheet),
      useBlur: t < .5 ? useBlur : other.useBlur,
    );
  }
}

/// Named Halo text styles (spec §3), including the ones Material's TextTheme has no slot for.
@immutable
class DrevvyText extends ThemeExtension<DrevvyText> {
  const DrevvyText({
    required this.display,
    required this.figureXL,
    required this.figureL,
    required this.figureM,
    required this.headline,
    required this.title,
    required this.cardTitle,
    required this.figureS,
    required this.body,
    required this.bodyStrong,
    required this.callout,
    required this.label,
    required this.micro,
  });

  final TextStyle display, figureXL, figureL, figureM, headline, title, cardTitle, figureS;
  final TextStyle body, bodyStrong, callout, label, micro;

  static TextStyle style(DrevvyTypeSpec s, Color color) => TextStyle(
        fontFamily: DrevvyType.fontFamily,
        fontSize: s.size,
        height: s.lineHeight / s.size,
        fontWeight: s.weight,
        letterSpacing: s.letterSpacing,
        color: color,
        fontFeatures: s.tabular ? const [FontFeature.tabularFigures()] : null,
      );

  factory DrevvyText.of(Color ink) => DrevvyText(
        display: style(DrevvyType.display, ink),
        figureXL: style(DrevvyType.figureXL, ink),
        figureL: style(DrevvyType.figureL, ink),
        figureM: style(DrevvyType.figureM, ink),
        headline: style(DrevvyType.headline, ink),
        title: style(DrevvyType.title, ink),
        cardTitle: style(DrevvyType.cardTitle, ink),
        figureS: style(DrevvyType.figureS, ink),
        body: style(DrevvyType.body, ink),
        bodyStrong: style(DrevvyType.bodyStrong, ink),
        callout: style(DrevvyType.callout, ink),
        label: style(DrevvyType.label, ink),
        micro: style(DrevvyType.micro, ink),
      );

  @override
  DrevvyText copyWith() => this;

  @override
  DrevvyText lerp(ThemeExtension<DrevvyText>? other, double t) {
    if (other is! DrevvyText) return this;
    TextStyle l(TextStyle a, TextStyle b) => TextStyle.lerp(a, b, t)!;
    return DrevvyText(
      display: l(display, other.display),
      figureXL: l(figureXL, other.figureXL),
      figureL: l(figureL, other.figureL),
      figureM: l(figureM, other.figureM),
      headline: l(headline, other.headline),
      title: l(title, other.title),
      cardTitle: l(cardTitle, other.cardTitle),
      figureS: l(figureS, other.figureS),
      body: l(body, other.body),
      bodyStrong: l(bodyStrong, other.bodyStrong),
      callout: l(callout, other.callout),
      label: l(label, other.label),
      micro: l(micro, other.micro),
    );
  }
}

TextTheme drevvyTextTheme(Color ink) {
  TextStyle m(DrevvyTypeSpec s) => DrevvyText.style(s, ink);
  return TextTheme(
    displayLarge: m(DrevvyType.figureXL),
    displayMedium: m(DrevvyType.figureL),
    displaySmall: m(DrevvyType.display),
    headlineLarge: m(DrevvyType.figureM),
    headlineMedium: m(DrevvyType.headline),
    titleLarge: m(DrevvyType.title),
    titleMedium: m(DrevvyType.cardTitle),
    titleSmall: m(DrevvyType.figureS),
    bodyLarge: m(DrevvyType.body),
    bodyMedium: m(DrevvyType.bodyStrong),
    bodySmall: m(DrevvyType.callout),
    labelLarge: m(DrevvyType.bodyStrong),
    labelMedium: m(DrevvyType.label),
    labelSmall: m(DrevvyType.micro),
  );
}

ThemeData drevvyTheme(Brightness b, {bool useBlur = true}) {
  final x = (b == Brightness.light ? DrevvyColors.light : DrevvyColors.dark).copyWith(useBlur: useBlur);
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF5B4FE9), brightness: b).copyWith(
    primary: x.violet,
    onPrimary: b == Brightness.light ? Colors.white : const Color(0xFF0D0F1C),
    secondary: x.blue,
    surface: x.glassSolid,
    onSurface: x.ink,
    onSurfaceVariant: x.muted,
    outline: x.line,
    error: x.danger,
    scrim: x.scrim,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: b,
    colorScheme: scheme,
    fontFamily: DrevvyType.fontFamily,
    scaffoldBackgroundColor: x.canvas,
    textTheme: drevvyTextTheme(x.ink),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    dividerTheme: DividerThemeData(color: x.line, thickness: 1, space: 1),
    splashFactory: InkSparkle.splashFactory,
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: x.glassSolid,
      modalBarrierColor: x.scrim,
      showDragHandle: true,
      dragHandleColor: x.track,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(DrevvyRadius.xl)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: const Color(0xFF171A2C),
      contentTextStyle: DrevvyText.style(DrevvyType.callout, Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(DrevvyRadius.md)),
    ),
    extensions: [x, DrevvyText.of(x.ink)],
  );
}

extension DrevvyThemeContext on BuildContext {
  DrevvyColors get drevvy => Theme.of(this).extension<DrevvyColors>()!;
  DrevvyText get drevvyText => Theme.of(this).extension<DrevvyText>()!;
}

/// Glass surface: real blur only when allowed, solid fallback otherwise (spec §5.3).
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.radius = DrevvyRadius.lg,
    this.blur = false,
    this.padding = const EdgeInsets.all(DrevvySpace.s2),
  });

  final Widget child;
  final double radius;
  final bool blur;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final x = context.drevvy;
    final useBlur = blur && x.useBlur && !MediaQuery.highContrastOf(context);
    final box = DecoratedBox(
      decoration: BoxDecoration(
        color: useBlur ? x.glass : x.glassSolid,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: x.glassBorder),
      ),
      child: Padding(padding: padding, child: child),
    );
    final surface = useBlur
        ? ClipRRect(
            borderRadius: BorderRadius.circular(radius),
            // Use BackdropFilter.grouped under a BackdropGroup when several blurred surfaces share a screen.
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: DrevvyColors.glassBlur, sigmaY: DrevvyColors.glassBlur),
              child: box,
            ),
          )
        : box;
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius), boxShadow: x.elev1),
      child: surface,
    );
  }
}

/// Status chip (spec §6.1): tinted pill, 6 pt leading dot, label always present.
class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final DealStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.drevvy.chips[status]!;
    return Semantics(
      label: 'Status: ${status.label}',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(DrevvyRadius.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: c.fg, shape: BoxShape.circle)),
          const SizedBox(width: DrevvySpace.s1 + 2),
          Text(status.label,
              style: context.drevvyText.label.copyWith(color: c.fg, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

// Usage:
// MaterialApp.router(theme: drevvyTheme(Brightness.light), darkTheme: drevvyTheme(Brightness.dark),
//                    themeMode: ThemeMode.system, routerConfig: router)
// context.drevvy.chips[DealStatus.findingBestPrice]!.fg; context.drevvyText.figureL
