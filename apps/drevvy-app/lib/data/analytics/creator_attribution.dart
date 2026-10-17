import 'dart:convert';

/// First-touch creator and campaign ids captured from a link or install referrer.
///
/// Accepted parameters: `c` / `creator` / `creator_id`, `v` / `video` / `video_id`,
/// and `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
class CreatorAttribution {
  const CreatorAttribution(this.properties);

  final Map<String, String> properties;

  static const empty = CreatorAttribution({});

  bool get isEmpty => properties.isEmpty;

  Map<String, Object> get eventProperties => Map<String, Object>.from(properties);

  /// Fills gaps. An existing creator id is kept so the acquiring creator stays
  /// attached for cost-per-buyer.
  CreatorAttribution mergeFirstTouch(CreatorAttribution incoming) {
    if (incoming.isEmpty) return this;
    final next = Map<String, String>.from(properties);
    for (final entry in incoming.properties.entries) {
      next.putIfAbsent(entry.key, () => entry.value);
    }
    return CreatorAttribution(next);
  }

  String toJson() => jsonEncode(properties);

  static CreatorAttribution? fromJson(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final props = <String, String>{};
      for (final entry in decoded.entries) {
        final key = entry.key?.toString();
        final value = entry.value?.toString();
        if (key == null || value == null) continue;
        if (!_propertyKeys.contains(key)) continue;
        final safe = _safeToken(value);
        if (safe == null) continue;
        props[key] = safe;
      }
      if (props.isEmpty) return null;
      return CreatorAttribution(props);
    } catch (_) {
      return null;
    }
  }

  /// Parses a URI, a path with a query, or a raw referrer query string.
  static CreatorAttribution? parse(String? raw) {
    if (raw == null) return null;
    final trimmed = raw.trim();
    if (trimmed.isEmpty || trimmed == '/') return null;
    final uri = _asUri(trimmed);
    if (uri == null) return null;
    return fromUri(uri);
  }

  static CreatorAttribution? fromUri(Uri uri) {
    final params = uri.queryParameters;
    final props = <String, String>{};
    void take(String property, List<String> keys) {
      for (final key in keys) {
        final safe = _safeToken(params[key]);
        if (safe == null) continue;
        props[property] = safe;
        return;
      }
    }

    take('creator_id', const ['c', 'creator', 'creator_id']);
    take('video_id', const ['v', 'video', 'video_id']);
    take('utm_source', const ['utm_source']);
    take('utm_medium', const ['utm_medium']);
    take('utm_campaign', const ['utm_campaign']);
    take('utm_content', const ['utm_content']);
    take('utm_term', const ['utm_term']);
    if (props.isEmpty) return null;
    return CreatorAttribution(props);
  }

  static Uri? _asUri(String raw) {
    if (raw.startsWith('/')) return Uri.tryParse('https://drevvy.local$raw');
    if (raw.contains('://')) return Uri.tryParse(raw);
    if (raw.startsWith('?')) return Uri.tryParse('https://drevvy.local/$raw');
    return Uri.tryParse('https://drevvy.local/?$raw');
  }

  static String? _safeToken(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    if (trimmed.isEmpty || trimmed.length > 64) return null;
    if (trimmed.contains('@')) return null;
    if (RegExp(r'^\+?\d{7,}$').hasMatch(trimmed)) return null;
    if (!RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(trimmed)) return null;
    return trimmed;
  }

  static const _propertyKeys = {
    'creator_id',
    'video_id',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  };
}
