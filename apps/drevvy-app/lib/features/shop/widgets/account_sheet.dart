import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/config/api_config_exception.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../common/analytics_privacy.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/purchase_service.dart';
import '../../../data/services/shopper_session_store.dart';
import '../../account/widgets/car_balance_card.dart';
import '../../account/widgets/shopper_sign_in_actions.dart';
import '../../account/widgets/memory_facts_sheet.dart';
import '../../account/widgets/recent_searches_sheet.dart';
import '../../shop/car_unlock.dart';
import 'out_of_cars_sheet.dart';
import 'pack_picker_sheet.dart';

/// Account sheet per spec §6.16 (v1.8).
/// Replaces Profile tab - shown from avatar button tap.
const accountDeletionUnavailableMessage = 'Account deletion is not available.';

class AccountSheet extends StatefulWidget {
  const AccountSheet({super.key, this.repository});

  /// Overrides [DemoRepository.instance]. Tests pass the account under load.
  final DemoRepository? repository;

  @override
  State<AccountSheet> createState() => _AccountSheetState();
}

class _AccountSheetState extends State<AccountSheet> {
  late final DemoRepository _repo;
  late final ShopperAccountWatch _accountWatch;
  User? _user;
  SearchProfile? _searchProfile;
  CarCreditBalance? _creditBalance;
  String? _accountError;
  bool _isLoading = true;
  bool _analyticsOn = true;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? DemoRepository.instance;
    _analyticsOn = ProductAnalytics.instance.optedIn;
    ProductAnalytics.instance.screen('profile');
    ProductAnalytics.instance.screen('settings');
    _accountWatch = ShopperAccountWatch(_onAccountSessionChanged)..bind();
    _loadData();
  }

  @override
  void dispose() {
    _accountWatch.dispose();
    super.dispose();
  }

  bool _sessionStill(int account) => _accountWatch.same(account);

  void _onAccountSessionChanged() {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _user = null;
      _creditBalance = null;
      _accountError = null;
    });
    _loadData();
  }

  Future<void> _loadData() async {
    final account = _accountWatch.capture();
    try {
      final user = await _repo.getCurrentUser();
      final searchProfile = await _repo.getSearchProfile();
      final balance = await _repo.getCreditBalance();
      if (!mounted || !_accountWatch.same(account)) return;

      setState(() {
        _user = user;
        _searchProfile = searchProfile;
        _creditBalance = balance;
        _accountError = null;
        _isLoading = false;
      });
    } on ApiConfigException catch (error) {
      if (!mounted || !_accountWatch.same(account)) return;
      setState(() {
        _accountError = error.message;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted || !_accountWatch.same(account)) return;
    }
  }

  void _togglePersonalize(bool value) {
    if (_searchProfile == null) return;
    setState(() {
      _searchProfile = _searchProfile!.copyWith(personalize: value);
    });
    _repo.updateSearchProfile(_searchProfile!);
    ProductAnalytics.instance.track(AnalyticsEvents.personalizeToggled, {
      'enabled': value,
    });
  }

  Future<void> _toggleAnalytics(bool value) async {
    setState(() => _analyticsOn = value);
    await ProductAnalytics.instance.setOptedIn(value);
  }

  void _showPackPicker() {
    final balance = _creditBalance;
    if (balance == null) return;
    final host = Navigator.of(context, rootNavigator: true).context;
    final outOfCars = carUnlockGate(balance) == CarUnlockGate.outOfCars;
    Navigator.pop(context);
    showModalBottomSheet<void>(
      context: host,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        if (outOfCars) {
          return OutOfCarsSheet(
            placement: 'account',
            onPurchase: (packType) => _buyPack(sheetContext, host, packType),
            onNotNow: () => Navigator.pop(sheetContext),
          );
        }
        return PackPickerSheet(
          placement: 'account',
          onPurchase: (packType) => _buyPack(sheetContext, host, packType),
          onRestore: () async {
            final account = _accountWatch.capture();
            try {
              final result = await _repo.restorePurchases();
              if (!host.mounted || !_sessionStill(account)) return;
              if (sheetContext.mounted) Navigator.pop(sheetContext);
              _showPurchaseMessage(host, _restoreMessage(result));
            } catch (error) {
              if (!host.mounted || !_sessionStill(account)) return;
              _showPurchaseMessage(host, _restoreFailureMessage(error));
            }
          },
          onKeepShopping: () => Navigator.pop(sheetContext),
        );
      },
    );
  }

  Future<void> _buyPack(
    BuildContext sheetContext,
    BuildContext host,
    CarPackType packType,
  ) async {
    final account = _accountWatch.capture();
    try {
      final result = await _repo.purchasePack(packType);
      if (!host.mounted || !_sessionStill(account)) return;
      if (result is PurchaseSuccess) {
        if (sheetContext.mounted) Navigator.pop(sheetContext);
        _showPurchaseMessage(
          host,
          'Added ${result.creditsAdded == 1 ? '1 key' : '${result.creditsAdded} keys'}. Packs never expire.',
        );
        return;
      }
      if (result is PurchasePending) {
        _showPurchaseMessage(
          host,
          'Payment is pending. Keys are added when it completes.',
        );
        return;
      }
      if (result is PurchaseError) {
        _showPurchaseMessage(host, result.message);
      }
    } on ApiConfigException catch (error) {
      if (!host.mounted || !_sessionStill(account)) return;
      _showPurchaseMessage(host, error.message);
    } catch (_) {
      if (!host.mounted || !_sessionStill(account)) return;
    }
  }

  String _restoreFailureMessage(Object error) {
    if (error is ApiConfigException) return error.message;
    return 'Purchases were not restored.';
  }

  String _restoreMessage(RestoreResult result) {
    return switch (result) {
      RestoreSuccess(:final creditsRestored) when creditsRestored > 0 =>
        creditsRestored == 1
            ? 'Restored 1 key.'
            : 'Restored $creditsRestored keys.',
      RestoreSuccess() => 'Purchases restored.',
      RestoreNoPurchases() => 'No purchases to restore.',
      RestoreError(:final message) => message,
    };
  }

  void _showPurchaseMessage(BuildContext host, String message) {
    if (!host.mounted) return;
    ScaffoldMessenger.of(host).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _handleSignOut() async {
    await ShopperSessionStore.instance.clear();
    if (!mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Signed out.')));
  }

  void _handleDeleteAccount() {
    final text = context.drevvyText;
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text('Delete account', style: text.title),
          content: Text(accountDeletionUnavailableMessage, style: text.body),
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

  Future<void> _openMemoryFacts() async {
    ProductAnalytics.instance.track(AnalyticsEvents.memoryOpened);
    final items = _searchProfile?.items ?? const <MemoryItem>[];
    await MemoryFactsSheet.show(
      context,
      items: items,
      onChanged: (next) {
        final updated = _searchProfile?.copyWith(items: next);
        if (updated == null) return;
        setState(() => _searchProfile = updated);
        _repo.updateSearchProfile(updated);
      },
    );
  }

  Future<void> _openRecentSearches() async {
    final account = _accountWatch.capture();
    final searches = List<SavedSearch>.from(
      _searchProfile?.searches ?? const [],
    );
    final ran = await RecentSearchesSheet.show(
      context,
      searches: searches,
      onRun: (search) {
        _repo.markSavedSearchRun(search.id);
      },
      onDelete: (search) {
        _repo.deleteSavedSearch(search.id);
      },
      onRestore: (search, index) {
        _repo.restoreSavedSearch(search, index);
      },
      onClearAll: _repo.clearSavedSearches,
    );
    if (!mounted || !_sessionStill(account)) return;
    if (ran) {
      Navigator.pop(context);
      return;
    }
    final profile = await _repo.getSearchProfile();
    if (!mounted || !_sessionStill(account)) return;
    setState(() => _searchProfile = profile);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child:
          _isLoading ||
              _user == null ||
              _creditBalance == null ||
              _searchProfile == null
          ? _accountError == null
                ? const Center(child: CircularProgressIndicator())
                : Center(child: Text(_accountError!))
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle
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

                // Close button
                Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.only(
                      right: DrevvySpace.s3,
                      top: DrevvySpace.s2,
                    ),
                    child: IconButton(
                      icon: Icon(LucideIcons.x, color: colors.muted),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                ),

                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.gutter,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Account header
                        _buildAccountHeader(colors, text),
                        const SizedBox(height: DrevvySpace.s4),

                        CarBalanceCard(
                          balance: _creditBalance!,
                          notice: _repo.creditNotice,
                          showCount: !_repo.isLive || _repo.balanceKnown,
                          onBuy: _showPackPicker,
                        ),
                        const SizedBox(height: DrevvySpace.s6),

                        // Your search profile
                        _buildSectionLabel(text, colors, 'YOUR SEARCH PROFILE'),
                        const SizedBox(height: DrevvySpace.s2),
                        _buildSearchProfile(colors, text),
                        const SizedBox(height: DrevvySpace.s6),

                        // Settings
                        _buildSectionLabel(text, colors, 'SETTINGS'),
                        const SizedBox(height: DrevvySpace.s2),
                        _buildSettings(colors, text),
                        const SizedBox(height: DrevvySpace.s6),

                        // Legal
                        _buildSectionLabel(text, colors, 'LEGAL'),
                        const SizedBox(height: DrevvySpace.s2),
                        _buildLegal(colors, text),
                        const SizedBox(height: DrevvySpace.s6),

                        // Sign out / Delete
                        _buildDangerActions(colors, text),

                        SizedBox(height: DrevvySpace.s4 + bottomPadding),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildAccountHeader(DrevvyColors colors, DrevvyText text) {
    final user = _user!;

    return Row(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: DrevvyBrand.gradient,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: user.nameIsKnown && user.firstName.isNotEmpty
                ? Text(
                    user.firstName[0].toUpperCase(),
                    style: text.headline.copyWith(color: DrevvyColors.onBrand),
                  )
                : const Icon(LucideIcons.user, color: DrevvyColors.onBrand),
          ),
        ),
        const SizedBox(width: DrevvySpace.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(user.accountLabel, style: text.title),
              Text(
                ShopperSessionStore.instance.accessToken == null
                    ? 'Not signed in'
                    : 'Signed in',
                style: text.callout.copyWith(color: colors.muted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSectionLabel(
    DrevvyText text,
    DrevvyColors colors,
    String label,
  ) {
    return Text(label, style: text.label.copyWith(color: colors.muted));
  }

  Widget _buildSearchProfile(DrevvyColors colors, DrevvyText text) {
    final profile = _searchProfile!;

    return GlassCard(
      child: Column(
        children: [
          // Personalize toggle
          _SettingsRow(
            label: 'Personalize with my history',
            trailing: Switch.adaptive(
              value: profile.personalize,
              onChanged: _togglePersonalize,
              activeTrackColor: colors.violet,
            ),
            subtitle: 'Starters and answers use your past searches',
          ),
          Divider(height: 1, color: colors.line),

          _SettingsRow(
            label: 'Remembered facts',
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Edit', style: text.label.copyWith(color: colors.muted)),
                const SizedBox(width: 4),
                Icon(LucideIcons.chevronRight, size: 16, color: colors.muted),
              ],
            ),
            subtitle: _buildPreferencesSummary(),
            onTap: _openMemoryFacts,
          ),
          Divider(height: 1, color: colors.line),

          _SettingsRow(
            label: 'Recent searches',
            subtitle: profile.searches.isEmpty
                ? 'Run again, delete, or clear all'
                : '${profile.searches.length} saved',
            trailing: Icon(
              LucideIcons.chevronRight,
              size: 16,
              color: colors.muted,
            ),
            onTap: _openRecentSearches,
          ),
        ],
      ),
    );
  }

  String _buildPreferencesSummary() {
    final items = _searchProfile?.items ?? const <MemoryItem>[];
    if (items.isEmpty) return 'Add facts Drevvy should remember';
    return items.map((item) => item.displayValue).join(' · ');
  }

  Widget _buildSettings(DrevvyColors colors, DrevvyText text) {
    return GlassCard(
      child: Column(
        children: [
          _SettingsRow(
            icon: LucideIcons.bell,
            label: 'Notifications',
            subtitle: 'Price drops, offers, official offer',
            trailing: Icon(
              LucideIcons.chevronRight,
              size: 16,
              color: colors.muted,
            ),
            onTap: () {
              ProductAnalytics.instance.track(
                AnalyticsEvents.settingsRowTapped,
                {'row': 'notifications'},
              );
            },
          ),
          Divider(height: 1, color: colors.line),
          _SettingsRow(
            icon: LucideIcons.mapPin,
            label: 'Location',
            subtitle: 'While using · pickup check off',
            trailing: Icon(
              LucideIcons.chevronRight,
              size: 16,
              color: colors.muted,
            ),
            onTap: () {
              ProductAnalytics.instance.track(
                AnalyticsEvents.settingsRowTapped,
                {'row': 'location'},
              );
            },
          ),
          Divider(height: 1, color: colors.line),
          _SettingsRow(
            icon: LucideIcons.chartColumn,
            label: 'Analytics',
            subtitle: ProductAnalytics.instance.configured
                ? 'Product events only. Names, email, phone, and what you type stay out.'
                : 'Saved on this device. Nothing is sent until a PostHog key is configured.',
            trailing: Switch.adaptive(
              value: _analyticsOn,
              onChanged: (value) => _toggleAnalytics(value),
            ),
          ),
          Divider(height: 1, color: colors.line),
          _SettingsRow(
            icon: LucideIcons.rotateCcw,
            label: 'Restore purchases',
            trailing: Icon(
              LucideIcons.chevronRight,
              size: 16,
              color: colors.muted,
            ),
            onTap: () async {
              final account = _accountWatch.capture();
              try {
                final result = await _repo.restorePurchases();
                if (!mounted || !_sessionStill(account)) return;
                _showPurchaseMessage(context, _restoreMessage(result));
              } catch (error) {
                if (!mounted || !_sessionStill(account)) return;
                _showPurchaseMessage(context, _restoreFailureMessage(error));
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildLegal(DrevvyColors colors, DrevvyText text) {
    return GlassCard(
      child: _SettingsRow(
        label: 'Terms · Privacy',
        subtitle: 'Analytics can be turned off in Profile',
        trailing: Icon(LucideIcons.chevronRight, size: 16, color: colors.muted),
        onTap: () => showAnalyticsPrivacy(context),
      ),
    );
  }

  Widget _buildDangerActions(DrevvyColors colors, DrevvyText text) {
    final signedIn = ShopperSessionStore.instance.accessToken != null;
    final canSignIn =
        context.findAncestorWidgetOfExactType<UncontrolledProviderScope>() !=
        null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!signedIn && canSignIn) ...[
          Text(
            'Sign in to message a dealer. Looking around stays free.',
            style: text.body.copyWith(color: colors.ink),
          ),
          const SizedBox(height: DrevvySpace.s3),
          ShopperSignInActions(
            onSuccess: () async {
              final account = _accountWatch.capture();
              await _repo.pullSignedInBalance();
              if (!mounted || !_sessionStill(account)) return;
              await _loadData();
              if (!mounted || !_sessionStill(account)) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('You are signed in.')),
              );
            },
          ),
          const SizedBox(height: DrevvySpace.s4),
        ],
        if (signedIn || !canSignIn)
          GestureDetector(
            onTap: () {
              _handleSignOut();
            },
            child: Text(
              'Sign out',
              style: text.body.copyWith(color: colors.ink),
            ),
          ),
        const SizedBox(height: DrevvySpace.s4),
        GestureDetector(
          onTap: _handleDeleteAccount,
          child: Text(
            'Delete account',
            style: text.body.copyWith(color: colors.danger),
          ),
        ),
      ],
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    this.icon,
    required this.label,
    this.subtitle,
    required this.trailing,
    this.onTap,
  });

  final IconData? icon;
  final String label;
  final String? subtitle;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(DrevvySpace.s4),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20, color: colors.muted),
                const SizedBox(width: DrevvySpace.s3),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: text.body),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: text.callout.copyWith(color: colors.muted),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}
