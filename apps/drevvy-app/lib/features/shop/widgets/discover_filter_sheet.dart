import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/discover/discover_filters.dart';

/// Allow-listed Discover filters. Applying an invalid value stays on the sheet.
class DiscoverFilterSheet extends StatefulWidget {
  const DiscoverFilterSheet({super.key, required this.initial});

  final DiscoverFilters initial;

  static Future<DiscoverFilters?> show(
    BuildContext context, {
    required DiscoverFilters initial,
  }) {
    return showModalBottomSheet<DiscoverFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DiscoverFilterSheet(initial: initial),
    );
  }

  @override
  State<DiscoverFilterSheet> createState() => _DiscoverFilterSheetState();
}

class _DiscoverFilterSheetState extends State<DiscoverFilterSheet> {
  late final TextEditingController _make;
  late final TextEditingController _model;
  late final TextEditingController _priceMin;
  late final TextEditingController _priceMax;
  late final TextEditingController _miles;
  late final TextEditingController _yearMin;
  late final TextEditingController _yearMax;
  String? _condition;
  String? _body;
  late int _radius;
  String? _error;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _make = TextEditingController(text: initial.make ?? '');
    _model = TextEditingController(text: initial.model ?? '');
    _priceMin = TextEditingController(text: initial.priceMin?.toString() ?? '');
    _priceMax = TextEditingController(text: initial.priceMax?.toString() ?? '');
    _miles = TextEditingController(text: initial.milesMax?.toString() ?? '');
    _yearMin = TextEditingController(text: initial.yearMin?.toString() ?? '');
    _yearMax = TextEditingController(text: initial.yearMax?.toString() ?? '');
    _condition = initial.condition;
    _body = initial.bodyType;
    _radius = initial.radiusMiles;
  }

  @override
  void dispose() {
    _make.dispose();
    _model.dispose();
    _priceMin.dispose();
    _priceMax.dispose();
    _miles.dispose();
    _yearMin.dispose();
    _yearMax.dispose();
    super.dispose();
  }

  int? _optional(String raw, String label) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    final value = int.tryParse(trimmed);
    if (value == null) {
      _error = '$label must be a whole number.';
      return null;
    }
    return value;
  }

  void _apply() {
    _error = null;
    final priceMin = _optional(_priceMin.text, 'Minimum price');
    final priceMax = _optional(_priceMax.text, 'Maximum price');
    final miles = _optional(_miles.text, 'Maximum miles');
    final yearMin = _optional(_yearMin.text, 'Start year');
    final yearMax = _optional(_yearMax.text, 'End year');
    if (_error != null) {
      setState(() {});
      return;
    }
    final filters = DiscoverFilters(
      make: _blank(_make.text),
      model: _blank(_model.text),
      priceMin: priceMin,
      priceMax: priceMax,
      milesMax: miles,
      yearMin: yearMin,
      yearMax: yearMax,
      condition: _condition,
      bodyType: _body,
      radiusMiles: _radius,
    );
    final problem = filters.validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    Navigator.pop(context, filters);
  }

  String? _blank(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Material(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(DrevvyRadius.sheetTop)),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Filters', style: text.title),
                const SizedBox(height: DrevvySpace.s3),
                TextField(controller: _make, decoration: const InputDecoration(labelText: 'Make')),
                TextField(controller: _model, decoration: const InputDecoration(labelText: 'Model')),
                TextField(
                  controller: _priceMin,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Minimum price'),
                ),
                TextField(
                  controller: _priceMax,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Maximum price'),
                ),
                TextField(
                  controller: _miles,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Maximum miles'),
                ),
                TextField(
                  controller: _yearMin,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Year from'),
                ),
                TextField(
                  controller: _yearMax,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Year to'),
                ),
                DropdownButton<String?>(
                  value: _condition,
                  hint: const Text('Condition'),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Any condition')),
                    for (final condition in DiscoverFilters.conditions)
                      DropdownMenuItem(value: condition, child: Text(condition)),
                  ],
                  onChanged: (value) => setState(() => _condition = value),
                ),
                DropdownButton<String?>(
                  value: _body,
                  hint: const Text('Body'),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Any body')),
                    for (final body in DiscoverFilters.bodyTypes)
                      DropdownMenuItem(value: body, child: Text(body)),
                  ],
                  onChanged: (value) => setState(() => _body = value),
                ),
                const SizedBox(height: DrevvySpace.s2),
                Text('Radius $_radius miles', style: text.callout),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final miles in const [10, 25, 50])
                      ChoiceChip(
                        label: Text('$miles mi'),
                        selected: _radius == miles,
                        onSelected: (_) => setState(() => _radius = miles),
                      ),
                  ],
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: DrevvySpace.s2),
                    child: Text(_error!, style: text.callout.copyWith(color: colors.danger)),
                  ),
                const SizedBox(height: DrevvySpace.s3),
                TextButton(onPressed: _apply, child: const Text('Apply filters')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
