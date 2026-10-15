import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/chat.dart';

/// Chat history drawer per spec §6.13 (v1.6.1):
/// - Width 318pt (≤85%), right radius 28, scrim ink @ 38%
/// - Search field, "New chat", chats grouped by date
/// - Deal-scoped chats excluded (they live in /deal/:id)
class ChatHistoryDrawer extends StatefulWidget {
  const ChatHistoryDrawer({
    super.key,
    required this.chats,
    required this.currentChatId,
    required this.onNewChat,
    required this.onSelectChat,
    required this.onDeleteChat,
    required this.onRenameChat,
    this.onRecentSearches,
    this.recentSearchCount,
  });

  final List<ChatThread> chats;
  final String? currentChatId;
  final VoidCallback onNewChat;
  final ValueChanged<ChatThread> onSelectChat;
  final ValueChanged<String> onDeleteChat;
  final void Function(String chatId, String newTitle) onRenameChat;
  final VoidCallback? onRecentSearches;
  final int? recentSearchCount;

  @override
  State<ChatHistoryDrawer> createState() => _ChatHistoryDrawerState();
}

class _ChatHistoryDrawerState extends State<ChatHistoryDrawer> {
  final _searchController = TextEditingController();
  Timer? _debounceTimer;
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 200), () {
      setState(() => _searchQuery = value.toLowerCase());
    });
  }

  List<ChatThread> get _filteredChats {
    if (_searchQuery.isEmpty) return widget.chats;
    return widget.chats.where((chat) {
      final titleMatch = chat.displayTitle.toLowerCase().contains(_searchQuery);
      final textMatch = chat.messages.any(
        (m) => m.text?.toLowerCase().contains(_searchQuery) ?? false,
      );
      return titleMatch || textMatch;
    }).toList();
  }

  Map<String, List<ChatThread>> _groupChatsByDate(List<ChatThread> chats) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final last7Days = today.subtract(const Duration(days: 7));
    final last30Days = today.subtract(const Duration(days: 30));

    final groups = <String, List<ChatThread>>{};

    for (final chat in chats) {
      final date = chat.updatedAt ?? chat.createdAt ?? now;
      final chatDay = DateTime(date.year, date.month, date.day);

      String group;
      if (chatDay == today) {
        group = 'Today';
      } else if (chatDay == yesterday) {
        group = 'Yesterday';
      } else if (chatDay.isAfter(last7Days)) {
        group = 'Last 7 days';
      } else if (chatDay.isAfter(last30Days)) {
        group = 'Last 30 days';
      } else {
        group = _monthName(date.month);
      }

      groups.putIfAbsent(group, () => []).add(chat);
    }

    return groups;
  }

  String _monthName(int month) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return months[month - 1];
  }

  String _formatTime(DateTime? date) {
    if (date == null) return '';
    final hour = date.hour > 12
        ? date.hour - 12
        : (date.hour == 0 ? 12 : date.hour);
    final period = date.hour >= 12 ? 'PM' : 'AM';
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute $period';
  }

  void _showChatOptions(BuildContext context, ChatThread chat) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(LucideIcons.pencil, color: colors.ink),
              title: Text('Rename', style: text.body),
              onTap: () {
                Navigator.pop(context);
                _showRenameDialog(context, chat);
              },
            ),
            ListTile(
              leading: Icon(LucideIcons.trash2, color: colors.danger),
              title: Text(
                'Delete',
                style: text.body.copyWith(color: colors.danger),
              ),
              onTap: () {
                Navigator.pop(context);
                widget.onDeleteChat(chat.id);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showRenameDialog(BuildContext context, ChatThread chat) {
    final controller = TextEditingController(text: chat.displayTitle);
    final colors = context.drevvy;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rename chat'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          decoration: InputDecoration(
            hintText: 'Chat title',
            filled: true,
            fillColor: colors.tile,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                widget.onRenameChat(chat.id, controller.text);
              }
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final screenWidth = MediaQuery.of(context).size.width;
    final drawerWidth = (screenWidth * 0.85).clamp(0.0, 318.0);

    final filteredChats = _filteredChats;
    final groupedChats = _groupChatsByDate(filteredChats);

    return Drawer(
      width: drawerWidth,
      backgroundColor: colors.glassSolid,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(28)),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            Padding(
              padding: const EdgeInsets.fromLTRB(
                DrevvySpace.gutter,
                DrevvySpace.s4,
                DrevvySpace.gutter,
                DrevvySpace.s3,
              ),
              child: Text('Chats', style: text.headline),
            ),

            // Search field
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: DrevvySpace.gutter,
              ),
              child: SizedBox(
                height: DrevvySpace.minTap,
                child: TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  decoration: InputDecoration(
                    hintText: 'Search chats',
                    hintStyle: text.body.copyWith(color: colors.placeholder),
                    prefixIcon: Icon(
                      LucideIcons.search,
                      color: colors.muted,
                      size: 18,
                    ),
                    filled: true,
                    fillColor: colors.tile,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ),

            const SizedBox(height: DrevvySpace.s3),

            // New chat button
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: DrevvySpace.gutter,
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    Navigator.pop(context);
                    widget.onNewChat();
                  },
                  borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                  child: Container(
                    height: DrevvySpace.minTap,
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.s3,
                    ),
                    decoration: BoxDecoration(
                      color: colors.lilacTint,
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    ),
                    child: Row(
                      children: [
                        Icon(LucideIcons.plus, color: colors.violet, size: 18),
                        const SizedBox(width: DrevvySpace.s2),
                        Text(
                          'New chat',
                          style: text.bodyStrong.copyWith(color: colors.violet),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            if (widget.onRecentSearches != null) ...[
              const SizedBox(height: DrevvySpace.s2),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: DrevvySpace.gutter,
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      widget.onRecentSearches!();
                    },
                    borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: DrevvySpace.minTap,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: DrevvySpace.s3,
                      ),
                      decoration: BoxDecoration(
                        color: colors.tile,
                        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.history,
                            color: colors.violet,
                            size: 18,
                          ),
                          const SizedBox(width: DrevvySpace.s2),
                          Expanded(
                            child: Text(
                              'Recent searches',
                              style: text.bodyStrong.copyWith(
                                color: colors.ink,
                              ),
                            ),
                          ),
                          if (widget.recentSearchCount != null)
                            Text(
                              '${widget.recentSearchCount}',
                              style: text.label.copyWith(color: colors.muted),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],

            const SizedBox(height: DrevvySpace.s4),

            // Chat list
            Expanded(
              child: filteredChats.isEmpty
                  ? _EmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(
                        horizontal: DrevvySpace.gutter,
                      ),
                      itemCount: groupedChats.keys.length,
                      itemBuilder: (context, groupIndex) {
                        final groupName = groupedChats.keys.elementAt(
                          groupIndex,
                        );
                        final groupChats = groupedChats[groupName]!;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(
                                top: DrevvySpace.s3,
                                bottom: DrevvySpace.s2,
                              ),
                              child: Text(
                                groupName,
                                style: text.label.copyWith(color: colors.muted),
                              ),
                            ),
                            ...groupChats.map(
                              (chat) => _ChatRow(
                                chat: chat,
                                isSelected: chat.id == widget.currentChatId,
                                onTap: () {
                                  Navigator.pop(context);
                                  widget.onSelectChat(chat);
                                },
                                onLongPress: () =>
                                    _showChatOptions(context, chat),
                                formatTime: _formatTime,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),

            // Footer note
            Padding(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              child: Text(
                'Chats about a car you added live in that deal, under Deals.',
                style: text.callout.copyWith(color: colors.muted),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatRow extends StatelessWidget {
  const _ChatRow({
    required this.chat,
    required this.isSelected,
    required this.onTap,
    required this.onLongPress,
    required this.formatTime,
  });

  final ChatThread chat;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final String Function(DateTime?) formatTime;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final modeIcon = chat.mode == ChatMode.ask
        ? LucideIcons.sparkles
        : LucideIcons.messageSquare;
    final modeLabel = chat.mode == ChatMode.ask ? 'Ask' : 'Shop';
    final timeOrResults =
        chat.mode == ChatMode.shop && chat.sourcesCount != null
        ? '${chat.sourcesCount} results'
        : formatTime(chat.updatedAt ?? chat.createdAt);

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s1),
      child: Material(
        color: isSelected ? colors.lilacTint : Colors.transparent,
        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          borderRadius: BorderRadius.circular(DrevvyRadius.sm),
          child: Container(
            constraints: const BoxConstraints(minHeight: 52),
            padding: const EdgeInsets.symmetric(
              horizontal: DrevvySpace.s3,
              vertical: DrevvySpace.s2,
            ),
            child: Row(
              children: [
                Icon(
                  modeIcon,
                  size: 18,
                  color: isSelected ? colors.violet : colors.muted,
                ),
                const SizedBox(width: DrevvySpace.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        chat.displayTitle,
                        style: text.bodyStrong.copyWith(
                          color: isSelected ? colors.violet : colors.ink,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '$modeLabel · $timeOrResults',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(DrevvySpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.messageSquare, color: colors.muted, size: 48),
            const SizedBox(height: DrevvySpace.s4),
            Text(
              'No chats yet.',
              style: text.body.copyWith(color: colors.muted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: DrevvySpace.s1),
            Text(
              'Your conversations will show up here.',
              style: text.callout.copyWith(color: colors.muted),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
