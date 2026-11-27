import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/chat.dart';

/// Called with the typed text. Return false to keep the text in the box
/// (nothing was sent). Return true or null once the message is on screen.
typedef ComposerSend = FutureOr<bool?> Function(String text);

class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    required this.mode,
    required this.onSend,
    this.isLoading = false,
  });

  final ChatMode mode;
  final ComposerSend onSend;
  final bool isLoading;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final _controller = TextEditingController();
  bool _hasText = false;
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// One send at a time. The box clears only after the screen says the
  /// message was added, so a failed send never loses what was typed.
  Future<void> _send() async {
    final text = _controller.text;
    if (text.trim().isEmpty || widget.isLoading || _sending) return;
    _sending = true;
    try {
      final accepted = await widget.onSend(text);
      if (!mounted || accepted == false) return;
      if (_controller.text == text) {
        _controller.clear();
        setState(() => _hasText = false);
      }
    } finally {
      _sending = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final placeholder = widget.mode == ChatMode.ask
        ? 'Ask about cars…'
        : 'Search cars nearby...';

    return Container(
      margin: EdgeInsets.zero,
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
                        contentPadding: const EdgeInsets.only(left: 18),
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
                Semantics(
                  label: 'Send',
                  button: true,
                  enabled: !widget.isLoading,
                  child: GestureDetector(
                  onTap: widget.isLoading ? null : _send,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 36,
                    height: 36,
                    margin: const EdgeInsets.only(right: DrevvySpace.s2),
                    decoration: BoxDecoration(
                      gradient: _hasText && !widget.isLoading
                          ? DrevvyColors.brandGradient
                          : null,
                      color: _hasText && !widget.isLoading ? null : colors.track,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      LucideIcons.arrowUp,
                      color: _hasText && !widget.isLoading
                          ? Colors.white
                          : colors.muted,
                      size: 20,
                    ),
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
