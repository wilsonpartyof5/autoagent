import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/car_pack.dart';
import '../../../data/models/money_format.dart';

/// Four full-width pack rows, order 1 · 5 · 10 · 25.
/// The 10-pack carries the RECOMMENDED badge. The same column is used on the
/// paywall, the Out of keys sheet, and Account → Buy keys.
class PackPickerColumn extends StatelessWidget {
  const PackPickerColumn({
    super.key,
    required this.selected,
    required this.onSelected,
    this.totalLabel,
    this.perCarLabel,
  });

  static const footnote =
      'Savings are per key, compared with the 1-key price. Packs are one-time and never expire.';

  static const rowGap = 10.0;

  final CarPackType selected;
  final ValueChanged<CarPackType> onSelected;
  final String Function(CarPackType pack)? totalLabel;
  final String Function(CarPackType pack)? perCarLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final packs = CarPackType.values;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < packs.length; index++) ...[
          if (index > 0) const SizedBox(height: rowGap),
          PackOptionCard(
            pack: packs[index],
            isSelected: selected == packs[index],
            showBadge: packs[index] == CarPackType.bestValue,
            totalLabel: totalLabel?.call(packs[index]),
            perCarLabel: perCarLabel?.call(packs[index]),
            onTap: () => onSelected(packs[index]),
          ),
        ],
        const SizedBox(height: 8),
        Text(
          footnote,
          style: text.callout.copyWith(
            color: colors.muted,
            fontSize: 12,
            height: 1.3,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

/// One compact full-width pack row.
class PackOptionCard extends StatelessWidget {
  const PackOptionCard({
    super.key,
    required this.pack,
    required this.isSelected,
    required this.onTap,
    this.showBadge = false,
    this.totalLabel,
    this.perCarLabel,
  });

  final CarPackType pack;
  final bool isSelected;
  final VoidCallback onTap;
  final bool showBadge;
  final String? totalLabel;
  final String? perCarLabel;

  static const _border = Color(0xFFDCE1EC);
  static const _selectedBorder = Color(0xFF5B4FE9);
  static const _ring = Color(0xFFECEAFF);
  static const _chipFg = Color(0xFF1E7A4F);
  static const _chipBg = Color(0xFFE3F6EC);
  static const _bestPerCar = Color(0xFF4B3FD9);

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final total = totalLabel ?? formatUsd(pack.priceUsd);
    final perCar = perCarLabel ?? '${pack.perKeyFormatted}/key';
    final light = Theme.of(context).brightness == Brightness.light;
    final ring = isSelected ? 4.0 : 0.0;
    final savings = pack.savingsText;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: EdgeInsets.all(ring),
          decoration: BoxDecoration(
            color: isSelected
                ? (light ? _ring : colors.lilacTint)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(24 + ring),
          ),
          child: Material(
            color: colors.tile,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(24),
              child: Container(
                constraints: const BoxConstraints(minHeight: 52),
                padding: const EdgeInsets.symmetric(
                  vertical: 7,
                  horizontal: 14,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: isSelected
                        ? (light ? _selectedBorder : colors.violet)
                        : (light ? _border : colors.line),
                    width: isSelected ? 2 : 1.5,
                  ),
                ),
                child: Row(
                  children: [
                    _Radio(selected: isSelected, light: light),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${pack.keysLabel} · ${pack.displayName}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: DrevvyType.fontFamily,
                              fontSize: 15.5,
                              fontWeight: FontWeight.w800,
                              height: 1.15,
                              color: colors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          if (savings != null)
                            _SavingsChip(label: savings, light: light)
                          else
                            Text(
                              'One-time · never expires',
                              style: TextStyle(
                                fontFamily: DrevvyType.fontFamily,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                height: 1.15,
                                color: colors.muted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          total,
                          style: TextStyle(
                            fontFamily: DrevvyType.fontFamily,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            height: 1.05,
                            letterSpacing: -0.4,
                            color: colors.ink,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        Text(
                          perCar,
                          style: TextStyle(
                            fontFamily: DrevvyType.fontFamily,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            height: 1.15,
                            color: pack == CarPackType.bestValue
                                ? (light ? _bestPerCar : colors.violet)
                                : colors.muted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (showBadge)
          const Positioned(top: -10, left: 16, child: _BestValueBadge()),
      ],
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected, required this.light});

  final bool selected;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final color = selected
        ? (light ? PackOptionCard._selectedBorder : context.drevvy.violet)
        : (light ? PackOptionCard._border : context.drevvy.line);
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: selected ? 2 : 1.5),
        color: selected ? color : Colors.transparent,
      ),
      child: selected
          ? const Icon(LucideIcons.check, size: 12, color: Colors.white)
          : null,
    );
  }
}

class _SavingsChip extends StatelessWidget {
  const _SavingsChip({required this.label, required this.light});

  final String label;
  final bool light;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: light ? PackOptionCard._chipBg : context.drevvy.mintTint,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontFamily: DrevvyType.fontFamily,
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          height: 1.15,
          color: light ? PackOptionCard._chipFg : context.drevvy.mint,
        ),
      ),
    );
  }
}

class _BestValueBadge extends StatelessWidget {
  const _BestValueBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        gradient: DrevvyColors.brandGradient,
        borderRadius: BorderRadius.circular(7),
      ),
      child: const Text(
        'RECOMMENDED',
        style: TextStyle(
          fontFamily: DrevvyType.fontFamily,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          height: 1.1,
          letterSpacing: 0.3,
          color: Colors.white,
        ),
      ),
    );
  }
}
