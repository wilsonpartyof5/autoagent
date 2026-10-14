import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/search_profile.dart';

/// Edit sheet for memory items per spec §6.14
/// Shows appropriate pickers for each memory kind:
/// - Budget: numeric input
/// - Body types: multi-select chips
/// - Makes: multi-select chips
/// - Fuel: multi-select chips
/// - Location: ZIP + radius picker
class MemoryEditSheet extends StatefulWidget {
  const MemoryEditSheet({super.key, required this.item, required this.onSave});

  final MemoryItem item;
  final ValueChanged<MemoryItem> onSave;

  static Future<void> show(
    BuildContext context, {
    required MemoryItem item,
    required ValueChanged<MemoryItem> onSave,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => MemoryEditSheet(item: item, onSave: onSave),
    );
  }

  @override
  State<MemoryEditSheet> createState() => _MemoryEditSheetState();
}

class _MemoryEditSheetState extends State<MemoryEditSheet> {
  late Object _value;
  final _budgetController = TextEditingController();
  final _zipController = TextEditingController();
  int _radius = 50;

  static const _bodyTypes = [
    'SUV',
    'Sedan',
    'Truck',
    'Coupe',
    'Hatchback',
    'Wagon',
    'Convertible',
    'Van',
  ];
  static const _makes = [
    'Toyota',
    'Honda',
    'Mazda',
    'Hyundai',
    'Kia',
    'Ford',
    'Chevrolet',
    'BMW',
    'Mercedes-Benz',
    'Audi',
    'Tesla',
    'Subaru',
    'Lexus',
    'Volkswagen',
    'Nissan',
  ];
  static const _fuelTypes = [
    'Gas',
    'Hybrid',
    'Electric',
    'Plug-in Hybrid',
    'Diesel',
  ];
  static const _radiusOptions = [10, 25, 50, 75, 100, 150, 200];

  @override
  void initState() {
    super.initState();
    _value = widget.item.value;

    if (widget.item.kind == MemoryKind.budget && _value is int) {
      _budgetController.text = _value.toString();
    }

    if (widget.item.kind == MemoryKind.location && _value is Map) {
      final map = _value as Map;
      _zipController.text = map['zip']?.toString() ?? '';
      _radius = map['radius'] as int? ?? 50;
    }
  }

  @override
  void dispose() {
    _budgetController.dispose();
    _zipController.dispose();
    super.dispose();
  }

  void _save() {
    final updatedItem = widget.item.copyWith(
      value: _value,
      source: MemorySource.explicit,
      updatedAt: DateTime.now(),
    );
    widget.onSave(updatedItem);
    Navigator.pop(context);
  }

