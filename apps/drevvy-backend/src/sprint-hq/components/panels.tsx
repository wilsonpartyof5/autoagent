import { LIVE_UNAVAILABLE, PHASE_1_PILOT, STALL_RULE, WIP_RULES } from '../copy/model';
import { LANES, MERGED_NOT_LIVE_NOTE } from '../lanes';
import { ROLES, ROLE_IDS, confirmedStatus } from '../roles';
import type { ActivityItem } from '../state/view-model';
import type { AnimState, DataMode, RoleId, SprintCard } from '../types';

export function ActivityFeed({
  items,
  mode,
  onReplay,
}: {
  items: readonly ActivityItem[];
  mode: DataMode;
  onReplay: (stepId: string) => void;
}) {
  return (
    <aside className="shq-activity" aria-label="Recent activity">
      <h2>Recent activity</h2>
      {mode === 'demo' ? <p className="shq-sim">SIMULATION</p> : null}
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            {item.stepId ? (
              <button type="button" onClick={() => { if (item.stepId) onReplay(item.stepId); }} data-step-id={item.stepId}>
                <span className="shq-activity-title">{item.title}</span>
                <span>{item.detail}</span>
                <span className="shq-fresh">{item.simulation ? 'SIMULATION · ' : ''}{item.timeLabel}</span>
              </button>
            ) : (
              <div>
                <span className="shq-activity-title">{item.title}</span>
                <span>{item.detail}</span>
                <span className="shq-fresh">{item.timeLabel}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function AgentsPanel({
  mode,
  cards,
  poses,
  onSelectRole,
}: {
  mode: DataMode;
  cards: readonly SprintCard[];
  poses: Record<RoleId, AnimState>;
  onSelectRole: (role: RoleId) => void;
}) {
  return (
    <section className="shq-panel" aria-label="Agents">
      <h2>Agents</h2>
      <ul className="shq-rules">
        {WIP_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <h3>Persistent roles</h3>
      <ul className="shq-agent-list">
        {ROLE_IDS.map((role) => (
          <li key={role}>
            <button type="button" onClick={() => onSelectRole(role)}>
              <span className="shq-swatch" style={{ background: ROLES[role].accent }} />
              <span>
                <strong>{ROLES[role].name}</strong>
                <span>{ROLES[role].duty}</span>
                <span>Status: {confirmedStatus(mode, poses[role])}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <h3>Temporary Cursor workers</h3>
      {mode === 'demo' ? (
        <p>Mini-bots appear only while the script says a synthetic run is active. They use DEMO-RUN ids and leave when that beat ends.</p>
      ) : (
        <p>No temporary Cursor workers. No run telemetry connected.</p>
      )}
      <p className="shq-fine">Chat presence is not a running agent. Status words here are Unknown unless the Cinema Demo script is playing.</p>
    </section>
  );
}

export function RunsPanel({ mode, cards }: { mode: DataMode; cards: readonly SprintCard[] }) {
  const demoRuns = mode === 'demo' ? cards.filter((card) => card.ci || card.pr) : [];
  return (
    <section className="shq-panel" aria-label="Runs and builds">
      <h2>Runs & Builds</h2>
      {mode !== 'demo' ? (
        <p className="shq-callout" data-testid="runs-empty">No run telemetry connected</p>
      ) : demoRuns.length === 0 ? (
        <p className="shq-callout">No synthetic run is on the clock yet. Press Play.</p>
      ) : (
        <ul className="shq-run-list">
          {demoRuns.map((card) => (
            <li key={card.id}>
              <span className="shq-sim">SIMULATION</span>
              <strong>{card.id}</strong>
              <span>PR: {card.pr ?? 'Not available'}</span>
              <span>CI: {card.ci ?? 'Not available'}</span>
              <span>Run: {card.executionState ?? 'Not available'}</span>
            </li>
          ))}
        </ul>
      )}
      <p>{STALL_RULE}</p>
    </section>
  );
}

export function ApprovalsPanel({
  cards,
  onView,
  onCopy,
}: {
  cards: readonly SprintCard[];
  onView: (id: string) => void;
  onCopy: (card: SprintCard) => void;
}) {
  const queue = cards.filter((card) => card.needsDw);
  return (
    <section className="shq-panel" aria-label="Approvals">
      <h2>Approvals</h2>
      <p>Phase A can show a brief and the evidence fields. It cannot approve, deploy, merge, or publish.</p>
      {queue.length === 0 ? (
        <p className="shq-callout">No DW decision is named on the cards in this view.</p>
      ) : (
        <ul className="shq-approval-list">
          {queue.map((card) => (
            <li key={card.id}>
              <h3>{card.id}</h3>
              <p>{card.title}</p>
              <p>Pending: {card.blocker ?? card.nextStep ?? 'Not available'}</p>
              <p>Requested of: {card.whoCanClear ?? 'Not available'}</p>
              <div className="shq-sheet-actions">
                <button type="button" onClick={() => onView(card.id)}>
                  View evidence
                </button>
                <button type="button" onClick={() => onCopy(card)}>
                  Copy approval brief
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReportsPanel({ cards, mode }: { cards: readonly SprintCard[]; mode: DataMode }) {
  return (
    <section className="shq-panel" aria-label="Reports">
      <h2>Reports</h2>
      <p className="shq-callout" data-testid="baseline">No committed sprint baseline</p>
      <p>Lane counts below are placements in this view. They are not a completion percent.</p>
      <p>{MERGED_NOT_LIVE_NOTE}</p>
      {mode === 'live' ? <p>{LIVE_UNAVAILABLE}</p> : null}
      <ul className="shq-counts">
        {LANES.map((lane) => (
          <li key={lane.id}>
            <span>{lane.label}</span>
            <strong>{cards.filter((card) => card.lane === lane.id).length}</strong>
          </li>
        ))}
      </ul>
      <h3>{PHASE_1_PILOT.title}</h3>
      <dl className="shq-fields">
        <div>
          <dt>Status</dt>
          <dd>{PHASE_1_PILOT.status}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>{PHASE_1_PILOT.goal}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>{PHASE_1_PILOT.environment}</dd>
        </div>
        <div>
          <dt>Builders</dt>
          <dd>{PHASE_1_PILOT.builders}</dd>
        </div>
        <div>
          <dt>Done means</dt>
          <dd>{PHASE_1_PILOT.doneMeans}</dd>
        </div>
        <div>
          <dt>Out of scope</dt>
          <dd>{PHASE_1_PILOT.outOfScope}</dd>
        </div>
        <div>
          <dt>Before anything is committed</dt>
          <dd>{PHASE_1_PILOT.beforeCommit}</dd>
        </div>
      </dl>
      <h3>Candidate cards, not a commitment</h3>
      <ul>
        {PHASE_1_PILOT.candidates.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>{PHASE_1_PILOT.provesOut}</p>
      <h3>Limits carried from the v2 review</h3>
      <ul>
        {WIP_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}
