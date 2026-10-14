import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/search_profile.dart';

/// Recent searches with run again, delete, and clear all on demo data.
class RecentSearchesSheet extends StatefulWidget {
  const RecentSearchesSheet({
    super.key,
    required this.searches,
    required this.onRun,
    required this.onDelete,
    required this.onRestore,
    required this.onClearAll,
  });

  final List<SavedSearch> searches;
  final ValueChanged<SavedSearch> onRun;
  final ValueChanged<SavedSearch> onDelete;
  final void Function(SavedSearch search, int index) onRestore;
  final VoidCallback onClearAll;

  /// Returns true when the shopper runs a search again.
  static Future<bool> show(
    BuildContext context, {
    required List<SavedSearch> searches,
    required ValueChanged<SavedSearch> onRun,
    required ValueChanged<SavedSearch> onDelete,
    required void Function(SavedSearch search, int index) onRestore,
    required VoidCallback onClearAll,
  }) async {
    final ran = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RecentSearchesSheet(
        searches: searches,
        onRun: onRun,
        onDelete: onDelete,
        onRestore: onRestore,
        onClearAll: onClearAll,
      ),
    );
    return ran ?? false;
  }

  @override
  State<RecentSearchesSheet> createState() => _RecentSearchesSheetState();
}

class _RecentSearchesSheetState extends State<RecentSearchesSheet> {
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  late List<SavedSearch> _searches;

  @override
  void initState() {
    super.initState();
    _searches = List<SavedSearch>.of(widget.searches);
  }

  void _run(SavedSearch search) {
    widget.onRun(search);
    Navigator.pop(context, true);
  }

  void _delete(SavedSearch search) {
    final index = _searches.indexWhere((entry) => entry.id == search.id);
    setState(() {
      _searches = _searches.where((entry) => entry.id != search.id).toList();
    });
    widget.onDelete(search);

    _messengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Text('Removed ${search.displayTitle}'),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () {
            if (!mounted) return;
            setState(() {
              final restored = List<SavedSearch>.of(_searches);
              restored.insert(index.clamp(0, restored.length), search);
              _searches = restored;
            });
            widget.onRestore(search, index);
          },
        ),
      ),
    );
  }

  Future<void> _confirmClearAll() async {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Clear all searches?', style: text.title),
        content: Text(
          'This removes your recent searches. Deals and saved cars stay.',
          style: text.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(
              'Cancel',
              style: text.body.copyWith(color: colors.muted),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(
              'Clear all',
              style: text.body.copyWith(color: colors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _searches = []);
    widget.onClearAll();
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
              maxHeight: MediaQuery.sizeOf(context).height * 0.75,
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
                    padding: const EdgeInsets.all(DrevvySpace.gutter),
                    child: Text('Recent searches', style: text.title),
                  ),
                  if (_searches.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        DrevvySpace.gutter,
                        0,
                        DrevvySpace.gutter,
                        DrevvySpace.s4,
                      ),
                      child: Text(
                        'No recent searches',
                        style: text.body.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
                      ),
                    )
                  else
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(
                          horizontal: DrevvySpace.gutter,
                        ),
                        itemCount: _searches.length,
                        separatorBuilder: (_, _) =>
                            Divider(height: 1, color: colors.line),
                        itemBuilder: (context, index) {
                          final search = _searches[index];
                          return _SearchRow(
                            search: search,
                            onRun: () => _run(search),
                            onDelete: () => _delete(search),
                          );
                        },
                      ),
                    ),
                  if (_searches.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        DrevvySpace.gutter,
                        DrevvySpace.s2,
                        DrevvySpace.gutter,
                        0,
                      ),
                      child: DrevvyButton(
                        label: 'Clear all',
                        variant: DrevvyButtonVariant.destructive,
                        onPressed: _confirmClearAll,
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.all(DrevvySpace.gutter),
                    child: DrevvyButton(
                      label: 'Done',
                      variant: DrevvyButtonVariant.secondary,
                      onPressed: () => Navigator.pop(context, false),
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

class _SearchRow extends StatelessWidget {
  const _SearchRow({
    required this.search,
    required this.onRun,
    required this.onDelete,
  });

  final SavedSearch search;
  final VoidCallback onRun;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DrevvySpace.s3),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.lilacTint,
              borderRadius: BorderRadius.circular(DrevvyRadius.xs),
            ),
            child: Icon(LucideIcons.search, color: colors.violet, size: 20),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  search.displayTitle,
                  style: text.bodyStrong.copyWith(color: colors.ink),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'Run ${search.runCount} ${search.runCount == 1 ? 'time' : 'times'}',
                  style: text.callout.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
          TextButton(
            key: Key('run_${search.id}'),
            onPressed: onRun,
            child: Text(
              'Run again',
              style: text.label.copyWith(
                color: colors.violet,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          IconButton(
            key: Key('delete_${search.id}'),
            tooltip: 'Delete search',
            icon: Icon(LucideIcons.trash2, size: 18, color: colors.danger),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
