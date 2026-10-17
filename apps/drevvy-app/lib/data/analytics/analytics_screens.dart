/// Maps a router location onto a [screen_viewed] name and safe properties.
class AnalyticsRoute {
  const AnalyticsRoute({
    required this.screen,
    this.properties = const {},
    this.onboardingStep,
    this.onboardingIndex,
    this.paywallPlacement,
    this.errorCode,
  });

  final String screen;
  final Map<String, Object?> properties;
  final String? onboardingStep;
  final int? onboardingIndex;
  final String? paywallPlacement;
  final String? errorCode;
}

AnalyticsRoute? resolveAnalyticsRoute(Uri uri) {
  final path = uri.path;
  final from = uri.queryParameters['from'];
  final code = _code(uri.queryParameters['code']);

  if (path == '/onboarding/welcome') {
    return const AnalyticsRoute(
      screen: 'onboarding_welcome',
      onboardingStep: 'welcome',
      onboardingIndex: 1,
    );
  }
  if (path == '/onboarding/how') {
    return const AnalyticsRoute(
      screen: 'onboarding_how_it_works',
      onboardingStep: 'how_it_works',
      onboardingIndex: 2,
    );
  }
  if (path == '/onboarding/location') {
    return const AnalyticsRoute(
      screen: 'onboarding_location',
      onboardingStep: 'location',
      onboardingIndex: 3,
    );
  }
  if (path == '/onboarding/preferences') {
    return const AnalyticsRoute(
      screen: 'onboarding_preferences',
      onboardingStep: 'preferences',
      onboardingIndex: 4,
    );
  }
  if (path == '/paywall') {
    final onboarding = from == 'onboarding';
    return AnalyticsRoute(
      screen: 'paywall',
      properties: {'placement': onboarding ? 'onboarding' : 'paywall'},
      onboardingStep: onboarding ? 'paywall' : null,
      onboardingIndex: onboarding ? 5 : null,
      paywallPlacement: onboarding ? 'onboarding' : 'paywall',
    );
  }
  if (path == '/account/create') {
    return const AnalyticsRoute(screen: 'create_account');
  }
  if (path == '/shop') return const AnalyticsRoute(screen: 'shop');
  if (path == '/deals') return const AnalyticsRoute(screen: 'deals');
  if (path == '/saved') return const AnalyticsRoute(screen: 'saved');
  if (path.startsWith('/vdp/')) {
    final id = _id(path.substring('/vdp/'.length));
    if (id == null) return const AnalyticsRoute(screen: 'car_detail');
    return AnalyticsRoute(screen: 'car_detail', properties: {'listing_id': id});
  }
  final official = RegExp(r'^/deal/([^/]+)/official$').firstMatch(path);
  if (official != null) {
    final id = _id(official.group(1)!);
    return AnalyticsRoute(
      screen: 'official_offer',
      properties: {'deal_id': ?id},
    );
  }
  final done = RegExp(r'^/deal/([^/]+)/done$').firstMatch(path);
  if (done != null) {
    final id = _id(done.group(1)!);
    return AnalyticsRoute(
      screen: 'deal_done',
      properties: {'deal_id': ?id},
    );
  }
  final deal = RegExp(r'^/deal/([^/]+)$').firstMatch(path);
  if (deal != null) {
    final id = _id(deal.group(1)!);
    return AnalyticsRoute(
      screen: 'deal_detail',
      properties: {'deal_id': ?id},
    );
  }
  if (path == '/error') {
    return AnalyticsRoute(
      screen: 'error',
      errorCode: code ?? 'unknown',
      properties: {'code': code ?? 'unknown'},
    );
  }
  return null;
}

String? _id(String raw) {
  final value = Uri.decodeComponent(raw).trim();
  if (value.isEmpty || value.length > 80) return null;
  if (value.contains('@') || value.contains(' ')) return null;
  return value;
}

String? _code(String? raw) {
  if (raw == null) return null;
  final value = raw.trim();
  if (value.isEmpty || value.length > 40) return null;
  if (!RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(value)) return null;
  return value;
}
