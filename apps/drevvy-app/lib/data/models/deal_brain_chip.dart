import 'package:equatable/equatable.dart';

/// One-click in-network message chip.
///
/// Deal Brain will supply live template IDs and copy. Until then these
/// placeholders keep the shopper UI reviewable in simulators.
class DealBrainChip extends Equatable {
  const DealBrainChip({
    required this.templateId,
    required this.label,
    required this.message,
  });

  final String templateId;
  final String label;
  final String message;

  @override
  List<Object?> get props => [templateId, label, message];

  /// Stub chips. Copy is a price brief, never "negotiate".
  static const stubs = <DealBrainChip>[
    DealBrainChip(
      templateId: 'deal_brain.price_brief',
      label: 'Price brief',
      message:
          'Could you share an itemized out-the-door number for this listing?',
    ),
    DealBrainChip(
      templateId: 'deal_brain.availability',
      label: 'Still available?',
      message: 'Is this vehicle still available?',
    ),
    DealBrainChip(
      templateId: 'deal_brain.fees',
      label: 'Which fees?',
      message: 'Which fees are already in the listed price?',
    ),
  ];
}
