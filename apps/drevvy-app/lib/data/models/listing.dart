import 'package:equatable/equatable.dart';

import 'json_values.dart';
import 'rooftop_match.dart';

/// Listing model following MarketCheck API fields for clean swap-in.
/// Fields based on MarketCheck's listing response structure.
class Listing extends Equatable {
  const Listing({
    required this.id,
    required this.vin,
    this.stockNo,
    required this.price,
    this.miles,
    this.msrp,
    required this.build,
    required this.media,
    this.dealer,
    this.carLocation,
    this.dist,
    this.domActive,
    this.inventoryType = 'used',
    this.fees,
    this.priceIncludesFees,
    this.refPrice,
    this.priceChangePercent,
    this.carfax1Owner,
    this.carfaxCleanTitle,
    this.extra,
    this.colors,
    this.vdpUrl,
    this.rooftopMatch,
  });

  final String id;
  final String vin;
  final String? stockNo;

  /// Null when the payload omitted a price or sent a value that is not a number.
  final int? price;
  final int? miles;
  final int? msrp;
  final ListingBuild build;
  final ListingMedia media;
  final ListingDealer? dealer;
  final CarLocation? carLocation;
  final double? dist;
  final int? domActive;
  final String inventoryType;
  final int? fees;
  final bool? priceIncludesFees;
  final int? refPrice;
  final double? priceChangePercent;
  final bool? carfax1Owner;
  final bool? carfaxCleanTitle;
  final ListingExtra? extra;
  final ListingColors? colors;

  /// Public listing / VDP URL used to match an onboarded rooftop.
  final String? vdpUrl;

  /// Server or stub rooftop match. Null until the VDP loads it.
  final RooftopMatch? rooftopMatch;

  bool get isNew => inventoryType == 'new';
  bool get isUsed => inventoryType == 'used' || inventoryType == 'cpo';
  bool get isCpo => inventoryType == 'cpo';

  String get title => '${build.year} ${build.make} ${build.model}';
  
  String get shortTitle => '${build.year} ${build.make} ${build.model}';
  
  String get subtitle {
    final parts = <String>[];
    if (build.trim != null) parts.add(build.trim!);
    if (build.powertrainType != null) parts.add(build.powertrainType!);
    if (build.drivetrain != null) parts.add(build.drivetrain!);
    return parts.join(' · ');
  }

  String get milesFormatted {
    if (miles == null) return isNew ? 'New' : 'N/A';
    return '${_formatNumber(miles!)} mi';
  }

  String get priceFormatted {
    final value = price;
    if (value == null) return 'Price unavailable';
    return '\$${_formatNumber(value)}';
  }

  String get distanceFormatted {
    if (dist == null) return '';
    return '${dist!.round()} mi away';
  }

  String get daysListedFormatted {
    if (domActive == null) return '';
    return '$domActive days listed';
  }

