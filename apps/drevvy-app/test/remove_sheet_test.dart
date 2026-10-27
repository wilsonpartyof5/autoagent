import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/data/models/deal.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/user.dart';
import 'package:drevvy_app/features/deals/widgets/remove_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final user = User(
    id: 'user_1',
    firstName: 'Dana',
    email: 'dana@example.com',
    entitlement: Entitlement.free,
    usage: Usage(used: 2, cap: 6, resetsOn: DateTime(2026, 11, 1)),
  );

  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first
      ..physicalSize = const Size(800, 1600)
      ..devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  testWidgets('early removal says how many cars are left', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: RemoveSheet(
            deal: _deal(addedAt: DateTime.now()),
            user: user,
            onRemove: () {},
            onKeep: () {},
          ),
        ),
      ),
    );

    expect(find.textContaining('7 days of confirmed delivery'), findsOneWidget);
    expect(find.textContaining('4 keys left'), findsOneWidget);
    expect(find.textContaining('this month'), findsNothing);
  });

  testWidgets('a contacted car uses one of the shopper\'s cars', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: RemoveSheet(
            deal: _deal(
              addedAt: DateTime.now().subtract(const Duration(hours: 2)),
              firstContactAt: DateTime.now().subtract(const Duration(hours: 1)),
            ),
            user: user,
            onRemove: () {},
            onKeep: () {},
          ),
        ),
      ),
    );

    expect(
      find.textContaining('Conversation key is not returned on cancel'),
      findsOneWidget,
    );
    expect(find.textContaining('this month'), findsNothing);
  });
}

Deal _deal({required DateTime addedAt, DateTime? firstContactAt}) {
  return Deal(
    id: 'deal_1',
    listingId: listing.id,
    letter: 'A',
    status: DealStatus.reachingOut,
    listedAtStart: 27990,
    addedAt: addedAt,
    firstContactAt: firstContactAt,
    listing: listing,
  );
}

const listing = Listing(
  id: 'listing_1',
  vin: 'VIN123',
  price: 27990,
  build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
  media: ListingMedia(photoLinks: []),
);
