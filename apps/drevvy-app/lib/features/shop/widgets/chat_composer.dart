import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/chat.dart';

class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    required this.mode,
    required this.onSend,
    this.isLoading = false,
  });

  final ChatMode mode;
  final ValueChanged<String> onSend;
  final bool isLoading;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final _controller = TextEditingController();
  bool _hasText = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    if (_controller.text.isEmpty || widget.isLoading) return;
    widget.onSend(_controller.text);
    _controller.clear();
    setState(() => _hasText = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final placeholder = widget.mode == ChatMode.ask
        ? 'Ask about any car...'
        : 'Search cars nearby...';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(DrevvyRadius.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: DrevvyColors.glassBlur, sigmaY: DrevvyColors.glassBlur),
          child: Container(
            constraints: const BoxConstraints(minHeight: DrevvySpace.composerMinHeight),
            decoration: BoxDecoration(
              color: colors.glass,
              borderRadius: BorderRadius.circular(DrevvyRadius.xl),
              border: Border.all(color: colors.glassBorder),
              boxShadow: colors.elev2,
            ),
            child: Row(
              children: [
                IconButton(
                  icon: Icon(LucideIcons.mic, color: colors.muted),
                  onPressed: () {
                    // TODO: Voice input
                  },
                ),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: DrevvyMotion.composerPlaceholderFade.duration,
                    child: TextField(
                      key: ValueKey(widget.mode),
                      controller: _controller,
                      decoration: InputDecoration(
                        hintText: placeholder,
                        hintStyle: text.body.copyWith(color: colors.placeholder),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                      style: text.body,
                      textInputAction: TextInputAction.send,
                      onChanged: (value) {
                        setState(() => _hasText = value.isNotEmpty);
                      },
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: _send,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 36,
                    height: 36,
                    margin: const EdgeInsets.only(right: DrevvySpace.s2),
                    decoration: BoxDecoration(
                      gradient: _hasText ? DrevvyColors.brandGradient : null,
                      color: _hasText ? null : colors.track,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      LucideIcons.arrowUp,
                      color: _hasText ? Colors.white : colors.muted,
                      size: 20,
                    ),
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
