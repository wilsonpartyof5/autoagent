import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';

/// Screen 29: Ask Drevvy (deal-scoped chat sheet)
class AskDrevvySheet extends StatefulWidget {
  const AskDrevvySheet({
    super.key,
    required this.deal,
  });

  final Deal deal;

  @override
  State<AskDrevvySheet> createState() => _AskDrevvySheetState();
}

class _AskDrevvySheetState extends State<AskDrevvySheet> {
  final _controller = TextEditingController();
  final _messages = <_ChatMessage>[];
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    // Add initial context message
    _messages.add(_ChatMessage(
      isAgent: true,
      text: 'I\'m here to help with your ${widget.deal.listing.shortTitle} deal. What would you like to know?',
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _messages.add(_ChatMessage(isAgent: false, text: text));
      _isTyping = true;
    });
    _controller.clear();

    // Simulate response
    await Future.delayed(const Duration(milliseconds: 1500));

    if (mounted) {
      setState(() {
        _isTyping = false;
        _messages.add(_ChatMessage(
          isAgent: true,
          text: _getDemoResponse(text),
        ));
      });
    }
  }

  String _getDemoResponse(String input) {
    final lower = input.toLowerCase();
    if (lower.contains('offer') || lower.contains('price')) {
      return 'The current offer is \$${widget.deal.latestOffer?.otd ?? 'pending'}. This is ${widget.deal.savings != null ? '\$${widget.deal.savings} under the listed price' : 'still being worked on'}.';
    }
    if (lower.contains('doc fee') || lower.contains('fees')) {
      return 'The doc fee in this offer is \$399, which is typical for this state. I\'ve already removed nitrogen fill and paint protection.';
    }
    if (lower.contains('dealer') || lower.contains('who')) {
      return 'The dealer will be revealed once you accept and they send the official written offer. Right now they\'re shown as Dealer ${widget.deal.letter}.';
    }
    return 'I\'m working on getting you the best price. Is there anything specific about this offer you\'d like me to address?';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        children: [
          // Handle + header
          Container(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: colors.line)),
            ),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.track,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: DrevvySpace.s3),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: DrevvySpace.s3,
                        vertical: DrevvySpace.s1,
                      ),
                      decoration: BoxDecoration(
                        color: colors.lilacTint,
                        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.car, size: 14, color: colors.violet),
                          const SizedBox(width: DrevvySpace.s1),
                          Text(
                            widget.deal.listing.shortTitle,
                            style: text.label.copyWith(color: colors.violet),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(LucideIcons.x, color: colors.muted),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Messages
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              itemCount: _messages.length + (_isTyping ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length && _isTyping) {
                  return _TypingIndicator();
                }
                return _MessageBubble(message: _messages[index]);
              },
            ),
          ),

          // Quick replies
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
            child: Row(
              children: [
                _QuickReply(
                  label: 'What\'s the doc fee?',
                  onTap: () {
                    _controller.text = 'What\'s the doc fee?';
                    _sendMessage();
                  },
                ),
                _QuickReply(
                  label: 'Can you remove add-ons?',
                  onTap: () {
                    _controller.text = 'Can you remove any add-ons?';
                    _sendMessage();
                  },
                ),
                _QuickReply(
                  label: 'Who is the dealer?',
                  onTap: () {
                    _controller.text = 'Who is the dealer?';
                    _sendMessage();
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: DrevvySpace.s3),

          // Composer
          Container(
            padding: EdgeInsets.fromLTRB(
              DrevvySpace.gutter,
              DrevvySpace.s3,
              DrevvySpace.gutter,
              DrevvySpace.s3 + bottomPadding + keyboardHeight,
            ),
            decoration: BoxDecoration(
              color: colors.glassSolid,
              border: Border(top: BorderSide(color: colors.line)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: InputDecoration(
                      hintText: 'Ask about this deal...',
                      hintStyle: text.body.copyWith(color: colors.placeholder),
                      filled: true,
                      fillColor: colors.tile,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: DrevvySpace.s4,
                        vertical: DrevvySpace.s3,
                      ),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: DrevvySpace.s2),
                IconButton(
                  onPressed: _sendMessage,
                  icon: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: DrevvyBrand.gradient,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      LucideIcons.arrowUp,
                      color: DrevvyColors.onBrand,
                      size: 20,
                    ),
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

class _ChatMessage {
  const _ChatMessage({
    required this.isAgent,
    required this.text,
  });

  final bool isAgent;
  final String text;
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
      child: Row(
        mainAxisAlignment:
            message.isAgent ? MainAxisAlignment.start : MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (message.isAgent) ...[
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                gradient: DrevvyBrand.gradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                LucideIcons.sparkles,
                size: 14,
                color: DrevvyColors.onBrand,
              ),
            ),
            const SizedBox(width: DrevvySpace.s2),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.all(DrevvySpace.s3),
              decoration: BoxDecoration(
                color: message.isAgent ? colors.tile : colors.violet,
                borderRadius: BorderRadius.circular(DrevvyRadius.bubble),
              ),
              child: Text(
                message.text,
                style: text.body.copyWith(
                  color: message.isAgent ? colors.ink : DrevvyColors.onBrand,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickReply extends StatelessWidget {
  const _QuickReply({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(right: DrevvySpace.s2),
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.violet,
          side: BorderSide(color: colors.violet),
          padding: const EdgeInsets.symmetric(
            horizontal: DrevvySpace.s3,
            vertical: DrevvySpace.s2,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DrevvyRadius.pill),
          ),
        ),
        child: Text(label, style: text.callout),
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              gradient: DrevvyBrand.gradient,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              LucideIcons.sparkles,
              size: 14,
              color: DrevvyColors.onBrand,
            ),
          ),
          const SizedBox(width: DrevvySpace.s2),
          Container(
            padding: const EdgeInsets.all(DrevvySpace.s3),
            decoration: BoxDecoration(
              color: colors.tile,
              borderRadius: BorderRadius.circular(DrevvyRadius.bubble),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Dot(delay: 0),
                const SizedBox(width: 4),
                _Dot(delay: 150),
                const SizedBox(width: 4),
                _Dot(delay: 300),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatefulWidget {
  const _Dot({required this.delay});

  final int delay;

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) {
        _controller.repeat(reverse: true);
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Opacity(
          opacity: _animation.value,
          child: Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: colors.muted,
              shape: BoxShape.circle,
            ),
          ),
        );
      },
    );
  }
}