  void _toggleMultiSelect(String option) {
    final current = (_value as List?)?.cast<String>() ?? <String>[];
    setState(() {
      if (current.contains(option)) {
        _value = current.where((s) => s != option).toList();
      } else {
        _value = [...current, option];
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      margin: const EdgeInsets.only(top: 100),
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
        boxShadow: colors.elevSheet,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.only(
              left: DrevvySpace.gutter,
              right: DrevvySpace.gutter,
              top: DrevvySpace.gutter,
              bottom:
                  MediaQuery.of(context).viewInsets.bottom + DrevvySpace.gutter,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(bottom: DrevvySpace.s4),
                    width: 36,
                    height: 5,
                    decoration: BoxDecoration(
                      color: colors.track,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),

                // Title
                Text('Edit ${widget.item.kind.label}', style: text.title),

                const SizedBox(height: DrevvySpace.s6),

                // Content based on kind
                _buildEditor(context, colors, text),

                const SizedBox(height: DrevvySpace.s6),

                // Save button
                DrevvyButton(label: 'Save', onPressed: _save),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEditor(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    switch (widget.item.kind) {
      case MemoryKind.budget:
        return _buildBudgetEditor(colors, text);
      case MemoryKind.bodyTypes:
        return _buildMultiSelectEditor(colors, text, _bodyTypes);
      case MemoryKind.makes:
        return _buildMultiSelectEditor(colors, text, _makes);
      case MemoryKind.fuel:
        return _buildMultiSelectEditor(colors, text, _fuelTypes);
      case MemoryKind.location:
        return _buildLocationEditor(colors, text);
      case MemoryKind.mustHaves:
        return _buildMustHavesEditor(colors, text);
    }
  }

  Widget _buildBudgetEditor(DrevvyColors colors, DrevvyText text) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Maximum budget (out the door)',
          style: text.bodyStrong.copyWith(color: colors.ink),
        ),
        const SizedBox(height: DrevvySpace.s3),
        TextField(
          controller: _budgetController,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            prefixText: '\$ ',
            prefixStyle: text.body,
            filled: true,
            fillColor: colors.glass,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              borderSide: BorderSide(color: colors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              borderSide: BorderSide(color: colors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              borderSide: BorderSide(color: colors.violet, width: 2),
            ),
          ),
          style: text.body,
          onChanged: (value) {
            final parsed = int.tryParse(value);
            if (parsed != null) {
              setState(() => _value = parsed);
            }
          },
        ),
        const SizedBox(height: DrevvySpace.s4),
        Text('Quick select:', style: text.label.copyWith(color: colors.muted)),
        const SizedBox(height: DrevvySpace.s2),
        Wrap(
          spacing: DrevvySpace.s2,
          runSpacing: DrevvySpace.s2,
          children: [25000, 35000, 45000, 55000, 75000].map((amount) {
            final isSelected = _value == amount;
            return GestureDetector(
              onTap: () {
                setState(() {
                  _value = amount;
                  _budgetController.text = amount.toString();
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? colors.violet : colors.glass,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  border: Border.all(
                    color: isSelected ? colors.violet : colors.line,
                  ),
                ),
                child: Text(
                  '\$${_formatNumber(amount)}',
                  style: text.label.copyWith(
                    color: isSelected ? Colors.white : colors.ink,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMultiSelectEditor(
    DrevvyColors colors,
    DrevvyText text,
    List<String> options,
  ) {
    final selected = (_value as List?)?.cast<String>() ?? <String>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Select all that apply',
          style: text.bodyStrong.copyWith(color: colors.ink),
        ),
        const SizedBox(height: DrevvySpace.s3),
        Wrap(
          spacing: DrevvySpace.s2,
          runSpacing: DrevvySpace.s2,
          children: options.map((option) {
            final isSelected = selected.contains(option);
            return GestureDetector(
              onTap: () => _toggleMultiSelect(option),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? colors.violet : colors.glass,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  border: Border.all(
                    color: isSelected ? colors.violet : colors.line,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isSelected) ...[
                      const Icon(
                        LucideIcons.check,
                        color: Colors.white,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      option,
                      style: text.bodyStrong.copyWith(
                        color: isSelected ? Colors.white : colors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildLocationEditor(DrevvyColors colors, DrevvyText text) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('ZIP code', style: text.bodyStrong.copyWith(color: colors.ink)),
        const SizedBox(height: DrevvySpace.s3),
        TextField(
          controller: _zipController,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(5),
          ],
          decoration: InputDecoration(
            hintText: 'Enter ZIP code',
            hintStyle: text.body.copyWith(color: colors.placeholder),
            filled: true,
            fillColor: colors.glass,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              borderSide: BorderSide(color: colors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              borderSide: BorderSide(color: colors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              borderSide: BorderSide(color: colors.violet, width: 2),
            ),
          ),
          style: text.body,
          onChanged: (value) {
            _updateLocation();
          },
        ),

        const SizedBox(height: DrevvySpace.s6),

        Text(
          'Search radius',
          style: text.bodyStrong.copyWith(color: colors.ink),
        ),
        const SizedBox(height: DrevvySpace.s3),
        Wrap(
          spacing: DrevvySpace.s2,
          runSpacing: DrevvySpace.s2,
          children: _radiusOptions.map((radius) {
            final isSelected = _radius == radius;
            return GestureDetector(
              onTap: () {
                setState(() => _radius = radius);
                _updateLocation();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? colors.violet : colors.glass,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  border: Border.all(
                    color: isSelected ? colors.violet : colors.line,
                  ),
                ),
                child: Text(
                  '$radius mi',
                  style: text.bodyStrong.copyWith(
                    color: isSelected ? Colors.white : colors.ink,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  void _updateLocation() {
    setState(() {
      _value = {'zip': _zipController.text, 'radius': _radius};
    });
  }

  Widget _buildMustHavesEditor(DrevvyColors colors, DrevvyText text) {
    final mustHaves = [
      'Apple CarPlay',
      'Android Auto',
      'Blind Spot Monitor',
      'Backup Camera',
      'Leather Seats',
      'Heated Seats',
      'Sunroof',
      'Navigation',
      'Adaptive Cruise',
      'Lane Keep Assist',
      'Third Row',
      'Remote Start',
    ];
    return _buildMultiSelectEditor(colors, text, mustHaves);
  }

  String _formatNumber(int n) {
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }
}
