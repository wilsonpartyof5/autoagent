final _email = RegExp(r'[^@\s]+@[^@\s]+\.[^@\s]+');
final _phone = RegExp(r'(?:\+?\d[\d\s().-]{6,}\d)');
final _longDigits = RegExp(r'\d{7,}');

const _blockedKeys = <String>{
  'email',
  'phone',
  'name',
  'first_name',
  'last_name',
  'full_name',
  'user_name',
  'display_name',
  'dealer_name',
  'address',
  'street',
  'zip',
  'postal_code',
  'city',
  'query',
  'text',
  'message',
  'title',
  'content',
  'body',
  'note',
  'vin',
  'token',
  'password',
  'authorization',
  'latitude',
  'longitude',
  'lat',
  'lng',
};

const _blockedSuffixes = <String>[
  '_email',
  '_phone',
  '_name',
  '_address',
  '_zip',
  '_text',
  '_query',
  '_title',
  '_token',
  '_vin',
  '_note',
];

/// Drops personal data before an event is queued.
///
/// Allowed values are short strings, numbers, and bools. Emails, phone
/// numbers, and free-text fields never pass through.
Map<String, Object> sanitizeProperties(Map<String, Object?>? raw) {
  if (raw == null || raw.isEmpty) return <String, Object>{};
  final safe = <String, Object>{};
  for (final entry in raw.entries) {
    final key = entry.key.trim();
    if (!_allowedKey(key)) continue;
    final value = _allowedValue(entry.value);
    if (value == null) continue;
    safe[key] = value;
  }
  return safe;
}

bool _allowedKey(String key) {
  if (key.isEmpty || key.length > 64) return false;
  final normalized = key.toLowerCase();
  if (_blockedKeys.contains(normalized)) return false;
  for (final suffix in _blockedSuffixes) {
    if (normalized.endsWith(suffix)) return false;
  }
  return RegExp(r'^[a-z][a-z0-9_]*$').hasMatch(normalized);
}

Object? _allowedValue(Object? value) {
  if (value is bool || value is int) return value;
  if (value is double) {
    if (value.isNaN || value.isInfinite) return null;
    return value;
  }
  if (value is String) return _allowedString(value);
  return null;
}

String? _allowedString(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty || trimmed.length > 80) return null;
  if (trimmed.contains('@') || _email.hasMatch(trimmed)) return null;
  if (_phone.hasMatch(trimmed) || _longDigits.hasMatch(trimmed)) return null;
  return trimmed;
}

/// Supabase user ids only. Emails, phones, and display names are rejected.
bool isAnalyticsUserId(String userId) {
  final trimmed = userId.trim();
  if (trimmed.isEmpty || trimmed.length > 128) return false;
  if (trimmed.contains('@') || trimmed.contains(' ')) return false;
  if (RegExp(r'^\+?\d{7,}$').hasMatch(trimmed)) return false;
  return RegExp(r'^[A-Za-z0-9._:-]+$').hasMatch(trimmed);
}
