import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../widgets/progress_dots.dart';

/// Screen 05: Onboarding - Preferences
class PreferencesScreen extends StatefulWidget {
  const PreferencesScreen({super.key});

  @override
  State<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> {
  int? _budgetIndex;
  final Set<String> _bodyTypes = {};
  int _tradeInIndex = 2; // unsure
  int _paymentIndex = 2; // unsure

  static const _budgets = [
    'Under \$25k',
    '\$25k – \$35k',
    '\$35k – \$50k',
    'Over \$50k',
    'Not sure yet',
  ];

  static const _bodies = ['SUV', 'Sedan', 'Truck', 'Van', 'Coupe', 'Hatchback'];
  static const _tradeInOptions = ['Yes', 'No', 'Not sure'];
  static const _paymentOptions = ['Cash', 'Finance', 'Not sure'];

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          SafeArea(
            child: Column(
              children: [
                // Top bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s2),
                  child: Row(
                    children: [
                      IconButton(
                        icon: Icon(LucideIcons.chevronLeft, color: colors.ink),
                        onPressed: () => context.pop(),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: DrevvySpace.s4),
                
                const ProgressDots(current: 3, total: 5),
                
                const SizedBox(height: DrevvySpace.s6),
                
                Text(
                  'What are you looking for?',
                  style: text.headline,
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: DrevvySpace.s2),
                
                Text(
                  'This helps Drevvy find the right cars for you.',
                  style: text.body.copyWith(color: colors.muted),
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Budget
                        Text('Budget (out the door)', style: text.title),
                        const SizedBox(height: DrevvySpace.s3),
                        Wrap(
                          spacing: DrevvySpace.s2,
                          runSpacing: DrevvySpace.s2,
                          children: List.generate(_budgets.length, (i) {
                            final selected = _budgetIndex == i;
                            return _ChipButton(
                              label: _budgets[i],
                              selected: selected,
                              onTap: () => setState(() => _budgetIndex = i),
                            );
                          }),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Body type
                        Text('Body type', style: text.title),
                        const SizedBox(height: DrevvySpace.s3),
                        Wrap(
                          spacing: DrevvySpace.s2,
                          runSpacing: DrevvySpace.s2,
                          children: _bodies.map((body) {
                            final selected = _bodyTypes.contains(body);
                            return _ChipButton(
                              label: body,
                              selected: selected,
                              onTap: () => setState(() {
                                if (selected) {
                                  _bodyTypes.remove(body);
                                } else {
                                  _bodyTypes.add(body);
                                }
                              }),
                            );
                          }).toList(),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Trade-in
                        Text('Trading in a car?', style: text.title),
                        const SizedBox(height: DrevvySpace.s3),
                        _SegmentedControl(
                          options: _tradeInOptions,
                          selectedIndex: _tradeInIndex,
                          onChanged: (i) => setState(() => _tradeInIndex = i),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Payment
                        Text('Paying?', style: text.title),
                        const SizedBox(height: DrevvySpace.s3),
                        _SegmentedControl(
                          options: _paymentOptions,
                          selectedIndex: _paymentIndex,
                          onChanged: (i) => setState(() => _paymentIndex = i),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s4),
                        
                        // Info note
                        Container(
                          padding: const EdgeInsets.all(DrevvySpace.s3),
                          decoration: BoxDecoration(
                            color: colors.lilacTint,
                            borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                          ),
                          child: Row(
                            children: [
                              Icon(LucideIcons.info, color: colors.violet, size: 18),
                              const SizedBox(width: DrevvySpace.s2),
                              Expanded(
                                child: Text(
                                  'Drevvy focuses on price first. Trade-in and financing come after.',
                                  style: text.callout.copyWith(color: colors.onLilacTint),
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s8),
                      ],
                    ),
                  ),
                ),
                
                // CTA
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    DrevvySpace.gutter,
                    DrevvySpace.s4,
                    DrevvySpace.gutter,
                    DrevvySpace.s6 + bottomPadding,
                  ),
                  child: DrevvyButton(
                    label: 'Continue',
                    onPressed: () => context.push('/paywall?from=onboarding'),
                    isFullWidth: true,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipButton extends StatelessWidget {
  const _ChipButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? colors.violet : colors.tile,
          borderRadius: BorderRadius.circular(DrevvyRadius.pill),
          border: Border.all(
            color: selected ? colors.violet : colors.glassBorder,
          ),
        ),
        child: Text(
          label,
          style: text.label.copyWith(
            color: selected ? Colors.white : colors.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _SegmentedControl extends StatelessWidget {
  const _SegmentedControl({
    required this.options,
    required this.selectedIndex,
    required this.onChanged,
  });

  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.ink.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
      ),
      child: Row(
        children: List.generate(options.length, (i) {
          final selected = i == selectedIndex;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: selected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  boxShadow: selected
                      ? [const BoxShadow(color: Colors.black12, blurRadius: 4)]
                      : null,
                ),
                child: Text(
                  options[i],
                  textAlign: TextAlign.center,
                  style: text.label.copyWith(
                    color: selected ? colors.ink : colors.muted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
