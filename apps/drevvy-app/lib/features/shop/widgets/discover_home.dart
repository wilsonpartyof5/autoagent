import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/shop_bottom_chrome.dart';
import '../../../data/models/listing.dart';
import 'listing_photo.dart';

/// Discover home: ask hero, starter chips, and cars near you.
///
/// The ask box is drawn by [ShopComposerOverlay], docked at the bottom.
class DiscoverHome extends StatelessWidget {
  const DiscoverHome({
    super.key,
    required this.cars,
    required this.loading,
    required this.savedIds,
    required this.onChip,
    required this.onOpen,
    required this.onSave,
    this.unavailableTitle,
    this.unavailableMessage,
    this.locationPrompt,
    this.onLocation,
    this.emptyMessage,
  });

  final List<Listing> cars;
  final bool loading;
  final Set<String> savedIds;
  final ValueChanged<String> onChip;
  final ValueChanged<Listing> onOpen;
  final void Function(Listing listing, bool saved) onSave;
  final String? unavailableTitle;
  final String? unavailableMessage;
  final String? locationPrompt;
  final VoidCallback? onLocation;
  final String? emptyMessage;

  static const chips = [
    'Is this a fair price?',
    'Cars under \$25k',
    'Best family SUV',
  ];

  @override
  Widget build(BuildContext context) {
    final keyboard = _keyboardOpen(context);
    final safe = MediaQuery.paddingOf(context).bottom;
    final clearance = DrevvySpace.composerMinHeight + 8 + safe + 16;
    final text = context.drevvyText;
    final colors = context.drevvy;
    final orb = keyboard ? 58.0 : 84.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          key: const Key('discover-home'),
          padding: EdgeInsets.fromLTRB(16, keyboard ? 2 : 8, 16, clearance),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: (constraints.maxHeight - clearance).clamp(0, double.infinity),
            ),
            child: Column(
              children: [
                Container(
                  width: orb,
                  height: orb,
                  margin: EdgeInsets.only(top: keyboard ? 4 : 12, bottom: keyboard ? 10 : 16),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      center: Alignment(-0.3, -0.4),
                      radius: 0.9,
                      colors: [
                        Color(0xFFFFFFFF),
                        Color(0xFFA9B4FF),
                        Color(0xFF5B4FE9),
                        Color(0xFF3A6FF0),
                      ],
                      stops: [0, 0.25, 0.6, 1],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x595B4FE9),
                        blurRadius: 40,
                        offset: Offset(0, 12),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Ask me about cars',
                  textAlign: TextAlign.center,
                  style: text.headline.copyWith(
                    fontSize: keyboard ? 24 : 26,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'I help you find a car and a fair price.',
                  textAlign: TextAlign.center,
                  style: text.body.copyWith(color: colors.muted),
                ),
                SizedBox(height: keyboard ? 12 : 18),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final chip in chips)
                      _Chip(label: chip, onTap: () => onChip(chip)),
                  ],
                ),
                if (!keyboard) ...[
                  const SizedBox(height: 18),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 10),
                      child: Text(
                        'Cars near you',
                        style: text.callout.copyWith(
                          color: colors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  _carsBody(context, colors, text),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  bool _keyboardOpen(BuildContext context) {
    if (MediaQuery.viewInsetsOf(context).bottom > 0) return true;
    final model = ShopBottomChromeScope.maybeOf(context);
    return (model?.keyboardInset ?? 0) > 0;
  }

  Widget _carsBody(BuildContext context, DrevvyColors colors, DrevvyText text) {
    final title = unavailableTitle;
    if (title != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
        child: Column(
          children: [
            Text(title, style: text.title, textAlign: TextAlign.center),
            if (unavailableMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                unavailableMessage!,
                style: text.body.copyWith(color: colors.muted),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      );
    }
    if (locationPrompt != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Text(
              locationPrompt!,
              style: text.body.copyWith(color: colors.muted),
              textAlign: TextAlign.center,
            ),
            if (onLocation != null) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: onLocation,
                child: const Text('Set a location'),
              ),
            ],
          ],
        ),
      );
    }
    if (loading && cars.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (cars.isEmpty) {
      return Padding(
        key: const Key('cars-near-you-empty'),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Text(
          emptyMessage ?? 'No cars near you yet.',
          style: text.body.copyWith(color: colors.muted),
          textAlign: TextAlign.center,
        ),
      );
    }
    return Column(
      children: [
        for (var index = 0; index < cars.length; index += 2) ...[
          if (index > 0) const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _car(cars[index])),
              const SizedBox(width: 10),
              Expanded(
                child: index + 1 < cars.length
                    ? _car(cars[index + 1])
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _car(Listing listing) {
    final saved = savedIds.contains(listing.id);
    return _NearbyCarCard(
      listing: listing,
      saved: saved,
      onOpen: () => onOpen(listing),
      onSave: () => onSave(listing, saved),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(DrevvyRadius.pill),
      elevation: 1,
      shadowColor: const Color(0x12283278),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(label, style: text.bodyStrong.copyWith(fontSize: 14)),
          ),
        ),
      ),
    );
  }
}

class _NearbyCarCard extends StatelessWidget {
  const _NearbyCarCard({
    required this.listing,
    required this.saved,
    required this.onOpen,
    required this.onSave,
  });

  final Listing listing;
  final bool saved;
  final VoidCallback onOpen;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final miles = listing.miles == null ? null : listing.milesFormatted;
    final away = listing.dist == null ? null : listing.distanceFormatted;
    final meta = [
      if (miles != null && miles.isNotEmpty) miles,
      if (away != null && away.isNotEmpty) away,
    ].join(' · ');

    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(16),
      elevation: 1,
      shadowColor: const Color(0x1428305A),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 96,
                  width: double.infinity,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: ListingPhoto(url: listing.media.primaryPhoto),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: SaveHeartButton(
                          saved: saved,
                          onPressed: onSave,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                nearbyCarTitle(listing),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: text.bodyStrong.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                ),
              ),
              if (listing.price != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    listing.priceFormatted,
                    style: text.bodyStrong.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              if (meta.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    meta,
                    style: text.micro.copyWith(
                      color: colors.muted,
                      fontWeight: FontWeight.w600,
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

/// Title plus the powertrain when the model name does not already say it.
String nearbyCarTitle(Listing listing) {
  final power = listing.build.powertrainType?.trim();
  final base = listing.title;
  if (power == null || power.isEmpty) return base;
  if (base.toLowerCase().contains(power.toLowerCase())) return base;
  return '$base $power';
}

class SaveHeartButton extends StatelessWidget {
  const SaveHeartButton({
    super.key,
    required this.saved,
    required this.onPressed,
  });

  final bool saved;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    return Semantics(
      label: saved ? 'Saved' : 'Save',
      button: true,
      child: SizedBox(
        width: 44,
        height: 44,
        child: Center(
          child: Material(
            color: const Color(0xF5FFFFFF),
            shape: const CircleBorder(),
            elevation: 1,
            shadowColor: const Color(0x29141632),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onPressed,
              child: SizedBox(
                width: 30,
                height: 30,
                child: Icon(
                  saved ? Icons.favorite : Icons.favorite_border,
                  size: 16,
                  color: saved ? const Color(0xFFE24B6A) : colors.ink,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
