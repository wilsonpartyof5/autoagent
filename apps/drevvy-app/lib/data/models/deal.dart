import 'package:equatable/equatable.dart';
import '../../core/theme/drevvy_tokens.dart';
import 'listing.dart';
import 'market_context.dart';

class Deal extends Equatable {
  const Deal({
    required this.id,
    required this.listingId,
    required this.letter,
    required this.status,
    required this.listedAtStart,
    required this.addedAt,
    this.firstContactAt,
    required this.listing,
    this.marketContext,
    this.offers = const [],
    this.comms = const DealComms(),
    this.events = const [],
    this.maxOtd,
    this.dealer,
    this.officialOffer,
    this.outcome,
  });

  final String id;
  final String listingId;
  final String letter;
  final DealStatus status;
  final int listedAtStart;
  final DateTime addedAt;
  final DateTime? firstContactAt;
  final Listing listing;
  final MarketContext? marketContext;
  final List<Offer> offers;
  final DealComms comms;
  final List<DealEvent> events;
  final int? maxOtd;
  final RevealedDealer? dealer;
  final OfficialOffer? officialOffer;
  final DealOutcome? outcome;

  Offer? get latestOffer => offers.isNotEmpty ? offers.last : null;
  
  int? get currentOtd => latestOffer?.otd;
  
  int? get savings {
    final offer = latestOffer;
    if (offer == null) return null;
    return listedAtStart - offer.vehiclePrice;
  }

  double? get savingsPercent {
    final s = savings;
    if (s == null || listedAtStart == 0) return null;
    return (s / listedAtStart) * 100;
  }

  bool get canUndo {
    if (firstContactAt != null) return false;
    final windowEnd = addedAt.add(const Duration(minutes: 30));
    return DateTime.now().isBefore(windowEnd);
  }

  Duration? get undoTimeRemaining {
    if (!canUndo) return null;
    final windowEnd = addedAt.add(const Duration(minutes: 30));
    return windowEnd.difference(DateTime.now());
  }

  int get progressSteps {
    return status.progressStep ?? 1;
  }

  @override
  List<Object?> get props => [id, status, offers];

  Deal copyWith({
    DealStatus? status,
    List<Offer>? offers,
    DealComms? comms,
    List<DealEvent>? events,
    RevealedDealer? dealer,
    OfficialOffer? officialOffer,
    DealOutcome? outcome,
    DateTime? firstContactAt,
  }) {
    return Deal(
      id: id,
      listingId: listingId,
      letter: letter,
      status: status ?? this.status,
      listedAtStart: listedAtStart,
      addedAt: addedAt,
      firstContactAt: firstContactAt ?? this.firstContactAt,
      listing: listing,
      marketContext: marketContext,
      offers: offers ?? this.offers,
      comms: comms ?? this.comms,
      events: events ?? this.events,
      maxOtd: maxOtd,
      dealer: dealer ?? this.dealer,
      officialOffer: officialOffer ?? this.officialOffer,
      outcome: outcome ?? this.outcome,
    );
  }
}

class Offer extends Equatable {
  const Offer({
    required this.id,
    required this.receivedAt,
    required this.otd,
    required this.vehiclePrice,
    required this.lines,
    this.removedAddOns = const [],
    this.validUntil,
  });

  final String id;
  final DateTime receivedAt;
  final int otd;
  final int vehiclePrice;
  final List<OfferLine> lines;
  final List<OfferLine> removedAddOns;
  final DateTime? validUntil;

  @override
  List<Object?> get props => [id, otd];
}

class OfferLine extends Equatable {
  const OfferLine({
    required this.key,
    required this.amount,
    this.subLine,
  });

  final String key;
  final int amount;
  final String? subLine;

  @override
  List<Object?> get props => [key, amount];
}

class OfficialOffer extends Offer {
  const OfficialOffer({
    required super.id,
    required super.receivedAt,
    required super.otd,
    required super.vehiclePrice,
    required super.lines,
    super.removedAddOns,
    super.validUntil,
    required this.vin,
    required this.fromEmail,
    this.forwardedAt,
  });

  final String vin;
  final String fromEmail;
  final DateTime? forwardedAt;
}

class DealComms extends Equatable {
  const DealComms({
    this.emails = 0,
    this.texts = 0,
    this.calls = 0,
  });

  final int emails;
  final int texts;
  final int calls;

  @override
  List<Object?> get props => [emails, texts, calls];
}

class DealEvent extends Equatable {
  const DealEvent({
    required this.id,
    required this.timestamp,
    required this.heading,
    this.detail,
    this.isLatest = false,
  });

  final String id;
  final DateTime timestamp;
  final String heading;
  final String? detail;
  final bool isLatest;

  @override
  List<Object?> get props => [id, timestamp];
}

class RevealedDealer extends Equatable {
  const RevealedDealer({
    required this.name,
    required this.address,
    required this.city,
    required this.state,
    required this.zip,
    required this.latitude,
    required this.longitude,
    this.distance,
    this.rep,
  });

  final String name;
  final String address;
  final String city;
  final String state;
  final String zip;
  final double latitude;
  final double longitude;
  final double? distance;
  final DealerRep? rep;

  String get formattedAddress => '$address, $city, $state $zip';
  String get distanceFormatted => distance != null ? '${distance!.round()} mi' : '';

  @override
  List<Object?> get props => [name, address];
}

class DealerRep extends Equatable {
  const DealerRep({
    required this.name,
    this.role,
    this.phone,
    this.email,
  });

  final String name;
  final String? role;
  final String? phone;
  final String? email;

  @override
  List<Object?> get props => [name];
}

enum DealOutcomeType { bought, boughtDifferentPrice, notYet, no }

class DealOutcome extends Equatable {
  const DealOutcome({
    required this.type,
    this.actualPrice,
    this.note,
  });

  final DealOutcomeType type;
  final int? actualPrice;
  final String? note;

  @override
  List<Object?> get props => [type];
}
