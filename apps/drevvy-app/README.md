# Drevvy Shopper App

AI car-buying assistant for shoppers. Built with Flutter (iOS + Android + Web).

## Requirements

- Flutter 3.47.7+ / Dart 3.13.5+
- iOS: Xcode 15+ with Swift Package Manager (no CocoaPods)
- Android: Android Studio with SDK 33+

## Setup

```bash
# Get dependencies
flutter pub get

# Generate riverpod code (if using generators)
dart run build_runner build
```

## Running

```bash
# iOS (uses Swift Package Manager)
cd ios && swift package resolve && cd ..
flutter run -d ios

# Android
flutter run -d android

# Web
flutter run -d chrome

# With specific device
flutter devices  # List available devices
flutter run -d <device-id>
```

## Building

```bash
# iOS (release)
flutter build ios --release

# Android APK (debug)
flutter build apk --debug

# Android App Bundle (release)
flutter build appbundle --release

# Web
flutter build web
```

## Architecture

```
lib/
├── core/
│   ├── router/          # go_router with StatefulShellRoute for 3 tabs
│   ├── theme/           # Drevvy Halo design tokens + ThemeExtensions
│   └── widgets/         # Shared widgets (GlassCard, buttons, tab bar)
├── data/
│   ├── models/          # User, Listing, Deal, Offer, MarketContext
│   └── repositories/    # DemoRepository (swap with real API)
└── features/
    ├── onboarding/      # Welcome, How it works, Location, Preferences, Paywall
    ├── shop/            # Ask/Shop chat, inventory results, VDP
    ├── deals/           # Deals list, Deal detail, Official offer, Done
    ├── profile/         # User profile + settings
    └── common/          # Error screens, shared screens
```

## Key Dependencies

- `flutter_riverpod` - State management
- `go_router` - Navigation with StatefulShellRoute
- `lucide_icons_flutter` - Icon set
- `cached_network_image` - Image caching
- `shimmer` - Loading skeletons
- `intl` - Number/date formatting

## Design System

Uses the Drevvy Halo design system with:
- Light + dark theme support
- `DrevvyColors` and `DrevvyText` ThemeExtensions
- `GlassCard` widget with optional `BackdropFilter` blur
- `StatusChip` for deal status display
- 8-status chip colors with proper contrast

Access in widgets:
```dart
final colors = context.drevvy;
final text = context.drevvyText;
```

## TODO Seams (Phase 2+)

- **Backend API**: Replace `DemoRepository` calls with `https://api.drevvy.com`
- **Supabase Auth**: Replace demo user with real authentication
- **RevenueCat/Superwall**: Paywall screens are static placeholders
- **Push Notifications**: Pre-prompt UI exists, FCM not wired
- **Geofencing**: Location permission UI exists, geofence logic not wired

## Screen Status

### Fully Built
- App shell + floating tab bar (01)
- Onboarding: Welcome, How it works, Location, Preferences (02-05)
- Paywall (06)
- Create account (15)
- Shop: Empty, Ask answer, Typing, Results, Loading skeleton (07-11, 17)
- VDP: Free + Pro variants (12-13, 16)
- Deals list: Light/dark, empty, ended banners (20-25)
- Deal detail: Offer card, breakdown, timeline, actions (27-32)
- Official offer + dealer reveal (33)
- Done screen (36)
- Profile (41)
- Error screen (43)

### Placeholder / Not Built Yet
- Add to Drevvy sheet (18) - built
- Notification pre-prompt (19) - placeholder
- Ask Drevvy deal sheet (29) - placeholder  
- Location pickup pre-prompt (34) - placeholder
- Trade-in/financing sheet (35) - placeholder
- Did you buy outcome (38) - placeholder
- Remove sheets (39-40) - placeholder
- Offline banner (42) - placeholder
- New-car VDP (44) - not built

## License

Proprietary - Drevvy Inc.
