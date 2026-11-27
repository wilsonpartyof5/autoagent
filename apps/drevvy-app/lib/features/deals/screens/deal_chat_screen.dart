import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/nav_top_bar.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/deal_summary_card.dart';
import '../../shop/widgets/listing_photo.dart';

/// Pushed child of Deals. Back returns to Deals. No hamburger.
///
/// Texts already stored on the deal thread are shown. Demo sends stay
/// on this device. A deal the server created posts each shopper line and
/// polls for salesperson lines while this screen is visible. A live deal
/// that was not created through the server keeps the composer hidden.
class DealChatScreen extends StatefulWidget {
  const DealChatScreen({
    super.key,
    required this.dealId,
    this.repository,
    this.pollInterval = const Duration(seconds: 4),
    this.maxPollInterval = const Duration(seconds: 30),
  });

  final String dealId;
  final DemoRepository? repository;

  /// How often a visible server thread asks for new lines.
  final Duration pollInterval;

  /// Longest wait after a failed poll.
  final Duration maxPollInterval;

  @override
  State<DealChatScreen> createState() => _DealChatScreenState();
}

/// Next poll wait. A failure doubles the wait up to [max]. A success
/// returns to [base].
Duration nextDealPollDelay(
  Duration current, {
  required bool failed,
  required Duration base,
  required Duration max,
}) {
  if (!failed) return base;
  final doubled = current * 2;
  if (doubled > max) return max;
  if (doubled < base) return base;
  return doubled;
}

