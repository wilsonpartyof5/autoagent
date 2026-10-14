import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/providers/app_services.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/auth/consumer_session.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/memory_edit_sheet.dart';

/// Screen 41, 55 (v1.6.1): Profile with search profile and notification switches
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _repo = DemoRepository.instance;
  User? _user;
  SearchProfile? _searchProfile;
  ConsumerSession? _session;
  bool _isLoading = true;
  bool _isFirstRunDemo = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = await _repo.getCurrentUser();
    final searchProfile = await _repo.getSearchProfile();
    ConsumerSession? session;
    try {
      session = await ref.read(authControllerProvider).currentSession();
    } catch (_) {
      session = null;
    }
    if (!mounted) return;
    setState(() {
      _user = user;
      _searchProfile = searchProfile;
      _session = session;
      _isLoading = false;
    });
  }

  Future<void> _signOut() async {
    final hadSession = _session != null;
    try {
      await ref.read(authControllerProvider).signOut();
    } catch (_) {
      // A storage failure still leaves the shopper in demo mode.
    }
    if (!mounted) return;
    setState(() => _session = null);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(hadSession ? 'Signed out. Demo mode is on.' : 'Demo mode is on.'),
      ),
    );
  }

  void _updateNotificationPref(NotificationPrefs Function(NotificationPrefs) updater) {
    if (_user == null) return;
    setState(() {
      _user = _user!.copyWith(
        notificationPrefs: updater(_user!.notificationPrefs),
      );
    });
  }

  void _togglePersonalize(bool value) {
    if (_searchProfile == null) return;
    setState(() {
      _searchProfile = _searchProfile!.copyWith(personalize: value);
    });
    _repo.updateSearchProfile(_searchProfile!);
  }

  void _deleteMemoryItem(String itemId) {
    if (_searchProfile == null) return;
    
    final deletedItem = _searchProfile!.items.firstWhere((i) => i.id == itemId);
    setState(() {
      _searchProfile = _searchProfile!.copyWith(
        items: _searchProfile!.items.where((i) => i.id != itemId).toList(),
      );
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${deletedItem.kind.label} removed'),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () {
            setState(() {
              _searchProfile = _searchProfile!.copyWith(
                items: [..._searchProfile!.items, deletedItem],
              );
            });
          },
        ),
        duration: const Duration(seconds: 5),
      ),
    );
  }

  void _showClearHistoryConfirm() {
    final colors = context.drevvy;
    final text = context.drevvyText;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Clear history?', style: text.title),
        content: Text(
          'Clear your chat history and search profile? Deals and offers are not affected.',
          style: text.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: text.body.copyWith(color: colors.muted)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _repo.clearHistory();
              setState(() {
                _searchProfile = _searchProfile!.copyWith(
                  items: _searchProfile!.items.where((i) => i.source == MemorySource.explicit).toList(),
                  searches: [],
                  viewed: [],
                );
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('History cleared')),
              );
            },
            child: Text('Clear', style: text.body.copyWith(color: colors.danger)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    if (_isLoading || _user == null) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final user = _user!;
    final notifPrefs = user.notificationPrefs;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const SizedBox(height: DrevvySpace.s4),
                  _buildHeader(context, colors, text, user),
                  const SizedBox(height: DrevvySpace.s6),
                  
                  // v1.6.1: Your search profile section (first section per spec)
                  if (_searchProfile != null)
                    _buildSearchProfileSection(context, colors, text, _searchProfile!),
                  if (_searchProfile != null)
                    const SizedBox(height: DrevvySpace.s6),
                  
                  _buildCreditBalanceBanner(context, colors, text),
                  const SizedBox(height: DrevvySpace.s6),

                  // v1.6: Notification category switches
                  _buildNotificationSection(context, colors, text, notifPrefs),
                  const SizedBox(height: DrevvySpace.s6),

                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Settings',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.palette,
                        label: 'Appearance',
                        trailing: _ProfileTrailingText(text: 'System'),
                        onTap: () {},
                      ),
                      _ProfileRow(
                        icon: LucideIcons.shield,
                        label: 'Privacy',
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Car packs',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.shoppingBag,
                        label: 'Buy more cars',
                        onTap: () {
                          // TODO: Show pack picker
                        },
                      ),
                      _ProfileRow(
                        icon: LucideIcons.rotateCcw,
                        label: 'Restore purchases',
                        onTap: () {
                          // TODO: Restore purchases
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Account',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.user,
                        label: 'Edit profile',
                        onTap: () {},
                      ),
                      _ProfileRow(
                        icon: LucideIcons.mail,
                        label: 'Contact support',
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildSection(
                    context,
                    colors,
                    text,
                    title: 'Legal',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.fileText,
                        label: 'Terms of Service',
                        onTap: () {},
                      ),
                      _ProfileRow(
                        icon: LucideIcons.lock,
                        label: 'Privacy Policy',
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: DrevvySpace.s6),
                  _buildDangerSection(context, colors, text),
                  const SizedBox(height: DrevvySpace.s6),
                  
                  // Demo toggle section
                  _buildDemoSection(context, colors, text),
                  // Bottom padding per spec §6.5a
                  SizedBox(height: DrevvySpace.contentBottomInset + MediaQuery.of(context).padding.bottom),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// v1.6.1: Your search profile section per spec §6.14 (screen 55)
  Widget _buildSearchProfileSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
    SearchProfile profile,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: DrevvySpace.s1,
            bottom: DrevvySpace.s3,
          ),
          child: Text(
            'Your search profile',
            style: text.label.copyWith(color: colors.muted),
          ),
        ),
        GlassCard(
          child: Column(
            children: [
              // Personalize toggle
              _SearchProfileSwitch(
                label: 'Personalize with my history',
                description: 'Starter cards and answers use your past searches',
                value: profile.personalize,
                onChanged: _togglePersonalize,
              ),
              
              if (profile.items.isNotEmpty) ...[
                Divider(height: 1, color: colors.line),
                
                // Memory items
                ...profile.items.map((item) => _MemoryItemRow(
                  item: item,
                  onEdit: () => _editMemoryItem(item),
                  onDelete: () => _deleteMemoryItem(item.id),
                )),
              ],
              
              if (profile.searches.isNotEmpty) ...[
                Divider(height: 1, color: colors.line),
                
                // Recent searches link
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _showRecentSearches(profile.searches),
                    child: Padding(
                      padding: const EdgeInsets.all(DrevvySpace.s4),
                      child: Row(
                        children: [
                          Icon(LucideIcons.search, size: 24, color: colors.muted),
                          const SizedBox(width: DrevvySpace.s3),
                          Expanded(
                            child: Text(
                              'Recent searches',
                              style: text.body.copyWith(color: colors.ink),
                            ),
                          ),
                          Text(
                            '${profile.searches.length}',
                            style: text.label.copyWith(color: colors.muted),
                          ),
                          const SizedBox(width: DrevvySpace.s2),
                          Icon(LucideIcons.chevronRight, size: 20, color: colors.muted),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        
        const SizedBox(height: DrevvySpace.s4),
        
        // Clear history button
        GlassCard(
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _showClearHistoryConfirm,
              borderRadius: BorderRadius.circular(DrevvyRadius.md),
              child: Padding(
                padding: const EdgeInsets.all(DrevvySpace.s4),
                child: Row(
                  children: [
                    Icon(LucideIcons.trash2, size: 24, color: colors.danger),
                    const SizedBox(width: DrevvySpace.s3),
                    Text(
                      'Clear history',
                      style: text.body.copyWith(color: colors.danger),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _editMemoryItem(MemoryItem item) {
    MemoryEditSheet.show(
      context,
      item: item,
      onSave: (updatedItem) {
        setState(() {
          _searchProfile = _searchProfile?.copyWith(
            items: _searchProfile!.items.map((i) {
              return i.id == updatedItem.id ? updatedItem : i;
            }).toList(),
          );
        });
        _repo.updateSearchProfile(_searchProfile!);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${updatedItem.kind.label} updated')),
        );
      },
    );
  }

  void _showRecentSearches(List<SavedSearch> searches) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _RecentSearchesSheet(
        searches: searches,
        onRun: (search) {
          Navigator.pop(sheetContext);
          _runSearch(search);
        },
        onDelete: (search) {
          _deleteSearch(search);
        },
      ),
    );
  }

  void _runSearch(SavedSearch search) {
    final updatedSearch = SavedSearch(
      id: search.id,
      filters: search.filters,
      lastRunAt: DateTime.now(),
      runCount: search.runCount + 1,
      seenListingIds: search.seenListingIds,
    );
    
    setState(() {
      _searchProfile = _searchProfile?.copyWith(
        searches: _searchProfile!.searches.map((s) {
          return s.id == search.id ? updatedSearch : s;
        }).toList(),
      );
    });
    _repo.updateSearchProfile(_searchProfile!);
    
    context.go('/shop');
  }

  void _deleteSearch(SavedSearch search) {
    final deletedSearch = search;
    final deletedIndex = _searchProfile?.searches.indexWhere((s) => s.id == search.id) ?? -1;
    
    setState(() {
      _searchProfile = _searchProfile?.copyWith(
        searches: _searchProfile!.searches.where((s) => s.id != search.id).toList(),
      );
    });
    _repo.updateSearchProfile(_searchProfile!);
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Search "${deletedSearch.displayTitle}" deleted'),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () {
            setState(() {
              final searches = List<SavedSearch>.from(_searchProfile?.searches ?? []);
              if (deletedIndex >= 0 && deletedIndex <= searches.length) {
                searches.insert(deletedIndex, deletedSearch);
              } else {
                searches.add(deletedSearch);
              }
              _searchProfile = _searchProfile?.copyWith(searches: searches);
            });
            _repo.updateSearchProfile(_searchProfile!);
          },
        ),
        duration: const Duration(seconds: 5),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, DrevvyColors colors, DrevvyText text, User user) {
    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: DrevvyBrand.gradient,
            borderRadius: BorderRadius.circular(32),
          ),
          child: Center(
            child: Text(
              user.firstName.isNotEmpty ? user.firstName[0].toUpperCase() : 'U',
              style: text.headline.copyWith(color: DrevvyColors.onBrand),
            ),
          ),
        ),
        const SizedBox(width: DrevvySpace.s4),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                user.firstName,
                style: text.headline.copyWith(color: colors.ink),
              ),
              const SizedBox(height: DrevvySpace.s1),
              Text(
                user.email,
                style: text.body.copyWith(color: colors.muted),
              ),
              Text(
                _session == null ? 'Demo mode' : 'Signed in',
                style: text.callout.copyWith(color: colors.violet),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// v1.7: Credit balance banner replaces subscription banner.
  Widget _buildCreditBalanceBanner(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    return FutureBuilder<CarCreditBalance>(
      future: _repo.getCreditBalance(),
      builder: (context, snapshot) {
        final balance = snapshot.data ?? const CarCreditBalance.empty();
        
        return GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(DrevvySpace.s4),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: DrevvyBrand.gradient,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${balance.balance}',
                      style: text.figureS.copyWith(color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(width: DrevvySpace.s4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        balance.displayText,
                        style: text.bodyStrong.copyWith(color: colors.ink),
                      ),
                      Text(
                        'Car packs never expire',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// v1.6: Notification category switches section
  Widget _buildNotificationSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
    NotificationPrefs prefs,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: DrevvySpace.s1,
            bottom: DrevvySpace.s3,
          ),
          child: Text(
            'Notifications',
            style: text.label.copyWith(color: colors.muted),
          ),
        ),
        GlassCard(
          child: Column(
            children: [
              _NotificationSwitch(
                icon: LucideIcons.dollarSign,
                label: 'New offers',
                description: 'When a dealer sends an offer',
                value: prefs.newOffers,
                onChanged: (v) => _updateNotificationPref((p) => p.copyWith(newOffers: v)),
              ),
              Divider(height: 1, color: colors.line, indent: 56),
              _NotificationSwitch(
                icon: LucideIcons.trendingDown,
                label: 'Price drops',
                description: 'When an offer price decreases',
                value: prefs.priceDrops,
                onChanged: (v) => _updateNotificationPref((p) => p.copyWith(priceDrops: v)),
              ),
              Divider(height: 1, color: colors.line, indent: 56),
              _NotificationSwitch(
                icon: LucideIcons.minusCircle,
                label: 'Add-ons removed',
                description: 'When dealer removes an add-on',
                value: prefs.addOnsRemoved,
                onChanged: (v) => _updateNotificationPref((p) => p.copyWith(addOnsRemoved: v)),
              ),
              Divider(height: 1, color: colors.line, indent: 56),
              _NotificationSwitch(
                icon: LucideIcons.messageSquare,
                label: 'Dealer responses',
                description: 'When a dealer replies to Drevvy',
                value: prefs.dealerResponses,
                onChanged: (v) => _updateNotificationPref((p) => p.copyWith(dealerResponses: v)),
              ),
              Divider(height: 1, color: colors.line, indent: 56),
              _NotificationSwitch(
                icon: LucideIcons.clock,
                label: 'Reminders',
                description: 'Nudges to review pending offers',
                value: prefs.reminders,
                onChanged: (v) => _updateNotificationPref((p) => p.copyWith(reminders: v)),
              ),
            ],
          ),
        ),

        const SizedBox(height: DrevvySpace.s4),

        // Hide prices toggle
        GlassCard(
          child: _NotificationSwitch(
            icon: LucideIcons.eyeOff,
            label: 'Hide prices on lock screen',
            description: 'Show car names only in notifications',
            value: prefs.hidePricesOnLockScreen,
            onChanged: (v) => _updateNotificationPref((p) => p.copyWith(hidePricesOnLockScreen: v)),
          ),
        ),
      ],
    );
  }

  Widget _buildSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text, {
    required String title,
    required List<_ProfileRow> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: DrevvySpace.s1,
            bottom: DrevvySpace.s3,
          ),
          child: Text(
            title,
            style: text.label.copyWith(color: colors.muted),
          ),
        ),
        GlassCard(
          child: Column(
            children: [
              for (int i = 0; i < items.length; i++) ...[
                items[i].build(context, colors, text),
                if (i < items.length - 1)
                  Divider(
                    height: 1,
                    color: colors.line,
                    indent: DrevvySpace.s4 + 24 + DrevvySpace.s3,
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// Demo settings section with first-run toggle
  Widget _buildDemoSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: DrevvySpace.s1,
            bottom: DrevvySpace.s3,
          ),
          child: Text(
            'Demo Settings',
            style: text.label.copyWith(color: colors.muted),
          ),
        ),
        GlassCard(
          child: _NotificationSwitch(
            icon: LucideIcons.userPlus,
            label: 'First-run mode',
            description: 'Show generic starters instead of personalized',
            value: _isFirstRunDemo,
            onChanged: (value) {
              setState(() {
                _isFirstRunDemo = value;
                if (value) {
                  // Disable personalization to simulate first-run
                  _searchProfile = _searchProfile?.copyWith(personalize: false);
                } else {
                  // Re-enable personalization
                  _searchProfile = _searchProfile?.copyWith(personalize: true);
                }
              });
              _repo.updateSearchProfile(_searchProfile!);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDangerSection(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
  ) {
    return GlassCard(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _signOut,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          child: Padding(
            padding: const EdgeInsets.all(DrevvySpace.s4),
            child: Row(
              children: [
                Icon(
                  LucideIcons.logOut,
                  size: 24,
                  color: colors.danger,
                ),
                const SizedBox(width: DrevvySpace.s3),
                Text(
                  'Sign out',
                  style: text.body.copyWith(color: colors.danger),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationSwitch extends StatelessWidget {
  const _NotificationSwitch({
    required this.icon,
    required this.label,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String label;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Row(
        children: [
          Icon(icon, size: 24, color: colors.muted),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: text.body.copyWith(color: colors.ink)),
                Text(description, style: text.callout.copyWith(color: colors.muted)),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: colors.violet,
          ),
        ],
      ),
    );
  }
}

class _ProfileRow {
  const _ProfileRow({
    required this.icon,
    required this.label,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Widget? trailing;
  final VoidCallback? onTap;

  Widget build(BuildContext context, DrevvyColors colors, DrevvyText text) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(DrevvySpace.s4),
          child: Row(
            children: [
              Icon(
                icon,
                size: 24,
                color: colors.muted,
              ),
              const SizedBox(width: DrevvySpace.s3),
              Expanded(
                child: Text(
                  label,
                  style: text.body.copyWith(color: colors.ink),
                ),
              ),
              ?trailing,
              const SizedBox(width: DrevvySpace.s2),
              Icon(
                LucideIcons.chevronRight,
                size: 20,
                color: colors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileTrailingText extends StatelessWidget {
  const _ProfileTrailingText({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Text(
      text,
      style: textStyle.label.copyWith(color: colors.muted),
    );
  }
}

/// v1.6.1: Search profile personalize switch
class _SearchProfileSwitch extends StatelessWidget {
  const _SearchProfileSwitch({
    required this.label,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Row(
        children: [
          Icon(LucideIcons.sparkles, size: 24, color: colors.violet),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: text.body.copyWith(color: colors.ink)),
                Text(description, style: text.callout.copyWith(color: colors.muted)),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: colors.violet,
          ),
        ],
      ),
    );
  }
}

/// v1.6.1: Memory item row with edit/delete actions
class _MemoryItemRow extends StatelessWidget {
  const _MemoryItemRow({
    required this.item,
    required this.onEdit,
    required this.onDelete,
  });

  final MemoryItem item;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: DrevvySpace.s4,
        vertical: DrevvySpace.s3,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.kind.label, style: text.bodyStrong.copyWith(color: colors.ink)),
                Text(
                  item.displayValue,
                  style: text.callout.copyWith(color: colors.muted),
                ),
                if (item.isInferred)
                  Text(
                    'Learned from your searches',
                    style: text.micro.copyWith(color: colors.muted),
                  ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(LucideIcons.pencil, size: 18, color: colors.muted),
            onPressed: onEdit,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
          IconButton(
            icon: Icon(LucideIcons.x, size: 18, color: colors.muted),
            onPressed: onDelete,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
        ],
      ),
    );
  }
}

/// Recent searches sheet with Run and Delete actions per spec §6.14
class _RecentSearchesSheet extends StatefulWidget {
  const _RecentSearchesSheet({
    required this.searches,
    required this.onRun,
    required this.onDelete,
  });

  final List<SavedSearch> searches;
  final ValueChanged<SavedSearch> onRun;
  final ValueChanged<SavedSearch> onDelete;

  @override
  State<_RecentSearchesSheet> createState() => _RecentSearchesSheetState();
}

class _RecentSearchesSheetState extends State<_RecentSearchesSheet> {
  late List<SavedSearch> _searches;

  @override
  void initState() {
    super.initState();
    _searches = List.from(widget.searches);
  }

  void _handleDelete(SavedSearch search) {
    setState(() {
      _searches = _searches.where((s) => s.id != search.id).toList();
    });
    widget.onDelete(search);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
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
            // Handle bar
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
                padding: const EdgeInsets.all(DrevvySpace.gutter),
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
                  padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                  itemCount: _searches.length,
                  separatorBuilder: (a, b) => Divider(height: 1, color: colors.line),
                  itemBuilder: (context, index) {
                    final search = _searches[index];
                    return _SearchRow(
                      search: search,
                      onRun: () => widget.onRun(search),
                      onDelete: () => _handleDelete(search),
                    );
                  },
                ),
              ),

            const SizedBox(height: DrevvySpace.s4),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
              child: DrevvyButton(
                label: 'Done',
                variant: DrevvyButtonVariant.secondary,
                onPressed: () => Navigator.pop(context),
              ),
            ),

            const SizedBox(height: DrevvySpace.s4),
          ],
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'Run ${search.runCount} ${search.runCount == 1 ? 'time' : 'times'}',
                  style: text.callout.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
          // Run button
          GestureDetector(
            onTap: onRun,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                gradient: DrevvyColors.brandGradient,
                borderRadius: BorderRadius.circular(DrevvyRadius.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.play, color: Colors.white, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    'Run',
                    style: text.label.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: DrevvySpace.s2),
          // Delete button
          IconButton(
            icon: Icon(LucideIcons.trash2, size: 18, color: colors.danger),
            onPressed: onDelete,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
        ],
      ),
    );
  }
}
