import 'package:equatable/equatable.dart';

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
  final int price;
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

  String get priceFormatted => '\$${_formatNumber(price)}';

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

  factory Listing.fromJson(Map<String, dynamic> json) {
    return Listing(
      id: json['id'] as String,
      vin: json['vin'] as String,
      stockNo: json['stock_no'] as String?,
      price: json['price'] as int,
      miles: json['miles'] as int?,
      msrp: json['msrp'] as int?,
      build: ListingBuild.fromJson(json['build'] as Map<String, dynamic>),
      media: ListingMedia.fromJson(json['media'] as Map<String, dynamic>),
      dealer: json['dealer'] != null
          ? ListingDealer.fromJson(json['dealer'] as Map<String, dynamic>)
          : null,
      carLocation: json['car_location'] != null
          ? CarLocation.fromJson(json['car_location'] as Map<String, dynamic>)
          : null,
      dist: (json['dist'] as num?)?.toDouble(),
      domActive: json['dom_active'] as int?,
      inventoryType: json['inventory_type'] as String? ?? 'used',
      fees: json['fees'] as int?,
      priceIncludesFees: json['price_includes_fees'] as bool?,
      refPrice: json['ref_price'] as int?,
      priceChangePercent: (json['price_change_percent'] as num?)?.toDouble(),
      carfax1Owner: json['carfax_1_owner'] as bool?,
      carfaxCleanTitle: json['carfax_clean_title'] as bool?,
      extra: json['extra'] != null
          ? ListingExtra.fromJson(json['extra'] as Map<String, dynamic>)
          : null,
      colors: json['colors'] != null
          ? ListingColors.fromJson(json['colors'] as Map<String, dynamic>)
          : null,
      vdpUrl:
          json['vdp_url'] as String? ??
          json['listing_url'] as String? ??
          json['url'] as String?,
      rooftopMatch: json['rooftop_match'] is Map
          ? RooftopMatch.fromJson(
              Map<String, dynamic>.from(json['rooftop_match'] as Map),
            )
          : json['rooftop'] is Map
          ? RooftopMatch.fromJson(
              Map<String, dynamic>.from(json['rooftop'] as Map),
            )
          : null,
    );
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

  factory ListingBuild.fromJson(Map<String, dynamic> json) {
    return ListingBuild(
      year: json['year'] as int,
      make: json['make'] as String,
      model: json['model'] as String,
      trim: json['trim'] as String?,
      bodyType: json['body_type'] as String?,
      drivetrain: json['drivetrain'] as String?,
      powertrainType: json['powertrain_type'] as String?,
      engine: json['engine'] as String?,
      cityMpg: json['city_mpg'] as int?,
      highwayMpg: json['highway_mpg'] as int?,
      seatingCapacity: json['seating_capacity'] as int?,
    );
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
    return ListingMedia(
      photoLinks: (json['photo_links'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      photoLinksCached: (json['photo_links_cached'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
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

  factory ListingDealer.fromJson(Map<String, dynamic> json) {
    return ListingDealer(
      id: json['id'] as String,
      name: json['name'] as String,
      street: json['street'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      zip: json['zip'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      phone: json['phone'] as String?,
      sellerEmail: json['seller_email'] as String?,
      website: json['website'] as String?,
      dealerType: json['dealer_type'] as String?,
    );
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
      street: json['street'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      zip: json['zip'] as String?,
      latitude: double.tryParse(json['latitude']?.toString() ?? ''),
      longitude: double.tryParse(json['longitude']?.toString() ?? ''),
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
    return ListingExtra(
      features: (json['features'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      highValueFeatures: (json['high_value_features'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
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
      exteriorColor: json['exterior_color'] as String?,
      interiorColor: json['interior_color'] as String?,
    );
  }
}