class _DealChatScreenState extends State<DealChatScreen>
    with WidgetsBindingObserver {
  late final DemoRepository _repo =
      widget.repository ?? DemoRepository.instance;
  final _controller = TextEditingController();
  Deal? _deal;
  List<DealThreadMessage> _messages = const [];
  bool _loading = true;
  bool _missing = false;
  bool _keySpent = false;
  bool _sending = false;
  bool _appResumed = true;
  String? _sendError;
  String? _threadError;
  int _loadGeneration = 0;
  int _pollGeneration = 0;
  Timer? _pollTimer;
  late Duration _pollDelay = widget.pollInterval;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void didUpdateWidget(DealChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.dealId != widget.dealId) _load();
  }

  @override
  void dispose() {
    _pollGeneration++;
    _pollTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appResumed = state == AppLifecycleState.resumed;
    _considerPoll();
  }

  bool get _serverThread => _deal?.serverThread == true;

  bool get _shouldPoll {
    if (!mounted || !_serverThread || !_appResumed || _loading) return false;
    final route = ModalRoute.of(context);
    return route == null || route.isCurrent;
  }

  void _considerPoll() {
    if (!_shouldPoll) {
      _pollTimer?.cancel();
      _pollTimer = null;
      return;
    }
    if (_pollTimer != null) return;
    _pollTimer = Timer(_pollDelay, () => unawaited(_onPoll()));
  }

  Future<void> _onPoll() async {
    _pollTimer = null;
    final deal = _deal;
    if (!mounted || deal == null || !_shouldPoll) return;
    final generation = _pollGeneration;
    final result = await _repo.refreshDealThread(deal.id);
    if (!mounted || generation != _pollGeneration || deal.id != _deal?.id) {
      return;
    }
    final failed = result.error != null;
    setState(() {
      if (!_sending) _messages = result.messages;
      _threadError = result.error;
      _pollDelay = nextDealPollDelay(
        _pollDelay,
        failed: failed,
        base: widget.pollInterval,
        max: widget.maxPollInterval,
      );
    });
    _considerPoll();
  }

  Future<void> _load() async {
    final generation = ++_loadGeneration;
    _pollGeneration++;
    _pollTimer?.cancel();
    _pollTimer = null;
    final deals = await _repo.getDeals();
    if (!mounted || generation != _loadGeneration) return;
    Deal? match;
    for (final deal in deals) {
      if (deal.id == widget.dealId) {
        match = deal;
        break;
      }
    }
    if (match == null) {
      setState(() {
        _loading = false;
        _missing = true;
        _deal = null;
        _messages = const [];
      });
      return;
    }
    var messages = _repo.dealThread(match.id);
    String? threadError;
    if (match.serverThread) {
      final refreshed = await _repo.refreshDealThread(match.id);
      if (!mounted || generation != _loadGeneration) return;
      messages = refreshed.messages;
      threadError = refreshed.error;
    }
    setState(() {
      _deal = match;
      _messages = messages;
      _threadError = threadError;
      _keySpent = match!.serverThread || _repo.hasStartedConversation(match.listingId);
      _loading = false;
      _missing = false;
      _pollDelay = widget.pollInterval;
    });
    _considerPoll();
  }

  void _send() {
    unawaited(_sendMessage());
  }

  Future<void> _sendMessage() async {
    final deal = _deal;
    final text = _controller.text.trim();
    if (deal == null || text.isEmpty || _sending) return;
    if (_repo.isLive && !deal.serverThread) return;
    setState(() {
      _sending = true;
      _sendError = null;
    });
    final error = await _repo.sendDealThreadMessage(deal.id, text);
    if (!mounted) return;
    setState(() {
      _sending = false;
      _sendError = error;
      if (error == null) {
        _controller.clear();
        _messages = _repo.dealThread(deal.id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_serverThread) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _considerPoll();
      });
    }
    final colors = context.drevvy;
    final text = context.drevvyText;
    final deal = _deal;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          NavTopBar(
            title: deal == null ? 'Chat' : _title(deal),
            leading: NavLeading.back,
            repository: _repo,
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _missing || deal == null
                ? _Missing(message: 'This deal is not available.')
                : _thread(context, deal, colors, text),
          ),
        ],
      ),
    );
  }

  String _title(Deal deal) => dealPartyLabel(deal);

  String _bubbleLabel(DealThreadMessage message, String dealerLabel) {
    final author = message.author?.trim().toLowerCase() ?? '';
    return switch (author) {
      'salesperson' => 'Salesperson',
      'drevvy' => 'Drevvy',
      'shopper' || '' => '',
      _ => dealerLabel,
    };
  }

  Widget _thread(
    BuildContext context,
    Deal deal,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    final listing = deal.listing;
    final safe = MediaQuery.paddingOf(context).bottom;
    final who = dealPartyLabel(deal);
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            children: [
              Material(
                color: colors.glassSolid,
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 56,
                          height: 44,
                          child: ListingPhoto(url: listing.media.primaryPhoto),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              listing.shortTitle,
                              style: text.bodyStrong.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              '$who · ${deal.status.label}',
                              style: text.label.copyWith(color: colors.muted),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (_keySpent)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    'You used 1 key to text this dealer.',
                    textAlign: TextAlign.center,
                    style: text.label.copyWith(color: colors.placeholder),
                  ),
                ),
              if (_messages.isEmpty)
                Padding(
                  key: const Key('deal-chat-empty'),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'No texts with this dealer yet.',
                    textAlign: TextAlign.center,
                    style: text.body.copyWith(color: colors.muted),
                  ),
                ),
              for (final message in _messages) ...[
                _Bubble(message: message, label: _bubbleLabel(message, who)),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, safe + 8),
          child: _repo.isLive && !_serverThread
              ? const _ComingSoon()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_threadError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          _threadError!,
                          textAlign: TextAlign.center,
                          style: text.body.copyWith(color: colors.muted),
                        ),
                      ),
                    if (_sendError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          _sendError!,
                          key: const Key('deal-chat-send-error'),
                          textAlign: TextAlign.center,
                          style: text.body.copyWith(color: colors.ink),
                        ),
                      ),
                    _Composer(
                      controller: _controller,
                      onSend: _sending ? () {} : _send,
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _Missing extends StatelessWidget {
  const _Missing({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: context.drevvyText.body.copyWith(color: context.drevvy.muted),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.label});

  final DealThreadMessage message;
  final String label;

  @override
  Widget build(BuildContext context) {
    final author = message.author?.trim().toLowerCase() ?? '';
    final mine = author.isEmpty || author == 'shopper';
    final text = context.drevvyText;
    final colors = context.drevvy;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: mine ? DrevvyBrand.gradient : null,
            color: mine ? null : colors.glassSolid,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(20),
              topRight: const Radius.circular(20),
              bottomLeft: Radius.circular(mine ? 20 : 6),
              bottomRight: Radius.circular(mine ? 6 : 20),
            ),
            boxShadow: mine ? null : colors.elev1,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!mine && label.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text(
                      label,
                      key: label == 'Salesperson'
                          ? const Key('deal-chat-salesperson')
                          : null,
                      style: text.micro.copyWith(
                        color: colors.violet,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                Text(
                  message.body,
                  style: text.body.copyWith(
                    color: mine ? Colors.white : colors.ink,
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

class _ComingSoon extends StatelessWidget {
  const _ComingSoon();

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: const Key('deal-chat-coming-soon'),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Text(
        'Dealer chat is coming soon.',
        textAlign: TextAlign.center,
        style: context.drevvyText.body.copyWith(color: context.drevvy.muted),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSend});

  final TextEditingController controller;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(26),
      elevation: 2,
      shadowColor: const Color(0x1F283078),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 52),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                key: const Key('deal-chat-composer'),
                controller: controller,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                style: text.body,
                decoration: InputDecoration(
                  hintText: 'Text the dealer…',
                  hintStyle: text.body.copyWith(color: colors.placeholder),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 18),
                ),
              ),
            ),
            Semantics(
              key: const Key('deal-chat-send'),
              label: 'Send',
              button: true,
              child: Padding(
                padding: const EdgeInsets.only(right: 7),
                child: Material(
                  color: colors.violet,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: onSend,
                    child: const SizedBox(
                      width: 38,
                      height: 38,
                      child: Icon(
                        Icons.arrow_upward,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
