import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/chat.dart';
import '../../../data/models/search_profile.dart';
import 'memory_sheet.dart';

/// Chat messages view with "Using your past searches" chip per spec §6.14 (v1.6.1)
class ChatMessages extends StatelessWidget {
  const ChatMessages({
    super.key,
    required this.thread,
    required this.isLoading,
    required this.onShopTap,
    this.memoryItems,
    this.onMemoryItemsChanged,
  });

  final ChatThread thread;
  final bool isLoading;
  final ValueChanged<String> onShopTap;
  final List<MemoryItem>? memoryItems;
  final ValueChanged<Set<String>>? onMemoryItemsChanged;

  void _showMemorySheet(BuildContext context) {
    if (memoryItems == null || memoryItems!.isEmpty) return;
    
    MemorySheet.show(
      context,
      items: memoryItems!,
      onItemsChanged: onMemoryItemsChanged ?? (_) {},
    );
  }

  @override
  Widget build(BuildContext context) {
    final safeBottom = MediaQuery.of(context).padding.bottom;
    // Computed bottom padding per spec §6.5a:
    // tabBarHeight + safeArea.bottom + composerHeight + 24
    final bottomPadding = DrevvySpace.contentBottomInset + safeBottom;
    
    return ListView.builder(
      padding: EdgeInsets.only(
        left: DrevvySpace.gutter,
        right: DrevvySpace.gutter,
        top: DrevvySpace.s4,
        bottom: bottomPadding,
      ),
      itemCount: thread.messages.length + (isLoading ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == thread.messages.length && isLoading) {
          return const _ThinkingIndicator();
        }
        
        final message = thread.messages[index];
        
        if (message.isUser) {
          return _UserBubble(text: message.text ?? '');
        }
        
        return _AgentMessage(
          text: message.text ?? '',
          sourcesCount: thread.sourcesCount,
          usedMemory: message.usedMemory,
          onMemoryChipTap: memoryItems != null && memoryItems!.isNotEmpty
              ? () => _showMemorySheet(context)
              : null,
        );
      },
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: DrevvySpace.s4, left: 60),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 11),
        constraints: const BoxConstraints(maxWidth: 290),
        decoration: BoxDecoration(
          gradient: DrevvyColors.brandGradient,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(DrevvyRadius.bubble),
            topRight: Radius.circular(DrevvyRadius.bubble),
            bottomLeft: Radius.circular(DrevvyRadius.bubble),
            bottomRight: Radius.circular(DrevvyRadius.bubbleTail),
          ),
          boxShadow: [
            BoxShadow(
              offset: const Offset(0, 6),
              blurRadius: 14,
              color: const Color(0xFF4650DC).withValues(alpha: 0.15),
            ),
          ],
        ),
        child: Text(
          this.text,
          style: text.body.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class _AgentMessage extends StatelessWidget {
  const _AgentMessage({
    required this.text,
    this.sourcesCount,
    this.usedMemory = false,
    this.onMemoryChipTap,
  });

  final String text;
  final int? sourcesCount;
  final bool usedMemory;
  final VoidCallback? onMemoryChipTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyles = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // "Using your past searches" chip (v1.6.1) - above agent message
          if (usedMemory) ...[
            GestureDetector(
              onTap: onMemoryChipTap,
              child: Container(
                height: DrevvySpace.minTap,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                margin: const EdgeInsets.only(left: 42, bottom: DrevvySpace.s2),
                decoration: BoxDecoration(
                  color: colors.lilacTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.history, color: colors.violet, size: 16),
                    const SizedBox(width: DrevvySpace.s2),
                    Text(
                      'Using your past searches',
                      style: textStyles.label.copyWith(
                        color: colors.violet,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  gradient: DrevvyColors.brandGradient,
                  borderRadius: BorderRadius.circular(DrevvyRadius.xs),
                ),
                child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 16),
              ),
              const SizedBox(width: DrevvySpace.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text, style: textStyles.body),
                    if (sourcesCount != null) ...[
                      const SizedBox(height: DrevvySpace.s3),
                      _SourceRow(count: sourcesCount!),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SourceRow extends StatelessWidget {
  const _SourceRow({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.database, color: colors.violet, size: 14),
          const SizedBox(width: DrevvySpace.s2),
          Text(
            'Market data · $count listings nearby',
            style: text.label.copyWith(color: colors.muted),
          ),
          const SizedBox(width: DrevvySpace.s2),
          Text(
            'Sources',
            style: text.label.copyWith(color: colors.violet, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _ThinkingIndicator extends StatefulWidget {
  const _ThinkingIndicator();

  @override
  State<_ThinkingIndicator> createState() => _ThinkingIndicatorState();
}

class _ThinkingIndicatorState extends State<_ThinkingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: DrevvyMotion.chatThinkingLoop.duration,
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              gradient: DrevvyColors.brandGradient,
              borderRadius: BorderRadius.circular(DrevvyRadius.xs),
            ),
            child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 16),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: List.generate(3, (index) {
                  return AnimatedBuilder(
                    animation: _controller,
                    builder: (context, child) {
                      final delay = index * 0.2;
                      final progress = (_controller.value + delay) % 1.0;
                      final opacity = 0.3 + (0.7 * (1 - (progress * 2 - 1).abs()));
                      return Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(right: 4),
                        decoration: BoxDecoration(
                          color: colors.violet.withValues(alpha: opacity),
                          shape: BoxShape.circle,
                        ),
                      );
                    },
                  );
                }),
              ),
              const SizedBox(height: DrevvySpace.s2),
              Row(
                children: [
                  Icon(LucideIcons.search, color: colors.muted, size: 12),
                  const SizedBox(width: 4),
                  Text(
                    'Checking recent prices...',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