  static String _formatNumber(int n) {
    if (n >= 1000) {
      return '${(n / 1000).toStringAsFixed(n % 1000 == 0 ? 0 : 1)}k'.replaceAll('.0k', 'k');
    }
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  @override
  List<Object?> get props => [id, vin, price, miles, build, media];

  /// Parses a Discover or MarketCheck listing. A missing price, a decimal
  /// price, or a numeric string does not throw. Returns null when the id or
  /// build is missing, so one bad row cannot take down a result list.
  static Listing? tryFromJson(Map<String, dynamic> json) {
    final id = jsonString(json['id']);
    final buildRaw = json['build'];
    if (id == null || buildRaw is! Map) return null;
    final build = ListingBuild.tryFromJson(Map<String, dynamic>.from(buildRaw));
    if (build == null) return null;
    final mediaRaw = json['media'];
    final dealerRaw = json['dealer'];
    final locationRaw = json['car_location'];
    final extraRaw = json['extra'];
    final colorsRaw = json['colors'];
    final rooftopRaw = json['rooftop_match'] ?? json['rooftop'];
    return Listing(
      id: id,
      vin: jsonString(json['vin']) ?? '',
      stockNo: jsonString(json['stock_no']),
      price: jsonInt(json['price']),
      miles: jsonInt(json['miles']),
      msrp: jsonInt(json['msrp']),
      build: build,
      media: mediaRaw is Map
          ? ListingMedia.fromJson(Map<String, dynamic>.from(mediaRaw))
          : const ListingMedia(photoLinks: []),
      dealer: dealerRaw is Map
          ? ListingDealer.tryFromJson(Map<String, dynamic>.from(dealerRaw))
          : null,
      carLocation: locationRaw is Map
          ? CarLocation.fromJson(Map<String, dynamic>.from(locationRaw))
          : null,
      dist: jsonDouble(json['dist']),
      domActive: jsonInt(json['dom_active']),
      inventoryType: jsonString(json['inventory_type']) ?? 'used',
      fees: jsonInt(json['fees']),
      priceIncludesFees: json['price_includes_fees'] is bool
          ? json['price_includes_fees'] as bool
          : null,
      refPrice: jsonInt(json['ref_price']),
      priceChangePercent: jsonDouble(json['price_change_percent']),
      carfax1Owner: json['carfax_1_owner'] is bool
          ? json['carfax_1_owner'] as bool
          : null,
      carfaxCleanTitle: json['carfax_clean_title'] is bool
          ? json['carfax_clean_title'] as bool
          : null,
      extra: extraRaw is Map
          ? ListingExtra.fromJson(Map<String, dynamic>.from(extraRaw))
          : null,
      colors: colorsRaw is Map
          ? ListingColors.fromJson(Map<String, dynamic>.from(colorsRaw))
          : null,
      vdpUrl:
          jsonString(json['vdp_url']) ??
          jsonString(json['listing_url']) ??
          jsonString(json['url']),
      rooftopMatch: rooftopRaw is Map
          ? RooftopMatch.fromJson(Map<String, dynamic>.from(rooftopRaw))
          : null,
    );
  }

  factory Listing.fromJson(Map<String, dynamic> json) {
    return tryFromJson(json) ??
        (throw const FormatException('Listing is missing an id or build.'));
  }
}

class ListingBuild extends Equatable {
  const ListingBuild({
    required this.year,
    required this.make,
    required this.model,
    this.trim,
    this.bodyType,
    this.drivetrain,
    this.powertrainType,
    this.engine,
    this.cityMpg,
    this.highwayMpg,
    this.seatingCapacity,
  });

  final int year;
  final String make;
  final String model;
  final String? trim;
  final String? bodyType;
  final String? drivetrain;
  final String? powertrainType;
  final String? engine;
  final int? cityMpg;
  final int? highwayMpg;
  final int? seatingCapacity;

  @override
  List<Object?> get props => [year, make, model, trim];

  static ListingBuild? tryFromJson(Map<String, dynamic> json) {
    final year = jsonInt(json['year']);
    final make = jsonString(json['make']);
    final model = jsonString(json['model']);
    if (year == null || make == null || model == null) return null;
    return ListingBuild(
      year: year,
      make: make,
      model: model,
      trim: jsonString(json['trim']),
      bodyType: jsonString(json['body_type']),
      drivetrain: jsonString(json['drivetrain']),
      powertrainType: jsonString(json['powertrain_type']),
      engine: jsonString(json['engine']),
      cityMpg: jsonInt(json['city_mpg']),
      highwayMpg: jsonInt(json['highway_mpg']),
      seatingCapacity: jsonInt(json['seating_capacity']),
    );
  }

  factory ListingBuild.fromJson(Map<String, dynamic> json) {
    return tryFromJson(json) ??
        (throw const FormatException('Listing build is missing year, make, or model.'));
  }
}

class ListingMedia extends Equatable {
  const ListingMedia({
    required this.photoLinks,
    this.photoLinksCached,
  });

