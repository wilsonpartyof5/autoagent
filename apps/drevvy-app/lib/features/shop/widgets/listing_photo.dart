import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';

/// Listing photo. Network URLs stay network URLs. Asset paths stay assets.
/// The error state does not reveal the photo URL.
class ListingPhoto extends StatelessWidget {
  const ListingPhoto({super.key, required this.url, this.fit = BoxFit.cover});

  final String? url;
  final BoxFit fit;

  bool get _isNetwork {
    final value = url;
    if (value == null) return false;
    return value.startsWith('https://') || value.startsWith('http://');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final value = url;
    if (value == null || value.isEmpty) return _broken(colors);
    if (_isNetwork) {
      return CachedNetworkImage(
        imageUrl: value,
        fit: fit,
        placeholder: (_, _) => ColoredBox(color: colors.glassSolid),
        errorWidget: (_, _, _) => _broken(colors),
      );
    }
    return Image.asset(
      value,
      fit: fit,
      errorBuilder: (_, _, _) => _broken(colors),
    );
  }

  Widget _broken(DrevvyColors colors) {
    return ColoredBox(
      color: colors.glassSolid,
      child: Icon(LucideIcons.imageOff, color: colors.muted),
    );
  }
}
