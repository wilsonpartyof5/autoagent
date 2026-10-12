import 'package:equatable/equatable.dart';

/// Market context for a listing, derived from MarketCheck comparables.
/// Uses percentiles for low/high (not min/max) per audit recommendations.
class MarketContext extends Equatable {
  const MarketContext({
    required this.fairVehiclePrice,
    required this.fairOtd,
    required this.lowPrice,
    required this.medianPrice,
    required this.highPrice,
    required this.comparablesCount,
    this.daysListedMedian,
    this.priceDrops,
    this.isNewCar = false,
    this.msrp,
    this.msrpDiscount,
  });

  /// MarketCheck Price (fair vehicle price, used/CPO only)
  final int fairVehiclePrice;
  
  /// Fair OTD = fairVehiclePrice + docFeeEst + titleRegEst + taxEst
  final int fairOtd;
  
  /// p25 percentile of comparable listings
  final int lowPrice;
  
  /// Median (p50) of comparable listings
  final int medianPrice;
  
  /// p75 percentile of comparable listings  
  final int highPrice;
  
  /// Number of comparable listings within radius
  final int comparablesCount;
  
  /// Median days listed for comparables
  final int? daysListedMedian;
  
  /// Number of price drops on this listing
  final int? priceDrops;
  
  /// True if this is a new car (different pricing logic)
  final bool isNewCar;
  
  /// MSRP for new cars
  final int? msrp;
  
  /// Discount vs MSRP for new cars
  final int? msrpDiscount;

  /// For used cars: delta vs similar listings (medianPrice - listingPrice)
  /// Positive = below market (good for buyer)
  int deltaVsSimilar(int listingPrice) => medianPrice - listingPrice;
  
  /// For new cars: delta vs MSRP (msrp - listingPrice)
  int? deltaVsMsrp(int listingPrice) {
    if (msrp == null) return null;
    return msrp! - listingPrice;
  }

  /// Badge text for shop results: "vs similar listings nearby"
  String badgeText(int listingPrice) {
    if (isNewCar && msrp != null) {
      final delta = deltaVsMsrp(listingPrice)!;
      if (delta > 0) {
        return '\$${_formatNumber(delta)} below MSRP';
      } else if (delta < 0) {
        return '\$${_formatNumber(-delta)} above MSRP';
      }
      return 'At MSRP';
    }
    
    final delta = deltaVsSimilar(listingPrice);
    if (delta > 0) {
      return '\$${_formatNumber(delta)} below similar';
    } else if (delta < 0) {
      return '\$${_formatNumber(-delta)} above similar';
    }
    return 'At market';
  }

  /// Whether this is a good deal (below median for used, below MSRP for new)
  bool isGoodDeal(int listingPrice) {
    if (isNewCar && msrp != null) {
      return listingPrice < msrp!;
    }
    return listingPrice < medianPrice;
  }

  static String _formatNumber(int n) {
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  @override
  List<Object?> get props => [
        fairVehiclePrice,
        fairOtd,
        lowPrice,
        medianPrice,
        highPrice,
        comparablesCount,
        isNewCar,
      ];

  factory MarketContext.fromJson(Map<String, dynamic> json) {
    return MarketContext(
      fairVehiclePrice: json['fair_vehicle_price'] as int,
      fairOtd: json['fair_otd'] as int,
      lowPrice: json['low_price'] as int,
      medianPrice: json['median_price'] as int,
      highPrice: json['high_price'] as int,
      comparablesCount: json['comparables_count'] as int,
      daysListedMedian: json['days_listed_median'] as int?,
      priceDrops: json['price_drops'] as int?,
      isNewCar: json['is_new_car'] as bool? ?? false,
      msrp: json['msrp'] as int?,
      msrpDiscount: json['msrp_discount'] as int?,
    );
  }
}