  final List<String> photoLinks;
  final List<String>? photoLinksCached;

  String? get primaryPhoto => photoLinks.isNotEmpty ? photoLinks.first : null;

  @override
  List<Object?> get props => [photoLinks];

  factory ListingMedia.fromJson(Map<String, dynamic> json) {
    final cached = jsonStringList(json['photo_links_cached']);
    return ListingMedia(
      photoLinks: jsonStringList(json['photo_links']),
      photoLinksCached: cached.isEmpty ? null : cached,
    );
  }
}

class ListingDealer extends Equatable {
  const ListingDealer({
    required this.id,
    required this.name,
    this.street,
    this.city,
    this.state,
    this.zip,
    this.latitude,
    this.longitude,
    this.phone,
    this.sellerEmail,
    this.website,
    this.dealerType,
  });

  final String id;
  final String name;
  final String? street;
  final String? city;
  final String? state;
  final String? zip;
  final double? latitude;
  final double? longitude;
  final String? phone;
  final String? sellerEmail;
  final String? website;
  final String? dealerType;

  String get formattedAddress {
    final parts = <String>[];
    if (street != null) parts.add(street!);
    if (city != null && state != null) parts.add('$city, $state');
    if (zip != null) parts.add(zip!);
    return parts.join(', ');
  }

  @override
  List<Object?> get props => [id, name];

  static ListingDealer? tryFromJson(Map<String, dynamic> json) {
    final id = jsonString(json['id']);
    final name = jsonString(json['name']);
    if (id == null || name == null) return null;
    return ListingDealer(
      id: id,
      name: name,
      street: jsonString(json['street']),
      city: jsonString(json['city']),
      state: jsonString(json['state']),
      zip: jsonString(json['zip']),
      latitude: jsonDouble(json['latitude']),
      longitude: jsonDouble(json['longitude']),
      phone: jsonString(json['phone']),
      sellerEmail: jsonString(json['seller_email']),
      website: jsonString(json['website']),
      dealerType: jsonString(json['dealer_type']),
    );
  }

  factory ListingDealer.fromJson(Map<String, dynamic> json) {
    return tryFromJson(json) ??
        (throw const FormatException('Dealer is missing an id or name.'));
  }
}

class CarLocation extends Equatable {
  const CarLocation({
    this.street,
    this.city,
    this.state,
    this.zip,
    this.latitude,
    this.longitude,
  });

  final String? street;
  final String? city;
  final String? state;
  final String? zip;
  final double? latitude;
  final double? longitude;

  @override
  List<Object?> get props => [latitude, longitude];

  factory CarLocation.fromJson(Map<String, dynamic> json) {
    return CarLocation(
      street: jsonString(json['street']),
      city: jsonString(json['city']),
      state: jsonString(json['state']),
      zip: jsonString(json['zip']),
      latitude: jsonDouble(json['latitude']),
      longitude: jsonDouble(json['longitude']),
    );
  }
}

class ListingExtra extends Equatable {
  const ListingExtra({
    this.features,
    this.highValueFeatures,
  });

  final List<String>? features;
  final List<String>? highValueFeatures;

  @override
  List<Object?> get props => [features, highValueFeatures];

  factory ListingExtra.fromJson(Map<String, dynamic> json) {
    final features = jsonStringList(json['features']);
    final highValue = jsonStringList(json['high_value_features']);
    return ListingExtra(
      features: features.isEmpty ? null : features,
      highValueFeatures: highValue.isEmpty ? null : highValue,
    );
  }
}

class ListingColors extends Equatable {
  const ListingColors({
    this.exteriorColor,
    this.interiorColor,
  });

  final String? exteriorColor;
  final String? interiorColor;

  @override
  List<Object?> get props => [exteriorColor, interiorColor];

  factory ListingColors.fromJson(Map<String, dynamic> json) {
    return ListingColors(
      exteriorColor: jsonString(json['exterior_color']),
      interiorColor: jsonString(json['interior_color']),
    );
  }
}
