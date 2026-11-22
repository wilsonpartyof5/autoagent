import 'package:flutter/material.dart';

import '../../../core/config/api_config_exception.dart';
import '../../../core/navigation/shopper_label.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/nav_top_bar.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/purchase_service.dart';
import '../../../data/services/shopper_session_store.dart';
import '../../shop/widgets/account_sheet.dart';
import '../../shop/widgets/get_more_keys.dart';

/// Profile from the drawer footer.
///
/// Alert switches follow [NotificationPrefs] in demo mode, where
/// [DemoRepository.updateUser] keeps them. Live profiles have no alert
/// API, so those switches stay off and do not pretend to save.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.repository});

  final DemoRepository? repository;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final DemoRepository _repo = widget.repository ?? DemoRepository.instance;
  User? _user;
  int? _keys;
  bool _loading = true;
  String? _error;
  bool _analyticsOn = true;

  @override
  void initState() {
    super.initState();
    _analyticsOn = ProductAnalytics.instance.optedIn;
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await _repo.getCurrentUser();
      final balance = await _repo.getCreditBalance();
      if (!mounted) return;
      setState(() {
        _user = user;
        _keys = balance.balance;
        _error = null;
        _loading = false;
      });
    } on ApiConfigException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'This profile is not available.';
        _loading = false;
      });
    }
  }

  Future<void> _setAlert({
    bool? priceDrops,
    bool? newOffers,
    bool? dealerResponses,
  }) async {
    final user = _user;
    if (user == null || _repo.isLive) return;
    final saved = await _repo.updateUser(
      user.copyWith(
        notificationPrefs: user.notificationPrefs.copyWith(
          priceDrops: priceDrops,
          newOffers: newOffers,
          dealerResponses: dealerResponses,
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _user = saved);
  }

  Future<void> _restore() async {
    try {
      final result = await _repo.restorePurchases();
      if (!mounted) return;
      _toast(restoreResultMessage(result, demo: !_repo.isLive));
      await _load();
    } on ApiConfigException catch (error) {
      if (!mounted) return;
      _toast(error.message);
    } catch (_) {
      if (!mounted) return;
      _toast('Purchases were not restored.');
    }
  }

  Future<void> _signOut() async {
    await ShopperSessionStore.instance.clear();
    if (!mounted) return;
    _toast('Signed out.');
    await _load();
  }

  void _help() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Help'),
          content: const Text('Help is not available in the app yet.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('OK'),
            ),
          ],
        );
      },
    );
  }

  void _delete() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Delete account'),
          content: const Text(accountDeletionUnavailableMessage),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('OK'),
            ),
          ],
        );
      },
    );
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          NavTopBar(title: 'Profile', repository: _repo),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: EdgeInsets.fromLTRB(
                      16,
                      4,
                      16,
                      24 + MediaQuery.paddingOf(context).bottom,
                    ),
                    children: [
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _error!,
                            style: text.body.copyWith(color: colors.danger),
                          ),
                        ),
                      _header(colors, text),
                      const SizedBox(height: 14),
                      _keysCard(colors, text),
                      const SizedBox(height: 14),
                      _sectionLabel('ALERTS', text, colors),
                      _alerts(colors, text),
                      const SizedBox(height: 12),
                      _sectionLabel('ACCOUNT', text, colors),
                      _account(colors, text),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _header(DrevvyColors colors, DrevvyText text) {
    final user = _user;
    final name = user == null ? 'Profile' : shopperFirstName(user);
    final letter = user == null ? null : shopperAvatarLetter(user);
    final email = user?.email.trim() ?? '';
    return Row(
      children: [
        _ProfileAvatar(letter: letter),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: text.headline.copyWith(fontSize: 20)),
              const SizedBox(height: 2),
              Text(
                email.isEmpty ? 'Not on this account' : email,
                style: text.callout.copyWith(color: colors.muted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _keysCard(DrevvyColors colors, DrevvyText text) {
    final count = _keys;
    final title = count == null ? 'Keys' : '$count keys';
    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: DrevvyBrand.gradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.key, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: text.bodyStrong.copyWith(fontSize: 16)),
                  Text(
                    'Use a key to see a fair price or text a dealer.',
                    style: text.label.copyWith(color: colors.muted),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () async {
                await showGetMoreKeys(context, repository: _repo);
                await _load();
              },
              child: const Text('Get more'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _alerts(DrevvyColors colors, DrevvyText text) {
    final prefs = _user?.notificationPrefs;
    final live = _repo.isLive;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (live)
          Padding(
            key: const Key('profile-alerts-unavailable'),
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Alert settings are not available yet.',
              style: text.callout.copyWith(color: colors.muted),
            ),
          ),
        _group(
          colors,
          children: [
            _switchRow(
              'Price drops',
              value: live ? false : (prefs?.priceDrops ?? false),
              enabled: !live && prefs != null,
              onChanged: (value) => _setAlert(priceDrops: value),
            ),
            _switchRow(
              'New offers',
              value: live ? false : (prefs?.newOffers ?? false),
              enabled: !live && prefs != null,
              onChanged: (value) => _setAlert(newOffers: value),
            ),
            _switchRow(
              'New texts from a dealer',
              value: live ? false : (prefs?.dealerResponses ?? false),
              enabled: !live && prefs != null,
              onChanged: (value) => _setAlert(dealerResponses: value),
            ),
          ],
        ),
      ],
    );
  }

  Widget _account(DrevvyColors colors, DrevvyText text) {
    final user = _user;
    final email = user?.email.trim() ?? '';
    final signedIn = ShopperSessionStore.instance.accessToken != null;
    return _group(
      colors,
      children: [
        _valueRow(
          'First name',
          user == null ? '' : shopperFirstName(user),
          colors,
          text,
        ),
        _valueRow(
          'Email',
          email.isEmpty ? 'Not on this account' : email,
          colors,
          text,
        ),
        _tapRow('Restore purchases', colors, text, onTap: _restore),
        _tapRow('Help', colors, text, onTap: _help),
        _switchRow(
          'Analytics',
          value: _analyticsOn,
          enabled: true,
          onChanged: (value) async {
            setState(() => _analyticsOn = value);
            await ProductAnalytics.instance.setOptedIn(value);
          },
        ),
        if (signedIn) _tapRow('Sign out', colors, text, onTap: _signOut),
        _tapRow(
          'Delete account',
          colors,
          text,
          destructive: true,
          onTap: _delete,
        ),
      ],
    );
  }

  Widget _sectionLabel(String label, DrevvyText text, DrevvyColors colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
      child: Text(
        label,
        style: text.micro.copyWith(
          color: colors.placeholder,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _group(DrevvyColors colors, {required List<Widget> children}) {
    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }

  Widget _valueRow(
    String label,
    String value,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    return _rowShell(
      colors,
      child: Row(
        children: [
          Expanded(child: Text(label, style: text.bodyStrong.copyWith(fontSize: 15))),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: text.body.copyWith(color: colors.muted, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tapRow(
    String label,
    DrevvyColors colors,
    DrevvyText text, {
    required VoidCallback onTap,
    bool destructive = false,
  }) {
    return InkWell(
      onTap: onTap,
      child: _rowShell(
        colors,
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: text.bodyStrong.copyWith(
                  fontSize: 15,
                  color: destructive ? colors.danger : colors.ink,
                ),
              ),
            ),
            Icon(Icons.chevron_right, color: colors.placeholder),
          ],
        ),
      ),
    );
  }

  Widget _switchRow(
    String label, {
    required bool value,
    required bool enabled,
    required ValueChanged<bool> onChanged,
  }) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return _rowShell(
      colors,
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: text.bodyStrong.copyWith(fontSize: 15)),
          ),
          Switch(
            value: value,
            onChanged: enabled ? onChanged : null,
          ),
        ],
      ),
    );
  }

  Widget _rowShell(DrevvyColors colors, {required Widget child}) {
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.line.withValues(alpha: 0.7))),
      ),
      alignment: Alignment.centerLeft,
      child: child,
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.letter});

  final String? letter;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: DrevvyBrand.gradient,
      ),
      child: letter == null
          ? const Icon(Icons.person, color: Colors.white, size: 28)
          : Text(
              letter!,
              style: context.drevvyText.headline.copyWith(
                color: Colors.white,
                fontSize: 20,
              ),
            ),
    );
  }
}
