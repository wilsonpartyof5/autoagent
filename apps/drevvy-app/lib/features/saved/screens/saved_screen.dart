import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/shell_scaffold.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/saved_car_card.dart';
import '../../shop/widgets/account_sheet.dart';

enum SavedSortOption { recentlySaved, price, distance }

/// Saved tab screen per spec §6.15-6.16 (v1.8).
class SavedScreen extends StatefulWidget {
  const SavedScreen({super.key});

  @override
  State<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends State<SavedScreen> {
  final _repo = DemoRepository.instance;
  List<SavedCar> _savedCars = [];
  Map<String, Listing> _listings = {};
  bool _isLoading = true;
  SavedSortOption _sortOption = SavedSortOption.recentlySaved;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final savedCars = await _repo.getSavedCars();
    final listings = <String, Listing>{};
    
    for (final sc in savedCars) {
      try {
        final listing = await _repo.getListingById(sc.listingId);
        listings[sc.listingId] = listing;
      } catch (_) {
        // Listing not found - mark as no longer listed
      }
    }
    if (!mounted) return;

    setState(() {
      _savedCars = savedCars;
      _listings = listings;
      _isLoading = false;
    });
  }

  List<SavedCar> get _sortedCars {
    final cars = List<SavedCar>.from(_savedCars);
    
    // No longer listed always sort to top
    cars.sort((a, b) {
      if (a.isNoLongerListed && !b.isNoLongerListed) return -1;
      if (!a.isNoLongerListed && b.isNoLongerListed) return 1;
      
      switch (_sortOption) {
        case SavedSortOption.recentlySaved:
          return b.savedAt.compareTo(a.savedAt);
        case SavedSortOption.price:
          final priceA = _listings[a.listingId]?.price ?? 0;
          final priceB = _listings[b.listingId]?.price ?? 0;
          return priceA.compareTo(priceB);
        case SavedSortOption.distance:
          final distA = _listings[a.listingId]?.dist ?? 999;
          final distB = _listings[b.listingId]?.dist ?? 999;
          return distA.compareTo(distB);
      }
    });
    
    return cars;
  }

  int get _noLongerListedCount {
    return _savedCars.where((sc) => sc.isNoLongerListed).length;
  }

  String get _subLine {
    final count = _savedCars.length;
    final noLonger = _noLongerListedCount;
    
    if (count == 0) return '';
    
    final parts = <String>['$count ${count == 1 ? 'car' : 'cars'}'];
    if (noLonger > 0) {
      parts.add('$noLonger no longer listed');
    }
    parts.add('swipe left to remove');
    
    return parts.join(' · ');
  }

