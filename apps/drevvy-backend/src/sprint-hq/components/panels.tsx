import { PHASE_1_PILOT, STALL_RULE, WIP_RULES } from '../copy/model';
import { LANES, MERGED_NOT_LIVE_NOTE } from '../lanes';
import { ROLES, ROLE_IDS, confirmedStatus } from '../roles';
import type { ActivityItem } from '../state/view-model';
import type { AnimState, DataMode, LiveWorkflowRun, RoleId, SprintCard } from '../types';

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
  workflowRuns,
  onSelectRole,
}: {
  mode: DataMode;
  cards: readonly SprintCard[];
  poses: Record<RoleId, AnimState>;
  workflowRuns?: readonly LiveWorkflowRun[];
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
        <p>Cursor run telemetry: Not connected</p>
      )}
      {mode === 'live' ? (
        <>
          <h3>GitHub Actions</h3>
          {(workflowRuns ?? []).length === 0 ? (
            <p>No workflow runs in this sync.</p>
          ) : (
            <ul className="shq-run-list">
              {(workflowRuns ?? []).map((run) => (
                <li key={run.id}>
                  <strong>{run.name}</strong>
                  <span>{run.status}{run.conclusion ? ` · ${run.conclusion}` : ''}</span>
                  <span>{run.headSha ?? 'Not available'}</span>
                  <span>{run.htmlUrl ?? 'Not available'}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
      <p className="shq-fine">Chat presence is not a running agent. Status words here are Unknown unless the Cinema Demo script is playing.</p>
    </section>
  );
}

export function RunsPanel({
  mode,
  cards,
  workflowRuns,
}: {
  mode: DataMode;
  cards: readonly SprintCard[];
  workflowRuns?: readonly LiveWorkflowRun[];
}) {
  const demoRuns = mode === 'demo' ? cards.filter((card) => card.ci || card.pr) : [];
  const liveRuns = mode === 'live' ? workflowRuns ?? [] : [];
  return (
    <section className="shq-panel" aria-label="Runs and builds">
      <h2>Runs & Builds</h2>
      {mode === 'live' ? (
        liveRuns.length === 0 ? (
          <p className="shq-callout" data-testid="runs-empty">No GitHub Actions runs in this sync</p>
        ) : (
          <ul className="shq-run-list">
            {liveRuns.map((run) => (
              <li key={run.id}>
                <strong>{run.name}</strong>
                <span>Status: {run.status}</span>
                <span>Conclusion: {run.conclusion ?? 'Not available'}</span>
                <span>Head: {run.headSha ?? 'Not available'}</span>
                <span>{run.htmlUrl ?? 'Not available'}</span>
                <span>{run.updatedAt ?? 'Not available'}</span>
              </li>
            ))}
          </ul>
        )
      ) : mode !== 'demo' ? (
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
      {mode === 'live' ? <p>Cursor run telemetry: Not connected</p> : null}
      <p>{mode === 'live' ? 'GitHub Actions runs are listed when the sync has them. Nothing here auto-cancels a worker. Cursor run telemetry is not connected.' : STALL_RULE}</p>
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

export function ReportsPanel({ cards, mode, liveDetail }: { cards: readonly SprintCard[]; mode: DataMode; liveDetail?: string | null }) {
  return (
    <section className="shq-panel" aria-label="Reports">
      <h2>Reports</h2>
      <p className="shq-callout" data-testid="baseline">No committed sprint baseline</p>
      <p>Lane counts below are placements in this view. They are not a completion percent.</p>
      <p>{MERGED_NOT_LIVE_NOTE}</p>
      {mode === 'live' ? <p>{liveDetail ?? 'Unknown — no successful GitHub sync yet'}</p> : null}
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
