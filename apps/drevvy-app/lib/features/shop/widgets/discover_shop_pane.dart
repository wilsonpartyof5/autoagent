import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/discover/discover_shop_controller.dart';
import '../../../data/models/listing.dart';
import 'shop_results.dart';

/// Live Shop results. Empty and error states do not render demo cars.
class DiscoverShopPane extends StatelessWidget {
  const DiscoverShopPane({
    super.key,
    required this.controller,
    required this.onOpen,
    required this.onLocation,
    required this.onFilters,
  });

  final DiscoverShopController controller;
  final ValueChanged<Listing> onOpen;
  final VoidCallback onLocation;
  final VoidCallback onFilters;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final colors = context.drevvy;
        final text = context.drevvyText;
        final location = controller.location;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                DrevvySpace.gutter,
                DrevvySpace.s3,
                DrevvySpace.gutter,
                0,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      location == null
                          ? 'Set a location to search live inventory.'
                          : location.label,
                      style: text.callout.copyWith(color: colors.ink),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton(onPressed: onLocation, child: const Text('Location')),
                  TextButton(onPressed: onFilters, child: const Text('Filters')),
                ],
              ),
            ),
            if (controller.errorMessage != null &&
                controller.phase == DiscoverShopPhase.results)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                child: Text(
                  controller.errorMessage!,
                  style: text.callout.copyWith(color: colors.danger),
                ),
              ),
            Expanded(child: _body(context)),
          ],
        );
      },
    );
  }

  Widget _body(BuildContext context) {
    switch (controller.phase) {
      case DiscoverShopPhase.needsLocation:
        return _message(
          context,
          title: 'Where should Drevvy look?',
          body: 'Use this phone’s location, or search for a city. A ZIP code alone is not a search.',
          action: 'Set location',
          onPressed: onLocation,
        );
      case DiscoverShopPhase.loading:
        return const ShopResults(
          listings: null,
          isLoading: true,
          onListingTap: _ignore,
          showEstimatedMarket: false,
        );
      case DiscoverShopPhase.error:
        return _message(
          context,
          title: 'Couldn’t load cars',
          body: controller.errorMessage ?? 'Drevvy could not load cars.',
          action: 'Retry',
          onPressed: controller.retry,
        );
      case DiscoverShopPhase.empty:
        return _message(
          context,
          title: 'No cars found',
          body: 'Nothing matched that search. Try another filter or a wider radius.',
          action: 'Retry',
          onPressed: controller.retry,
        );
      case DiscoverShopPhase.results:
        return ShopResults(
          listings: controller.listings,
          isLoading: false,
          onListingTap: onOpen,
          showEstimatedMarket: false,
          bottomInset: 140,
          loadingMore: controller.loadingMore,
          onLoadMore: controller.hasNextPage
              ? () => controller.search(reset: false)
              : null,
        );
    }
  }

  Widget _message(
    BuildContext context, {
    required String title,
    required String body,
    required String action,
    required VoidCallback onPressed,
  }) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(DrevvySpace.gutter),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: text.title.copyWith(color: colors.ink), textAlign: TextAlign.center),
            const SizedBox(height: DrevvySpace.s2),
            Text(body, style: text.body.copyWith(color: colors.muted), textAlign: TextAlign.center),
            const SizedBox(height: DrevvySpace.s4),
            TextButton(onPressed: onPressed, child: Text(action)),
          ],
        ),
      ),
    );
  }
}

void _ignore(Listing listing) {}
