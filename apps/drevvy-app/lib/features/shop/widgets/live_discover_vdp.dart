import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/listing.dart';
import 'listing_photo.dart';

/// Vehicle detail for a Discover listing shell.
///
/// Shows photos, price, and specs from the public payload. It does not invent
/// a fair price, and it does not open a dealer conversation.
class LiveDiscoverVdp extends StatelessWidget {
  const LiveDiscoverVdp({
    super.key,
    required this.isLoading,
    required this.listing,
    required this.errorMessage,
    required this.onRetry,
  });

  final bool isLoading;
  final Listing? listing;
  final String? errorMessage;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          if (isLoading)
            const Center(child: CircularProgressIndicator())
          else if (listing == null)
            _Error(message: errorMessage ?? 'This listing is not available.', onRetry: onRetry)
          else
            _Body(listing: listing!),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 12,
            child: IconButton(
              icon: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: colors.glassSolid, shape: BoxShape.circle),
                child: Icon(LucideIcons.chevronLeft, color: colors.ink),
              ),
              onPressed: () => context.pop(),
            ),
          ),
        ],
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;
    final colors = context.drevvy;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(DrevvySpace.gutter),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Couldn’t open this car', style: text.title, textAlign: TextAlign.center),
            const SizedBox(height: DrevvySpace.s2),
            Text(message, style: text.body.copyWith(color: colors.muted), textAlign: TextAlign.center),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final location = listing.carLocation;
    final place = [
      if (location?.city != null) location!.city,
      if (location?.state != null) location!.state,
    ].join(', ');
    final features = [
      ...?listing.extra?.features,
      ...?listing.extra?.highValueFeatures,
    ];
    return ListView(
      padding: EdgeInsets.fromLTRB(
        DrevvySpace.gutter,
        MediaQuery.of(context).padding.top + 64,
        DrevvySpace.gutter,
        DrevvySpace.s6,
      ),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(DrevvyRadius.xl),
          child: AspectRatio(
            aspectRatio: 16 / 10,
            child: ListingPhoto(url: listing.media.primaryPhoto),
          ),
        ),
        const SizedBox(height: DrevvySpace.s4),
        Text(listing.title, style: text.headline),
        if (listing.subtitle.isNotEmpty)
          Text(listing.subtitle, style: text.callout.copyWith(color: colors.muted)),
        const SizedBox(height: DrevvySpace.s3),
        Text(listing.priceFormatted, style: text.figureM),
        Text(
          [
            listing.milesFormatted,
            if (listing.distanceFormatted.isNotEmpty) listing.distanceFormatted,
            if (place.isNotEmpty) place,
            if (listing.daysListedFormatted.isNotEmpty) listing.daysListedFormatted,
          ].join(' · '),
          style: text.body.copyWith(color: colors.muted),
        ),
        if (listing.vin.isNotEmpty) ...[
          const SizedBox(height: DrevvySpace.s2),
          Text('VIN ${listing.vin}', style: text.callout.copyWith(color: colors.muted)),
        ],
        const SizedBox(height: DrevvySpace.s6),
        Text('Marketplace Intelligence', style: text.title),
        const SizedBox(height: DrevvySpace.s2),
        Text(
          'Fair price is not part of this listing. Drevvy is not estimating one.',
          style: text.body.copyWith(color: colors.muted),
        ),
        const SizedBox(height: DrevvySpace.s6),
        Text('Key specs', style: text.title),
        const SizedBox(height: DrevvySpace.s2),
        _line(context, 'Body', listing.build.bodyType),
        _line(context, 'Drivetrain', listing.build.drivetrain),
        _line(context, 'Engine', listing.build.engine),
        _line(context, 'City mpg', listing.build.cityMpg?.toString()),
        _line(context, 'Highway mpg', listing.build.highwayMpg?.toString()),
        _line(context, 'Exterior', listing.colors?.exteriorColor),
        _line(context, 'Interior', listing.colors?.interiorColor),
        if (features.isNotEmpty) ...[
          const SizedBox(height: DrevvySpace.s6),
          Text('Features', style: text.title),
          const SizedBox(height: DrevvySpace.s2),
          for (final feature in features.take(12))
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(feature, style: text.body),
            ),
        ],
        const SizedBox(height: DrevvySpace.s6),
        Text(
          'Dealer chat is not opened from this screen.',
          style: text.callout.copyWith(color: colors.muted),
        ),
      ],
    );
  }

  Widget _line(BuildContext context, String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    final text = context.drevvyText;
    final colors = context.drevvy;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: text.callout.copyWith(color: colors.muted))),
          Expanded(child: Text(value, style: text.body)),
        ],
      ),
    );
  }
}
