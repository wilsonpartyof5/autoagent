import { SprintHqApp } from '@/sprint-hq/components/sprint-hq-app';
import { loadLiveBoard } from '@/sprint-hq/live/load';
import { initialUiState } from '@/sprint-hq/state/ui-state';

export const metadata = { title: 'Sprint HQ' };
export const dynamic = 'force-dynamic';

/**
 * Opens on Live when this request's GitHub read is fresh.
 * A failed or rate-limited read opens the Nov 9 Snapshot instead.
 * Choosing Live after that shows Stale or Unknown, never demo cards, and never a LIVE badge.
 */
export default async function SprintHqPage() {
  const live = await loadLiveBoard();
  return (
    <SprintHqApp
      initialState={{ ...initialUiState, mode: live.health === 'fresh' ? 'live' : 'snapshot' }}
      live={live}
    />
  );
}
