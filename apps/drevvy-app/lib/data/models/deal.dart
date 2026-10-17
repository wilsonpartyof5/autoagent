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
    this.dealer,
    this.officialOffer,
    this.outcome,
    this.acceptedOffer,
    this.changedOffer,
    this.tryOnceMoreUsed = false,
    this.dealerTimelines = const [],
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
  final RevealedDealer? dealer;
  final OfficialOffer? officialOffer;
  final DealOutcome? outcome;
  final Offer? acceptedOffer;
  final Offer? changedOffer;
  final bool tryOnceMoreUsed;

  /// Per-dealership written quotes. Empty means the screen builds one
  /// timeline from this deal's own offers.
  final List<DealerTimeline> dealerTimelines;

  Offer? get latestOffer => offers.isNotEmpty ? offers.last : null;
  
  /// v1.6: Check if "Try once more" option is still available
  bool get canTryOnceMore => !tryOnceMoreUsed;
  
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

  /// Each dealership's rounds. Shopper copy uses a letter until the store is revealed.
  List<DealerTimeline> get timelines {
    if (dealerTimelines.isNotEmpty) return dealerTimelines;
    return [
      DealerTimeline(
        letter: letter,
        status: status,
        revealedName: status.dealerRevealed ? dealer?.name : null,
        rounds: [
          for (var index = 0; index < offers.length; index++)
            DealerQuoteRound.fromOffer(offers[index], index + 1),
        ],
      ),
    ];
  }

  @override
  List<Object?> get props => [id, status, offers, dealerTimelines];

  Deal copyWith({
    DealStatus? status,
    List<Offer>? offers,
    DealComms? comms,
    List<DealEvent>? events,
    RevealedDealer? dealer,
    OfficialOffer? officialOffer,
    DealOutcome? outcome,
    DateTime? firstContactAt,
    Offer? acceptedOffer,
    Offer? changedOffer,
    bool? tryOnceMoreUsed,
    List<DealerTimeline>? dealerTimelines,
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
      dealer: dealer ?? this.dealer,
      officialOffer: officialOffer ?? this.officialOffer,
      outcome: outcome ?? this.outcome,
      acceptedOffer: acceptedOffer ?? this.acceptedOffer,
      changedOffer: changedOffer ?? this.changedOffer,
      tryOnceMoreUsed: tryOnceMoreUsed ?? this.tryOnceMoreUsed,
      dealerTimelines: dealerTimelines ?? this.dealerTimelines,
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

/// One written quote in a dealership's price timeline.
class DealerQuoteRound extends Equatable {
  const DealerQuoteRound({
    required this.id,
    required this.round,
    required this.receivedAt,
    required this.otd,
    required this.vehiclePrice,
    required this.lines,
    this.removedFees = const [],
  });

  final String id;
  final int round;
  final DateTime receivedAt;
  final int otd;
  final int vehiclePrice;
  final List<OfferLine> lines;
  final List<OfferLine> removedFees;

  factory DealerQuoteRound.fromOffer(Offer offer, int round) {
    return DealerQuoteRound(
      id: offer.id,
      round: round,
      receivedAt: offer.receivedAt,
      otd: offer.otd,
      vehiclePrice: offer.vehiclePrice,
      lines: offer.lines,
      removedFees: offer.removedAddOns,
    );
  }

  @override
  List<Object?> get props => [id, round, otd];
}

/// One dealership on the deal timeline. [letter] is what the shopper sees
/// until the store name is allowed to show.
class DealerTimeline extends Equatable {
  const DealerTimeline({
    required this.letter,
    required this.status,
    this.rounds = const [],
    this.revealedName,
  });

  final String letter;
  final DealStatus status;
  final List<DealerQuoteRound> rounds;
  final String? revealedName;

  String get label {
    final name = revealedName?.trim();
    if (name != null && name.isNotEmpty) return name;
    return 'Dealer $letter';
  }

  int? get latestOtd => rounds.isEmpty ? null : rounds.last.otd;

  @override
  List<Object?> get props => [letter, status, rounds];
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
