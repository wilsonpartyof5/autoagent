import { metricsFor, modeBanner, type Metric, type ModeBanner } from '../display';
import { projectDemo, type DemoProjection } from '../engine/demo-engine';
import { DEMO_SCRIPT, type DemoStep } from '../fixtures/demo-script';
import { SNAPSHOT_CARDS } from '../fixtures/snapshot';
import type { SprintCard } from '../types';
import type { UiState } from './ui-state';

export function cardsForMode(state: Pick<UiState, 'mode' | 'elapsedMs'>): SprintCard[] {
  if (state.mode === 'demo') return projectDemo(state.elapsedMs).cards;
  if (state.mode === 'snapshot') return [...SNAPSHOT_CARDS];
  return [];
}

export function filterCards(
  cards: readonly SprintCard[],
  state: Pick<UiState, 'query' | 'owner' | 'hold' | 'kind'>,
): SprintCard[] {
  const query = state.query.trim().toLowerCase();
  return cards.filter((card) => {
    if (state.owner !== 'all' && (card.ownerRole ?? 'Unassigned') !== state.owner) return false;
    if (state.hold === 'holds' && !card.blocked) return false;
    if (state.hold === 'open' && card.blocked) return false;
    if (state.kind === 'proposed' && !card.proposed) return false;
    if (state.kind === 'existing' && card.proposed) return false;
    if (!query) return true;
    const blob = `${card.id} ${card.title} ${card.ownerRole ?? 'Unassigned'}`.toLowerCase();
    return blob.includes(query);
  });
}

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  simulation: boolean;
  stepId: string | null;
};

export function activityItems(state: Pick<UiState, 'mode' | 'elapsedMs' | 'watchCardId'>): ActivityItem[] {
  if (state.mode === 'live') {
    return [
      {
        id: 'live-unavailable',
        title: 'No activity',
        detail: 'Live connection unavailable — not configured.',
        timeLabel: 'Not available',
        simulation: false,
        stepId: null,
      },
    ];
  }
  if (state.mode === 'snapshot') {
    return [
      {
        id: 'snapshot-empty-log',
        title: 'No event stream in the snapshot',
        detail: 'The Nov 9 proposal is a frozen placement. It does not include a timed activity log, run ids, or a sync clock.',
        timeLabel: 'Not available',
        simulation: false,
        stepId: null,
      },
      ...SNAPSHOT_CARDS.map((card) => ({
        id: `note-${card.id}`,
        title: card.id,
        detail: card.nextStep ?? 'Not available',
        timeLabel: 'Not available',
        simulation: false,
        stepId: null,
      })),
    ];
  }
  const projection = projectDemo(state.elapsedMs);
  return DEMO_SCRIPT.filter((step) => step.atMs <= projection.elapsedMs)
    .filter((step) => (state.watchCardId ? step.cardId === state.watchCardId : true))
    .slice()
    .reverse()
    .map((step) => ({
      id: step.id,
      title: step.title,
      detail: step.detail,
      timeLabel: 'Demo clock',
      simulation: true,
      stepId: step.id,
    }));
}

export function visibleScript(state: Pick<UiState, 'watchCardId'>): readonly DemoStep[] {
  if (!state.watchCardId) return DEMO_SCRIPT;
  const matched = DEMO_SCRIPT.filter((step) => step.cardId === state.watchCardId);
  return matched.length > 0 ? matched : DEMO_SCRIPT;
}

export type SprintView = {
  banner: ModeBanner;
  cards: SprintCard[];
  filtered: SprintCard[];
  metrics: Metric[];
  projection: DemoProjection | null;
  activity: ActivityItem[];
  script: readonly DemoStep[];
};

export function sprintView(state: UiState): SprintView {
  const cards = cardsForMode(state);
  return {
    banner: modeBanner(state.mode),
    cards,
    filtered: filterCards(cards, state),
    metrics: metricsFor(state.mode, cards),
    projection: state.mode === 'demo' ? projectDemo(state.elapsedMs) : null,
    activity: activityItems(state),
    script: state.mode === 'demo' ? visibleScript(state) : [],
  };
}