  void _showAccountSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const AccountSheet(),
    );
  }

  Future<void> _handleRemove(SavedCar savedCar) async {
    final listing = _listings[savedCar.listingId];
    
    setState(() {
      _savedCars = _savedCars.where((sc) => sc.id != savedCar.id).toList();
    });
    
    await _repo.removeSavedCar(savedCar.id);
    
    if (!mounted) return;
    
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Removed from Saved'),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () async {
            if (listing != null) {
              final restored = await _repo.saveCar(listing);
              setState(() {
                _savedCars = [..._savedCars, restored];
              });
            }
          },
        ),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _handleUnlock(SavedCar savedCar) async {
    final listing = _listings[savedCar.listingId];
    if (listing == null) return;
    
    final balance = await _repo.getCreditBalance();
    
    if (!balance.canUnlock) {
      // Show pack picker or out of cars sheet
      if (!mounted) return;
      // TODO: Show appropriate sheet based on purchase history
      return;
    }
    
    // Move to deals
    final deal = await _repo.moveToDeals(savedCar.id);
    if (deal == null) return;
    
    setState(() {
      _savedCars = _savedCars.where((sc) => sc.id != savedCar.id).toList();
    });
    
    final newBalance = await _repo.getCreditBalance();
    
    if (!mounted) return;
    
    HapticFeedback.mediumImpact();
    
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          "${listing.build.model} moved to Deals. Drevvy's on it. ${newBalance.balance} cars left.",
        ),
        action: SnackBarAction(
          label: 'View',
          onPressed: () => context.go('/deals'),
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  void _handleFindSimilar(SavedCar savedCar) {
    // Navigate to shop with similar search
    context.go('/shop');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: _savedCars.isEmpty
            ? _buildEmptyState(context, colors, text)
            : _buildList(context, colors, text),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, DrevvyColors colors, DrevvyText text) {
    return Padding(
      padding: const EdgeInsets.all(DrevvySpace.gutter),
      child: Column(
        children: [
          _buildHeader(context, colors, text),
          
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Heart orb
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: colors.glassSolid,
                      shape: BoxShape.circle,
                      boxShadow: colors.elev1,
                    ),
                    child: Center(
                      child: Icon(
                        LucideIcons.heart,
                        color: colors.danger,
                        size: 32,
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  Text(
                    'No saved cars yet',
                    style: text.headline,
                    textAlign: TextAlign.center,
                  ),
                  
                  const SizedBox(height: DrevvySpace.s3),
                  
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s8),
                    child: Text(
                      "Tap the heart on any car in Shop to keep it here. We'll show it if the listing price changes.",
                      style: text.body.copyWith(color: colors.muted),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  DrevvyButton(
                    label: 'Browse cars',
                    icon: LucideIcons.messageSquare,
                    onPressed: () => context.go('/shop'),
                  ),
                ],
              ),
            ),
          ),
          
          // Bottom padding for tab bar
          SizedBox(height: DrevvySpace.contentBottomInset + MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  Widget _buildList(BuildContext context, DrevvyColors colors, DrevvyText text) {
    final sortedCars = _sortedCars;

    // v1.8: Wrap in NotificationListener for hide-on-scroll
    return NotificationListener<ScrollUpdateNotification>(
      onNotification: (notification) {
        final hideOnScroll = HideOnScroll.of(context);
        if (hideOnScroll != null && notification.scrollDelta != null) {
          hideOnScroll.setFromScroll(notification.scrollDelta!);
        }
        return false;
      },
      child: CustomScrollView(
        slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(DrevvySpace.gutter),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(context, colors, text),
                const SizedBox(height: DrevvySpace.s2),
                Text(
                  _subLine,
                  style: text.callout.copyWith(color: colors.muted),
                ),
                const SizedBox(height: DrevvySpace.s4),
                _buildSortChips(context, colors, text),
              ],
            ),
          ),
        ),
        
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final savedCar = sortedCars[index];
                final listing = _listings[savedCar.listingId];
                
                return Padding(
                  padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
                  child: SavedCarCard(
                    savedCar: savedCar,
                    listing: listing,
                    onRemove: () => _handleRemove(savedCar),
                    onUnlock: () => _handleUnlock(savedCar),
                    onFindSimilar: () => _handleFindSimilar(savedCar),
                    onTap: listing != null
                        ? () => context.push('/vdp/${listing.id}')
                        : null,
                  ),
                );
              },
              childCount: sortedCars.length,
            ),
          ),
        ),
        
        // Bottom padding for tab bar
        SliverPadding(
          padding: EdgeInsets.only(
            bottom: DrevvySpace.contentBottomInset + MediaQuery.of(context).padding.bottom,
          ),
        ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, DrevvyColors colors, DrevvyText text) {
    return Row(
      children: [
        Expanded(
          child: Text('Saved', style: text.display),
        ),
        _AvatarButton(onTap: _showAccountSheet),
      ],
    );
  }

  Widget _buildSortChips(BuildContext context, DrevvyColors colors, DrevvyText text) {
    return Row(
      children: [
        _SortChip(
          label: 'Recently saved',
          isSelected: _sortOption == SavedSortOption.recentlySaved,
          onTap: () => setState(() => _sortOption = SavedSortOption.recentlySaved),
        ),
        const SizedBox(width: DrevvySpace.s2),
        _SortChip(
          label: 'Price',
          isSelected: _sortOption == SavedSortOption.price,
          onTap: () => setState(() => _sortOption = SavedSortOption.price),
        ),
        const SizedBox(width: DrevvySpace.s2),
        _SortChip(
          label: 'Distance',
          isSelected: _sortOption == SavedSortOption.distance,
          onTap: () => setState(() => _sortOption = SavedSortOption.distance),
        ),
      ],
    );
  }
}

class _AvatarButton extends StatelessWidget {
  const _AvatarButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: Semantics(
        label: 'Account',
        button: true,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: DrevvyBrand.gradient,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              'DW',
              style: text.label.copyWith(
                color: DrevvyColors.onBrand,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SortChip extends StatelessWidget {
  const _SortChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? colors.ink : colors.glassSolid,
          borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        ),
        child: Text(
          label,
          style: text.label.copyWith(
            color: isSelected ? Colors.white : colors.ink,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
