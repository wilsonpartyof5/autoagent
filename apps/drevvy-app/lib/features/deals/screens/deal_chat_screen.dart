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
/// Texts already stored on the deal thread are shown. In demo, a send
/// appends to that same in-memory thread. There is no dealer-reply
/// transport here, so a send does not invent a reply and does not spend
/// another key. Live mode has no dealer delivery yet, so the composer
/// stays hidden.
class DealChatScreen extends StatefulWidget {
  const DealChatScreen({super.key, required this.dealId, this.repository});

  final String dealId;
  final DemoRepository? repository;

  @override
  State<DealChatScreen> createState() => _DealChatScreenState();
}

class _DealChatScreenState extends State<DealChatScreen> {
  late final DemoRepository _repo =
      widget.repository ?? DemoRepository.instance;
  final _controller = TextEditingController();
  Deal? _deal;
  List<DealThreadMessage> _messages = const [];
  bool _loading = true;
  bool _missing = false;
  bool _keySpent = false;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(DealChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.dealId != widget.dealId) _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_loadGeneration;
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
    setState(() {
      _deal = match;
      _messages = _repo.dealThread(match!.id);
      _keySpent = _repo.hasStartedConversation(match.listingId);
      _loading = false;
      _missing = false;
    });
  }

  void _send() {
    if (_repo.isLive) return;
    final deal = _deal;
    final text = _controller.text.trim();
    if (deal == null || text.isEmpty) return;
    _repo.rememberDealMessage(deal.id, author: 'shopper', body: text);
    _controller.clear();
    setState(() => _messages = _repo.dealThread(deal.id));
  }

  @override
  Widget build(BuildContext context) {
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
                _Bubble(message: message, dealerLabel: who),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, safe + 8),
          child: _repo.isLive
              ? const _ComingSoon()
              : _Composer(controller: _controller, onSend: _send),
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
  const _Bubble({required this.message, required this.dealerLabel});

  final DealThreadMessage message;
  final String dealerLabel;

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
                if (!mine)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text(
                      dealerLabel,
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
