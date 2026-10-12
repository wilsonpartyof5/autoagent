import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/search_profile.dart';

/// Screen 54: Memory sheet per spec §6.14
/// Modal sheet showing "Using your past searches" with per-item on/off toggles.
/// Tapping the chip opens this; turning an item off excludes it for this chat only.
class MemorySheet extends StatefulWidget {
  const MemorySheet({
    super.key,
    required this.items,
    required this.onItemsChanged,
  });

  final List<MemoryItem> items;
  final ValueChanged<Set<String>> onItemsChanged;

  static Future<void> show(
    BuildContext context, {
    required List<MemoryItem> items,
    required ValueChanged<Set<String>> onItemsChanged,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => MemorySheet(
        items: items,
        onItemsChanged: onItemsChanged,
      ),
    );
  }

  @override
  State<MemorySheet> createState() => _MemorySheetState();
}

class _MemorySheetState extends State<MemorySheet> {
  late Set<String> _enabledItemIds;

  @override
  void initState() {
    super.initState();
    _enabledItemIds = widget.items.map((i) => i.id).toSet();
  }

  void _toggleItem(String itemId) {
    setState(() {
      if (_enabledItemIds.contains(itemId)) {
        _enabledItemIds.remove(itemId);
      } else {
        _enabledItemIds.add(itemId);
      }
    });
    widget.onItemsChanged(_enabledItemIds);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      margin: const EdgeInsets.only(top: 60),
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
        boxShadow: colors.elevSheet,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: DrevvySpace.s3),
                width: 36,
                height: 5,
                decoration: BoxDecoration(
                  color: colors.track,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Row(
                    children: [
                      Icon(LucideIcons.history, color: colors.violet, size: 24),
                      const SizedBox(width: DrevvySpace.s3),
                      Text(
                        'Using your past searches',
                        style: text.title,
                      ),
                    ],
                  ),

                  const SizedBox(height: DrevvySpace.s3),

                  Text(
                    'Drevvy used these to answer. Turn any off for this chat, or edit them in Profile.',
                    style: text.body.copyWith(color: colors.muted),
                  ),

                  const SizedBox(height: DrevvySpace.s6),

                  // Memory items with toggles
                  GlassCard(
                    child: Column(
                      children: widget.items.asMap().entries.map((entry) {
                        final index = entry.key;
                        final item = entry.value;
                        final isEnabled = _enabledItemIds.contains(item.id);

                        return Column(
                          children: [
                            if (index > 0)
                              Divider(height: 1, color: colors.line),
                            _MemoryToggleRow(
                              item: item,
                              isEnabled: isEnabled,
                              onToggle: () => _toggleItem(item.id),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: DrevvySpace.s6),

                  // Buttons
                  Row(
                    children: [
                      Expanded(
                        child: DrevvyButton(
                          label: 'Edit in Profile',
                          variant: DrevvyButtonVariant.secondary,
                          onPressed: () {
                            Navigator.pop(context);
                            context.go('/profile');
                          },
                        ),
                      ),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: DrevvyButton(
                          label: 'Done',
                          onPressed: () => Navigator.pop(context),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MemoryToggleRow extends StatelessWidget {
  const _MemoryToggleRow({
    required this.item,
    required this.isEnabled,
    required this.onToggle,
  });

  final MemoryItem item;
  final bool isEnabled;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.kind.label,
                  style: text.bodyStrong.copyWith(color: colors.ink),
                ),
                Text(
                  item.displayValue,
                  style: text.callout.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: isEnabled,
            onChanged: (_) => onToggle(),
            activeTrackColor: colors.violet,
          ),
        ],
      ),
    );
  }
}
