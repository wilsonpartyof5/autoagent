import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/search_profile.dart';
import 'memory_edit_sheet.dart';

/// Add, edit, and delete remembered facts on demo data.
class MemoryFactsSheet extends StatefulWidget {
  const MemoryFactsSheet({
    super.key,
    required this.items,
    required this.onChanged,
  });

  final List<MemoryItem> items;
  final ValueChanged<List<MemoryItem>> onChanged;

  static Future<void> show(
    BuildContext context, {
    required List<MemoryItem> items,
    required ValueChanged<List<MemoryItem>> onChanged,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) =>
          MemoryFactsSheet(items: items, onChanged: onChanged),
    );
  }

  @override
  State<MemoryFactsSheet> createState() => _MemoryFactsSheetState();
}

class _MemoryFactsSheetState extends State<MemoryFactsSheet> {
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  late List<MemoryItem> _items;

  @override
  void initState() {
    super.initState();
    _items = List<MemoryItem>.of(widget.items);
  }

  void _publish() {
    widget.onChanged(List<MemoryItem>.of(_items));
  }

  Future<void> _edit(MemoryItem item) async {
    await MemoryEditSheet.show(
      context,
      item: item,
      onSave: (updated) {
        setState(() {
          final index = _items.indexWhere((entry) => entry.id == updated.id);
          if (index >= 0) {
            _items[index] = updated;
          } else {
            _items = [..._items, updated];
          }
        });
        _publish();
      },
    );
  }

  void _delete(MemoryItem item) {
    final index = _items.indexWhere((entry) => entry.id == item.id);
    setState(() {
      _items = _items.where((entry) => entry.id != item.id).toList();
    });
    _publish();

    _messengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Text('${item.kind.label} removed'),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () {
            if (!mounted) return;
            setState(() {
              final restored = List<MemoryItem>.of(_items);
              restored.insert(index.clamp(0, restored.length), item);
              _items = restored;
            });
            _publish();
          },
        ),
      ),
    );
  }

  Future<void> _addFact() async {
    final used = _items.map((item) => item.kind).toSet();
    final available = MemoryKind.values
        .where((kind) => !used.contains(kind))
        .toList();
    if (available.isEmpty) {
      _messengerKey.currentState?.showSnackBar(
        const SnackBar(content: Text('Every fact type is already saved')),
      );
      return;
    }

    final kind = await showDialog<MemoryKind>(
      context: context,
      builder: (dialogContext) {
        final colors = context.drevvy;
        final text = context.drevvyText;
        return AlertDialog(
          title: Text('Add a fact', style: text.title),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final option in available)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(option.label, style: text.body),
                  onTap: () => Navigator.pop(dialogContext, option),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(
                'Cancel',
                style: text.body.copyWith(color: colors.muted),
              ),
            ),
          ],
        );
      },
    );
    if (kind == null || !mounted) return;

    final draft = MemoryItem(
      id: 'mem_${DateTime.now().millisecondsSinceEpoch}',
      kind: kind,
      value: _defaultValue(kind),
      source: MemorySource.explicit,
      updatedAt: DateTime.now(),
    );
    await _edit(draft);
  }

  Object _defaultValue(MemoryKind kind) {
    return switch (kind) {
      MemoryKind.budget => 35000,
      MemoryKind.bodyTypes ||
      MemoryKind.makes ||
      MemoryKind.fuel ||
      MemoryKind.mustHaves => <String>[],
      MemoryKind.location => {'zip': '', 'radius': 50},
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return ScaffoldMessenger(
      key: _messengerKey,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.85,
            ),
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
                    padding: const EdgeInsets.fromLTRB(
                      DrevvySpace.gutter,
                      DrevvySpace.s4,
                      DrevvySpace.gutter,
                      DrevvySpace.s2,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Remembered facts', style: text.title),
                        const SizedBox(height: DrevvySpace.s2),
                        Text(
                          'Drevvy uses these when it answers. Add, edit, or delete any fact.',
                          style: text.body.copyWith(color: colors.muted),
                        ),
                      ],
                    ),
                  ),
                  Flexible(
                    child: _items.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.all(DrevvySpace.gutter),
                            child: Text(
                              'No facts yet',
                              style: text.body.copyWith(color: colors.muted),
                              textAlign: TextAlign.center,
                            ),
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            padding: const EdgeInsets.symmetric(
                              horizontal: DrevvySpace.gutter,
                            ),
                            itemCount: _items.length,
                            separatorBuilder: (_, _) =>
                                Divider(height: 1, color: colors.line),
                            itemBuilder: (context, index) {
                              final item = _items[index];
                              return _FactRow(
                                item: item,
                                onEdit: () => _edit(item),
                                onDelete: () => _delete(item),
                              );
                            },
                          ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(DrevvySpace.gutter),
                    child: DrevvyButton(
                      label: 'Add a fact',
                      icon: LucideIcons.plus,
                      variant: DrevvyButtonVariant.secondary,
                      onPressed: _addFact,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FactRow extends StatelessWidget {
  const _FactRow({
    required this.item,
    required this.onEdit,
    required this.onDelete,
  });

  final MemoryItem item;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final value = item.displayValue.trim().isEmpty
        ? 'Not set'
        : item.displayValue;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DrevvySpace.s2),
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
                Text(value, style: text.callout.copyWith(color: colors.muted)),
                if (item.isInferred)
                  Text(
                    'Learned from your searches',
                    style: text.micro.copyWith(color: colors.muted),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Edit ${item.kind.label}',
            icon: Icon(LucideIcons.pencil, size: 18, color: colors.muted),
            onPressed: onEdit,
          ),
          IconButton(
            tooltip: 'Delete ${item.kind.label}',
            icon: Icon(LucideIcons.x, size: 18, color: colors.muted),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
