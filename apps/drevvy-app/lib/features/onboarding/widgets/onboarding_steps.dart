import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../matters_v5.dart';
import '../onboarding_controller.dart';
import 'onboarding_chrome.dart';

class KnowTheMarketStep extends StatelessWidget {
  const KnowTheMarketStep({super.key, required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 14),
        const OnboardingHeadline(
          'Know the market. Talk to the dealer. Stay in control.',
          size: 30,
        ),
        const SizedBox(height: 8),
        const OnboardingLead('Buy your next car with fewer surprises.'),
        const SizedBox(height: 18),
        const _DiscoverLadder(),
        const Spacer(),
        OnboardingCta(label: 'Let’s find your car', onPressed: onContinue),
      ],
    );
  }
}

class _DiscoverLadder extends StatelessWidget {
  const _DiscoverLadder();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: context.drevvy.elev1,
      ),
      child: const Column(
        children: [
          _LadderRow(
            icon: LucideIcons.search,
            title: 'Discover',
            sub: 'Look at real cars near you',
            tag: 'Free',
            brand: false,
          ),
          _LadderConnector(),
          _LadderRow(
            icon: LucideIcons.chartColumn,
            title: 'Know',
            sub: 'See if the price is fair',
            tag: '1 key',
            brand: true,
          ),
          _LadderConnector(),
          _LadderRow(
            icon: LucideIcons.messageSquare,
            title: 'Connect',
            sub: 'Talk to a real salesperson',
            tag: '1 key',
            brand: true,
          ),
        ],
      ),
    );
  }
}

class _LadderConnector extends StatelessWidget {
  const _LadderConnector();

  @override
  Widget build(BuildContext context) {
    return const Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: EdgeInsets.only(left: 22),
        child: SizedBox(
          height: 12,
          child: VerticalDivider(
            width: 2,
            thickness: 2,
            color: Color(0xFFC9CDE0),
          ),
        ),
      ),
    );
  }
}

class _LadderRow extends StatelessWidget {
  const _LadderRow({
    required this.icon,
    required this.title,
    required this.sub,
    required this.tag,
    required this.brand,
  });

  final IconData icon;
  final String title;
  final String sub;
  final String tag;
  final bool brand;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              gradient: brand ? DrevvyColors.brandGradient : null,
              color: brand ? null : const Color(0xFFEEF1F7),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: brand ? Colors.white : colors.ink, size: 21),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.cardTitle.copyWith(fontSize: 17)),
                Text(
                  sub,
                  style: text.callout.copyWith(
                    color: colors.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: colors.lilacTint,
              borderRadius: BorderRadius.circular(DrevvyRadius.pill),
            ),
            child: Text(
              tag,
              style: text.micro.copyWith(
                color: colors.violet,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ChoiceStep<T> extends StatelessWidget {
  const ChoiceStep({
    super.key,
    required this.headline,
    required this.lead,
    required this.choices,
    required this.selected,
    required this.onSelected,
  });

  final String headline;
  final String lead;
  final List<MattersChoice<T>> choices;
  final T? selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        OnboardingHeadline(headline),
        const SizedBox(height: 8),
        OnboardingLead(lead),
        const SizedBox(height: 8),
        Expanded(
          child: ListView.separated(
            padding: EdgeInsets.zero,
            itemCount: choices.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final choice = choices[index];
              return AnswerCard<T>(
                choice: choice,
                selected: selected == choice.id,
                onTap: () => onSelected(choice.id),
              );
            },
          ),
        ),
      ],
    );
  }
}

class ShoppingPrioritiesStep extends StatelessWidget {
  const ShoppingPrioritiesStep({
    super.key,
    required this.draft,
    required this.onContinue,
  });

  final OnboardingDraft draft;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final rows = shoppingPriorities(
      pain: draft.pain,
      outcome: draft.outcome,
      control: draft.control,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const OnboardingHeadline(
          'A better way to shop, based on what matters to you.',
          size: 27,
        ),
        const SizedBox(height: 8),
        const SectionLabel('Your shopping priorities'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) Divider(height: 1, color: colors.canvas),
                SizedBox(
                  height: 56,
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: colors.lilacTint,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          LucideIcons.check,
                          size: 14,
                          color: colors.violet,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          rows[i],
                          style: text.cardTitle.copyWith(fontSize: 16),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        const OnboardingLead(
          'You choose the car. Drevvy helps you get the information and answers you want.',
        ),
        const Spacer(),
        const _LookKnowTalkStrip(),
        const SizedBox(height: 14),
        OnboardingCta(label: 'See how Drevvy helps', onPressed: onContinue),
      ],
    );
  }
}

