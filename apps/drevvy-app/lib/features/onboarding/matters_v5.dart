import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// DW-approved Matters v5 first-run copy and option ids. Match the board.
const mattersV5StepCount = 10;

const mattersV5AutoAdvance = Duration(milliseconds: 380);

const mattersV5Margin = 22.0;
const mattersV5CtaHeight = 56.0;
const mattersV5CardMinHeight = 60.0;
const mattersV5CardRadius = 14.0;

const mattersV5StarterKeys = 3;

/// Under the step-7 text CTA. Product lock, not board body copy.
const mattersV5TalkPrivacyLine =
    'Your phone and email stay private. No calls.';

enum MattersPain {
  surpriseFees,
  priceChanging,
  salesCalls,
  wastedTrip,
  justLooking,
}

enum MattersOutcome { wholePrice, fairPrice, both }

enum MattersControl { keepInDrevvy, contactMyself }

enum MattersAsk { wholePrice, extraFees, stillThere, writeOwn }

enum MattersCarType { suv, truck, sedan, other, notSure }

enum MattersCondition { brandNew, used, either }

enum MattersTiming { soon, thisMonth, justLooking }

class MattersChoice<T> {
  const MattersChoice({
    required this.id,
    required this.label,
    this.sub,
    this.icon,
    this.brandIcon = false,
  });

  final T id;
  final String label;
  final String? sub;
  final IconData? icon;
  final bool brandIcon;
}

const mattersPains = <MattersChoice<MattersPain>>[
  MattersChoice(
    id: MattersPain.surpriseFees,
    label: 'Surprise fees',
    icon: LucideIcons.creditCard,
  ),
  MattersChoice(
    id: MattersPain.priceChanging,
    label: 'The price changing',
    icon: LucideIcons.trendingDown,
  ),
  MattersChoice(
    id: MattersPain.salesCalls,
    label: 'Sales calls and pressure',
    icon: LucideIcons.smartphone,
  ),
  MattersChoice(
    id: MattersPain.wastedTrip,
    label: 'Wasting a trip',
    icon: LucideIcons.car,
  ),
  MattersChoice(
    id: MattersPain.justLooking,
    label: 'Just looking',
    icon: LucideIcons.search,
  ),
];

const mattersOutcomes = <MattersChoice<MattersOutcome>>[
  MattersChoice(
    id: MattersOutcome.wholePrice,
    label: 'Whole price',
    sub: 'Car + tax + fees',
    icon: LucideIcons.receipt,
  ),
  MattersChoice(
    id: MattersOutcome.fairPrice,
    label: 'If the price is fair',
    sub: 'How it compares near you',
    icon: LucideIcons.info,
  ),
  MattersChoice(
    id: MattersOutcome.both,
    label: 'Both',
    sub: 'The whole price and if it’s fair',
    icon: LucideIcons.sparkles,
  ),
];

const mattersControls = <MattersChoice<MattersControl>>[
  MattersChoice(
    id: MattersControl.keepInDrevvy,
    label: 'Keep texts in Drevvy',
    sub: 'Private chat in the app. Your phone stays private.',
    icon: LucideIcons.shieldCheck,
    brandIcon: true,
  ),
  MattersChoice(
    id: MattersControl.contactMyself,
    label: 'I may contact a dealer myself',
    sub: 'Call or visit the dealership on your own',
    icon: LucideIcons.smartphone,
  ),
];

const mattersAsks = <MattersChoice<MattersAsk>>[
  MattersChoice(id: MattersAsk.wholePrice, label: 'Whole price'),
  MattersChoice(id: MattersAsk.extraFees, label: 'Extra fees'),
  MattersChoice(id: MattersAsk.stillThere, label: 'Still there?'),
  MattersChoice(id: MattersAsk.writeOwn, label: 'Write my own'),
];

