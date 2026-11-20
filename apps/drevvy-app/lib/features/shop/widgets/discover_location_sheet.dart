import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/location/location_sources.dart';
import '../../../data/location/shop_location.dart';

/// Device fix or a geocoder place the shopper taps. Nothing here invents coordinates.
class DiscoverLocationSheet extends StatefulWidget {
  const DiscoverLocationSheet({
    super.key,
    required this.device,
    required this.places,
  });

  final DeviceLocationSource device;
  final PlaceSearch places;

  static Future<ShopLocation?> show(
    BuildContext context, {
    required DeviceLocationSource device,
    required PlaceSearch places,
  }) {
    return showModalBottomSheet<ShopLocation>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DiscoverLocationSheet(device: device, places: places),
    );
  }

  @override
  State<DiscoverLocationSheet> createState() => _DiscoverLocationSheetState();
}

class _DiscoverLocationSheetState extends State<DiscoverLocationSheet> {
  final _query = TextEditingController();
  List<ShopLocation> _places = const [];
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _useDevice() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final location = await widget.device.current();
      if (!mounted) return;
      Navigator.pop(context, location);
    } on LocationFailure catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _searchPlaces() async {
    setState(() {
      _busy = true;
      _error = null;
      _places = const [];
    });
    try {
      final places = await widget.places.search(_query.text);
      if (!mounted) return;
      setState(() => _places = places);
    } on LocationFailure catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Material(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(DrevvyRadius.sheetTop)),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Search near', style: text.title),
                const SizedBox(height: DrevvySpace.s2),
                Text(
                  'Use this phone, or search a city and pick a result. Drevvy does not guess a point from a ZIP.',
                  style: text.callout.copyWith(color: colors.muted),
                ),
                const SizedBox(height: DrevvySpace.s4),
                TextButton(
                  onPressed: _busy ? null : _useDevice,
                  child: const Text('Use my location'),
                ),
                TextField(
                  controller: _query,
                  textInputAction: TextInputAction.search,
                  decoration: const InputDecoration(hintText: 'City or place'),
                  onSubmitted: (_) => _searchPlaces(),
                ),
                const SizedBox(height: DrevvySpace.s2),
                TextButton(
                  onPressed: _busy ? null : _searchPlaces,
                  child: const Text('Search places'),
                ),
                if (_error != null)
                  Text(_error!, style: text.callout.copyWith(color: colors.danger)),
                for (final place in _places)
                  ListTile(
                    title: Text(place.label),
                    subtitle: Text(
                      '${place.latitude.toStringAsFixed(4)}, ${place.longitude.toStringAsFixed(4)}',
                    ),
                    onTap: () => Navigator.pop(context, place),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