class _LookKnowTalkStrip extends StatelessWidget {
  const _LookKnowTalkStrip();

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    const items = [
      ('Look', 'Free'),
      ('Know', '1 key'),
      ('Talk', '1 key'),
    ];
    return Row(
      children: [
        for (final item in items)
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.69),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Text(
                    item.$1,
                    style: text.bodyStrong.copyWith(
                      fontSize: 15,
                      color: colors.ink,
                    ),
                  ),
                  Text(
                    item.$2,
                    style: text.callout.copyWith(
                      color: colors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class MarketIntelStep extends StatelessWidget {
  const MarketIntelStep({super.key, required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const OnboardingHeadline('Know more than the asking price.', size: 27),
        const SizedBox(height: 8),
        const OnboardingLead(
          'See where a car’s asking price stands in the market. Marketplace Intelligence · 1 key.',
        ),
        const SizedBox(height: 14),
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              const _SampleIntelCard(),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(LucideIcons.shieldCheck, size: 16, color: colors.muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Unlock once. Keep access to this car.',
                      style: text.body.copyWith(
                        fontSize: 14,
                        color: colors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        OnboardingCta(label: 'Next · Meet the dealer', onPressed: onContinue),
      ],
    );
  }
}

class _SampleIntelCard extends StatelessWidget {
  const _SampleIntelCard();

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: context.drevvy.elev1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '2022 Toyota Camry SE · 31k mi',
                  style: text.bodyStrong.copyWith(fontSize: 14),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: colors.lilacTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  'Sample',
                  style: text.micro.copyWith(
                    color: colors.violet,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Asking price',
                      style: text.label.copyWith(
                        color: colors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      r'$24,900',
                      style: text.figureL.copyWith(
                        fontSize: 38,
                        height: 1.05,
                        letterSpacing: -1,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE3F6EA),
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  '✓ Good price',
                  style: text.bodyStrong.copyWith(
                    color: const Color(0xFF1A8A4A),
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 30),
          const _MarketRangeBar(pin: 0.31, middle: 0.52),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('← Lower', style: text.callout.copyWith(color: colors.muted, fontWeight: FontWeight.w800)),
              Text('Middle', style: text.callout.copyWith(color: colors.muted, fontWeight: FontWeight.w800)),
              Text('Higher →', style: text.callout.copyWith(color: colors.muted, fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: const Color(0xFFE3F6EA),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              r'$1,150 below the middle price for this car near you.',
              style: text.cardTitle.copyWith(
                color: const Color(0xFF14532D),
                fontSize: 16,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MarketRangeBar extends StatelessWidget {
  const _MarketRangeBar({required this.pin, required this.middle});

  final double pin;
  final double middle;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                right: 0,
                top: 22,
                child: Container(
                  height: 14,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(7),
                    gradient: const LinearGradient(
                      colors: [
                        Color(0xFF3CBF72),
                        Color(0xFFF2C94C),
                        Color(0xFFEB6B5B),
                      ],
                      stops: [0, 0.6, 1],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: width * middle,
                top: 18,
                child: Container(
                  width: 2,
                  height: 22,
                  color: const Color(0x80141632),
                ),
              ),
              Positioned(
                left: width * pin - 24,
                top: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF141632),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'This car',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      fontFamily: DrevvyType.fontFamily,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: width * pin - 14,
                top: 15,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xFF141632),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 4),
                    boxShadow: const [
                      BoxShadow(color: Color(0x33000000), blurRadius: 8, offset: Offset(0, 3)),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class RealDealersStep extends StatelessWidget {
  const RealDealersStep({
    super.key,
    required this.draft,
    required this.customController,
    required this.onSelectAsk,
    required this.onCustomChanged,
    required this.onSave,
    required this.onSkip,
  });

  final OnboardingDraft draft;
  final TextEditingController customController;
  final ValueChanged<MattersAsk> onSelectAsk;
  final ValueChanged<String> onCustomChanged;
  final VoidCallback onSave;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final draftText = draftQuestionText(ask: draft.ask, custom: draft.customAsk);
    final canSave = draft.ask != null &&
        (draft.ask != MattersAsk.writeOwn || draft.customAsk.trim().isNotEmpty);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        const OnboardingHeadline(
          'Real dealers. Real answers. Your conversation.',
          size: 26,
        ),
        const SizedBox(height: 8),
        const OnboardingLead(
          'Message a real salesperson through Drevvy—without sharing your personal phone number.',
          size: 15,
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              _DraftChat(draftText: draftText),
              const SizedBox(height: 12),
              const SectionLabel('What would you ask first?'),
              const SizedBox(height: 8),
              for (final choice in mattersAsks) ...[
                AnswerCard<MattersAsk>(
                  choice: choice,
                  selected: draft.ask == choice.id,
                  compact: true,
                  onTap: () => onSelectAsk(choice.id),
                ),
                const SizedBox(height: 8),
              ],
              if (draft.ask == MattersAsk.writeOwn)
                OnboardingField(
                  controller: customController,
                  hint: 'Type your question',
                  onChanged: onCustomChanged,
                ),
              const SizedBox(height: 8),
            ],
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(LucideIcons.messageSquare, size: 16, color: colors.muted),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                mattersV5TalkPrivacyLine,
                style: text.callout.copyWith(color: colors.muted, height: 1.4),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        OnboardingCta(
          label: 'Save my question',
          enabled: canSave,
          onPressed: canSave ? onSave : null,
        ),
        OnboardingTextButton(label: 'Skip for now', onPressed: onSkip),
      ],
    );
  }
}

class _DraftChat extends StatelessWidget {
  const _DraftChat({required this.draftText});

  final String? draftText;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: Color(0xFFEEF1F7),
                  shape: BoxShape.circle,
                ),
                child: Icon(LucideIcons.user, size: 14, color: colors.ink),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Salesperson · Sample dealer',
                  style: text.callout.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              Icon(LucideIcons.shieldCheck, size: 14, color: colors.muted),
              const SizedBox(width: 4),
              Text(
                'Private',
                style: text.callout.copyWith(color: colors.muted),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  gradient: draftText == null ? null : DrevvyColors.brandGradient,
                  color: draftText == null ? const Color(0xFFEEF1F7) : null,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(18),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(4),
                  ),
                ),
                child: Text(
                  draftText == null ? 'Pick a question below…' : 'You: $draftText',
                  style: text.body.copyWith(
                    color: draftText == null
                        ? const Color(0xFF9AA0BD)
                        : Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    height: 1.35,
                  ),
                ),
              ),
            ),
          ),
          if (draftText != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Draft saved · Nothing has been sent',
                textAlign: TextAlign.right,
                style: text.micro.copyWith(
                  color: colors.muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class WhereToLookStep extends StatelessWidget {
  const WhereToLookStep({
    super.key,
    required this.draft,
    required this.zipController,
    required this.onShareLocation,
    required this.onZipChanged,
    required this.onContinue,
  });

  final OnboardingDraft draft;
  final TextEditingController zipController;
  final VoidCallback onShareLocation;
  final ValueChanged<String> onZipChanged;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const OnboardingHeadline('Where should we look?'),
        const SizedBox(height: 8),
        const OnboardingLead('We need this to show cars near you.'),
        const SizedBox(height: 18),
        OnboardingCta(
          label: draft.locationGranted ? '✓ Location shared' : 'Share my location',
          icon: draft.locationGranted ? LucideIcons.check : LucideIcons.mapPin,
          onPressed: onShareLocation,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            children: [
              const Expanded(child: Divider(color: Color(0xFFCFD3E3))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text(
                  'or enter your zip',
                  style: text.callout.copyWith(
                    color: colors.muted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Expanded(child: Divider(color: Color(0xFFCFD3E3))),
            ],
          ),
        ),
        OnboardingField(
          controller: zipController,
          hint: 'Your zip',
          keyboardType: TextInputType.number,
          maxLength: 5,
          onChanged: onZipChanged,
        ),
        const Spacer(),
        OnboardingCta(
          label: 'Continue',
          enabled: draft.hasLocation,
          onPressed: draft.hasLocation ? onContinue : null,
        ),
      ],
    );
  }
}

class CarTypeStep extends StatelessWidget {
  const CarTypeStep({
    super.key,
    required this.draft,
    required this.onSelectType,
    required this.onSelectCondition,
    required this.onSelectTiming,
    required this.onContinue,
  });

  final OnboardingDraft draft;
  final ValueChanged<MattersCarType> onSelectType;
  final ValueChanged<MattersCondition> onSelectCondition;
  final ValueChanged<MattersTiming> onSelectTiming;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const OnboardingHeadline('What kind of car?'),
        const SizedBox(height: 8),
        const OnboardingLead('Quick picks. Change them anytime.'),
        const SizedBox(height: 16),
        const SectionLabel('Type'),
        const SizedBox(height: 8),
        _ChipWrap(
          children: [
            for (final choice in mattersCarTypes)
              FilterChipButton(
                label: choice.label,
                selected: draft.carType == choice.id,
                onTap: () => onSelectType(choice.id),
              ),
          ],
        ),
        const SizedBox(height: 14),
        const SectionLabel('New or used'),
        const SizedBox(height: 8),
        _ChipWrap(
          children: [
            for (final choice in mattersConditions)
              FilterChipButton(
                label: choice.label,
                selected: draft.condition == choice.id,
                onTap: () => onSelectCondition(choice.id),
              ),
          ],
        ),
        const SizedBox(height: 14),
        const SectionLabel('When'),
        const SizedBox(height: 8),
        _ChipWrap(
          children: [
            for (final choice in mattersTimings)
              FilterChipButton(
                label: choice.label,
                selected: draft.timing == choice.id,
                onTap: () => onSelectTiming(choice.id),
              ),
          ],
        ),
        const Spacer(),
        OnboardingCta(label: 'Continue', onPressed: onContinue),
      ],
    );
  }
}

class _ChipWrap extends StatelessWidget {
  const _ChipWrap({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: children,
    );
  }
}

class FreeKeysStep extends StatelessWidget {
  const FreeKeysStep({super.key, required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        const OnboardingHeadline(
          'Your 3 free keys. Your choice.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 14),
        const _KeyTiles(),
        const SizedBox(height: 14),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(DrevvyRadius.pill),
            ),
            child: Text(
              '3 free keys · No credit card',
              style: text.bodyStrong.copyWith(fontSize: 14),
            ),
          ),
        ),
        const SizedBox(height: 14),
        const _UseRow(
          icon: LucideIcons.chartColumn,
          title: 'Know: Marketplace Intelligence',
          sub: 'See if a price is fair · 1 key',
          brand: true,
        ),
        const SizedBox(height: 10),
        const _UseRow(
          icon: LucideIcons.messageSquare,
          title: 'Connect: private talk with a salesperson',
          sub: 'Your phone stays private · 1 key',
          brand: true,
        ),
        const SizedBox(height: 10),
        const _UseRow(
          icon: LucideIcons.tag,
          title: 'Keep one for another car or talk',
          sub: 'Use it when you want',
          brand: false,
        ),
        const Spacer(),
        Text(
          'Looking at cars is always free. Sign in later.',
          textAlign: TextAlign.center,
          style: text.callout.copyWith(color: colors.muted),
        ),
        const SizedBox(height: 10),
        OnboardingCta(label: 'Find my next car', onPressed: onContinue),
      ],
    );
  }
}

class _KeyTiles extends StatelessWidget {
  const _KeyTiles();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < 3; i++)
          Container(
            width: 58,
            height: 58,
            margin: const EdgeInsets.symmetric(horizontal: 5),
            decoration: BoxDecoration(
              gradient: DrevvyColors.brandGradient,
              borderRadius: BorderRadius.circular(18),
              boxShadow: context.drevvy.elevBrand,
            ),
            child: const Icon(LucideIcons.tag, color: Colors.white, size: 26),
          ),
      ],
    );
  }
}

class _UseRow extends StatelessWidget {
  const _UseRow({
    required this.icon,
    required this.title,
    required this.sub,
    required this.brand,
  });

  final IconData icon;
  final String title;
  final String sub;
  final bool brand;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: brand ? DrevvyColors.brandGradient : null,
              color: brand ? null : colors.lilacTint,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: brand ? Colors.white : colors.violet,
              size: 19,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.cardTitle.copyWith(fontSize: 16)),
                Text(
                  sub,
                  style: text.callout.copyWith(
                    color: colors.muted,
                    fontWeight: FontWeight.w600,
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

