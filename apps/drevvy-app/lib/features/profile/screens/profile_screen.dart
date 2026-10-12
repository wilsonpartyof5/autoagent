import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';

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
    setState(() {
      _user = user;
      _searchProfile = searchProfile;
      _isLoading = false;
    });
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
                  
                  _buildSubscriptionBanner(context, colors, text, user),
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
                    title: 'Subscription',
                    items: [
                      _ProfileRow(
                        icon: LucideIcons.creditCard,
                        label: 'Manage subscription',
                        onTap: () {},
                      ),
                      _ProfileRow(
                        icon: LucideIcons.rotateCcw,
                        label: 'Restore purchases',
                        onTap: () {},
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
                  const SizedBox(height: DrevvySpace.rootScrollBottomPadding),
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
    // Placeholder for edit functionality
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Edit ${item.kind.label} - coming soon')),
    );
  }

  void _showRecentSearches(List<SavedSearch> searches) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              child: Text('Recent searches', style: text.title),
            ),
            ...searches.map((search) => ListTile(
              leading: Icon(LucideIcons.search, color: colors.muted),
              title: Text(search.displayTitle, style: text.body),
              subtitle: Text(
                'Run ${search.runCount} ${search.runCount == 1 ? 'time' : 'times'}',
                style: text.callout.copyWith(color: colors.muted),
              ),
              trailing: IconButton(
                icon: Icon(LucideIcons.trash2, color: colors.danger, size: 20),
                onPressed: () {
                  Navigator.pop(context);
                  // Delete search
                },
              ),
              onTap: () {
                Navigator.pop(context);
                // Run search
              },
            )),
            const SizedBox(height: DrevvySpace.s4),
          ],
        ),
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
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSubscriptionBanner(
    BuildContext context,
    DrevvyColors colors,
    DrevvyText text,
    User user,
  ) {
    final isCancelled = user.isCancelled;

    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(DrevvySpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: DrevvySpace.s3,
                    vertical: DrevvySpace.s2,
                  ),
                  decoration: BoxDecoration(
                    gradient: isCancelled ? null : DrevvyBrand.gradient,
                    color: isCancelled ? colors.tile : null,
                    borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  ),
                  child: Text(
                    isCancelled ? 'Pro (cancelled)' : 'Pro',
                    style: text.label.copyWith(
                      color: isCancelled ? colors.muted : DrevvyColors.onBrand,
                    ),
                  ),
                ),
                const SizedBox(width: DrevvySpace.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Drevvy Pro',
                        style: text.bodyStrong.copyWith(color: colors.ink),
                      ),
                      Text(
                        user.usage.formatted,
                        style: text.label.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (isCancelled) ...[
              const SizedBox(height: DrevvySpace.s3),
              Container(
                padding: const EdgeInsets.all(DrevvySpace.s3),
                decoration: BoxDecoration(
                  color: colors.soldTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.info, size: 16, color: colors.sold),
                    const SizedBox(width: DrevvySpace.s2),
                    Expanded(
                      child: Text(
                        'Your subscription ends Oct 20. Finishing deals will continue.',
                        style: text.callout.copyWith(color: colors.sold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
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
          onTap: () {},
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