const mattersCarTypes = <MattersChoice<MattersCarType>>[
  MattersChoice(id: MattersCarType.suv, label: 'SUV'),
  MattersChoice(id: MattersCarType.truck, label: 'Truck'),
  MattersChoice(id: MattersCarType.sedan, label: 'Sedan'),
  MattersChoice(id: MattersCarType.other, label: 'Other'),
  MattersChoice(id: MattersCarType.notSure, label: 'Not sure'),
];

const mattersConditions = <MattersChoice<MattersCondition>>[
  MattersChoice(id: MattersCondition.brandNew, label: 'New'),
  MattersChoice(id: MattersCondition.used, label: 'Used'),
  MattersChoice(id: MattersCondition.either, label: 'Either'),
];

const mattersTimings = <MattersChoice<MattersTiming>>[
  MattersChoice(id: MattersTiming.soon, label: 'Soon'),
  MattersChoice(id: MattersTiming.thisMonth, label: 'This month'),
  MattersChoice(id: MattersTiming.justLooking, label: 'Just looking'),
];

const mattersAskDrafts = <MattersAsk, String>{
  MattersAsk.wholePrice:
      'Can you send me the whole price, including all required fees?',
  MattersAsk.extraFees: 'Are there any extra fees I should know about?',
  MattersAsk.stillThere: 'Is this car still for sale?',
};

const _painPriority = <MattersPain, String>{
  MattersPain.surpriseFees: 'Avoid surprise fees',
  MattersPain.priceChanging: 'Avoid the price changing',
  MattersPain.salesCalls: 'Avoid sales calls and pressure',
  MattersPain.wastedTrip: 'Avoid a wasted trip',
  MattersPain.justLooking: 'Look around at my own pace',
};

const _outcomePriority = <MattersOutcome, String>{
  MattersOutcome.wholePrice: 'Understand the whole price',
  MattersOutcome.fairPrice: 'Know if the price is fair',
  MattersOutcome.both: 'Know if the price is fair and the whole price',
};

const _controlPriority = <MattersControl, String>{
  MattersControl.keepInDrevvy: 'Keep conversations private',
  MattersControl.contactMyself: 'Get answers first, then call if I want',
};

const _defaultPriorities = <String>[
  'Avoid surprise fees',
  'Understand the whole price',
  'Keep conversations private',
];

/// Step 5 rows from steps 2–4. Board defaults when a pick is missing.
List<String> shoppingPriorities({
  MattersPain? pain,
  MattersOutcome? outcome,
  MattersControl? control,
}) {
  final rows = <String>[
    if (pain != null) _painPriority[pain]!,
    if (outcome != null) _outcomePriority[outcome]!,
    if (control != null) _controlPriority[control]!,
  ];
  return rows.isEmpty ? List<String>.from(_defaultPriorities) : rows;
}

String? draftQuestionText({
  required MattersAsk? ask,
  required String custom,
}) {
  if (ask == null) return null;
  if (ask == MattersAsk.writeOwn) {
    final text = custom.trim();
    return text.isEmpty ? null : text;
  }
  return mattersAskDrafts[ask];
}

bool isFiveDigitZip(String zip) => RegExp(r'^\d{5}$').hasMatch(zip);

String? bodyTypeFor(MattersCarType? type) {
  return switch (type) {
    MattersCarType.suv => 'SUV',
    MattersCarType.truck => 'Truck',
    MattersCarType.sedan => 'Sedan',
    MattersCarType.other => null,
    MattersCarType.notSure => null,
    null => null,
  };
}

String? conditionFor(MattersCondition? condition) {
  return switch (condition) {
    MattersCondition.brandNew => 'new',
    MattersCondition.used => 'used',
    MattersCondition.either => null,
    null => null,
  };
}

String analyticsId<T extends Enum>(T value) => value.name;

const mattersStepAnalytics = <String>[
  'know_the_market',
  'avoid',
  'want_to_know',
  'dealers',
  'shopping_priorities',
  'market_intel',
  'real_dealers_draft',
  'where_to_look',
  'car_type',
  'free_keys',
];
