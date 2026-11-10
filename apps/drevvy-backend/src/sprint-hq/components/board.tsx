import { LANES, MERGED_NOT_LIVE_NOTE } from '../lanes';
import type { Lane, LiveHealth, SprintCard } from '../types';

function evidenceChip(card: SprintCard): string {
  if (card.sourceMode === 'demo') {
    if (card.evidenceState === 'released') return 'Released (simulation)';
    if (card.evidenceState === 'independently_verified') return 'Verified (simulation)';
    if (card.evidenceState === 'prepared') return 'Prepared, not verified';
    return 'Unverified';
  }
  if (card.evidenceState === 'released') return 'Production deployment recorded';
  if (card.evidenceState === 'independently_verified') return 'Independently verified';
  if (card.evidenceState === 'prepared') return 'Prepared, not verified';
  return 'Unverified';
}

export function SprintBoard({
  cards,
  mode,
  selectedId,
  activeLane,
  pulsingId,
  reduce,
  liveHealth,
  onSelect,
  onLane,
}: {
  cards: readonly SprintCard[];
  mode: 'demo' | 'snapshot' | 'live';
  selectedId: string | null;
  activeLane: string | null;
  pulsingId: string | null;
  reduce: boolean;
  liveHealth?: LiveHealth | null;
  onSelect: (id: string) => void;
  onLane: (lane: Lane) => void;
}) {
  return (
    <div className="shq-board-block">
      {mode === 'live' && liveHealth !== 'fresh' ? (
        <p className="shq-live-empty" role="status">
          {liveHealth === 'stale'
            ? 'Showing the last good GitHub sync. This board is Stale, not LIVE.'
            : 'Unknown. No GitHub cards are loaded. Demo and snapshot cards are not substituted.'}
        </p>
      ) : null}
      <div className="shq-lane-switch" role="tablist" aria-label="Jump to lane">
        {LANES.map((lane) => (
          <button
            key={lane.id}
            type="button"
            role="tab"
            aria-selected={activeLane === lane.id}
            className={activeLane === lane.id ? 'is-on' : ''}
            onClick={() => {
              onLane(lane.id);
              const node = document.getElementById(`shq-lane-${lane.id}`);
              node?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
            }}
          >
            {lane.label}
          </button>
        ))}
      </div>
      <div className="shq-board-scroll" data-testid="board-scroll">
        <div className="shq-lanes">
          {LANES.map((lane) => {
            const laneCards = cards.filter((card) => card.lane === lane.id);
            return (
              <section
                key={lane.id}
                id={`shq-lane-${lane.id}`}
                className="shq-lane"
                data-lane={lane.id}
                aria-label={`${lane.label}, ${laneCards.length}`}
              >
                <header className="shq-lane-head">
                  <h3>{lane.label}</h3>
                  <span className="shq-count">{laneCards.length}</span>
                </header>
                <p className="shq-exit">{lane.exit}</p>
                {lane.mergedNote ? <p className="shq-merged-note">{MERGED_NOT_LIVE_NOTE}</p> : null}
                {laneCards.length === 0 ? (
                  <p className="shq-empty">
                    {mode === 'live' && (lane.id === 'backlog' || lane.id === 'ready')
                      ? 'No backlog source connected (master sheet not wired)'
                      : 'Nothing in this lane.'}
                    {mode === 'snapshot' && (lane.id === 'building' || lane.id === 'release_ready' || lane.id === 'live')
                      ? ' The Nov 9 proposal has no cards here.'
                      : ''}
                  </p>
                ) : (
                  <ul className="shq-cards">
                    {laneCards.map((card) => (
                      <li key={card.id}>
                        <button
                          type="button"
                          className={`shq-card${selectedId === card.id ? ' is-selected' : ''}${card.blocked ? ' is-held' : ''}${pulsingId === card.id ? ' is-pulse' : ''}`}
                          data-card-id={card.id}
                          aria-pressed={selectedId === card.id}
                          onClick={() => onSelect(card.id)}
                        >
                          <span className="shq-card-id">{card.id}</span>
                          <span className="shq-card-title">{card.title}</span>
                          <span className="shq-card-meta">{card.ownerRole ?? 'Unassigned'}</span>
                          <span className="shq-chips">
                            <span className="shq-chip">{evidenceChip(card)}</span>
                            {card.proposed ? <span className="shq-chip">Proposed</span> : null}
                            {card.blocked ? <span className="shq-chip shq-chip-hold">Hold</span> : null}
                            {card.ciInProgress ? <span className="shq-chip">Checks running</span> : null}
                            {card.reconciliation ? <span className="shq-chip">Needs reconciliation</span> : null}
                            {card.sourceMode === 'demo' ? <span className="shq-chip shq-chip-sim">SIMULATION</span> : null}
                          </span>
                          <span className="shq-fresh">Evidence time: {card.evidenceTimestamp ?? 'Not available'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
