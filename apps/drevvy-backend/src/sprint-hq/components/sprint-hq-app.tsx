'use client';

import { useEffect, useReducer, useState } from 'react';
import { approvalBrief, formatClock } from '../display';
import { idlePoses, ROLES } from '../roles';
import { initialUiState, uiReducer, type UiState } from '../state/ui-state';
import { sprintView } from '../state/view-model';
import type { DataMode, LiveBoard, RoleId, Speed, ViewId } from '../types';
import { SprintBoard } from './board';
import { CardDrawer, RoleDrawer } from './drawer';
import { OfficeScene } from './office-scene';
import { ActivityFeed, AgentsPanel, ApprovalsPanel, ReportsPanel, RunsPanel } from './panels';
import { sprintCss } from './sprint-hq-css';

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'board', label: 'Sprint Board' },
  { id: 'office', label: 'Office Sim' },
  { id: 'agents', label: 'Agents' },
  { id: 'runs', label: 'Runs & Builds' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'reports', label: 'Reports' },
];

const MODES: Array<{ id: DataMode; label: string }> = [
  { id: 'snapshot', label: 'Nov 9 Snapshot' },
  { id: 'demo', label: 'Cinema Demo' },
  { id: 'live', label: 'Live' },
];

const SPEEDS: Speed[] = [0.5, 1, 2];

const OWNERS = ['all', 'Pivot Ship', 'Flutter Build', 'QA & Integration', 'Drevvy Security', 'Unassigned'];

export function SprintHqApp({ initialState, live = null }: { initialState?: UiState; live?: LiveBoard | null }) {
  const [state, dispatch] = useReducer(uiReducer, initialState ?? initialUiState);
  const [osReduce, setOsReduce] = useState(false);
  const reduce = state.reduceMotion || osReduce;
  const view = sprintView(state, live);
  const poses = view.projection?.step.poses ?? idlePoses();
  const speech = view.projection?.step.speech ?? null;
  const miniBot = view.projection?.step.miniBot ?? null;
  const simulatedApproval = view.projection?.simulatedApproval ?? false;
  const selected = view.cards.find((card) => card.id === state.selectedCardId) ?? null;
  const ciRunning = state.mode === 'live' && view.cards.some((card) => card.ciInProgress);
  const sprintName =
    state.mode === 'demo'
      ? 'Cinema Demo script'
      : state.mode === 'live'
        ? live?.source ?? 'GitHub sync not fresh'
        : 'No sprint configured';
  const ownerOptions = Array.from(
    new Set(['all', ...view.cards.map((card) => card.ownerRole ?? 'Unassigned'), ...OWNERS.filter((owner) => owner !== 'all')]),
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setOsReduce(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!state.playing || state.mode !== 'demo') return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(250, now - last);
      last = now;
      if (document.visibilityState === 'visible') {
        dispatch({ type: 'tick', dtMs: dt });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.playing, state.mode]);

  useEffect(() => {
    if (!state.selectedCardId && !state.selectedRoleId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'closeOverlays' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selectedCardId, state.selectedRoleId]);

  async function copyBrief(card: NonNullable<typeof selected>) {
    const text = approvalBrief(card);
    try {
      await navigator.clipboard.writeText(text);
      dispatch({ type: 'copied', message: 'Approval brief copied. It does not grant approval.' });
    } catch {
      dispatch({ type: 'copied', message: 'Clipboard is unavailable. The brief fields stay on screen to copy by hand.' });
    }
  }

  const linkedFor = (role: RoleId) => {
    const label = ROLES[role].ownerLabel;
    const card = view.cards.find((item) => item.ownerRole === label && (item.pr || item.headSha));
    if (!card) return null;
    return [card.pr, card.headSha].filter(Boolean).join(' · ');
  };

  return (
    <div
      className={`shq${reduce ? ' shq-reduce' : ''}`}
      data-mode={state.mode}
      data-claims-live="false"
      data-reduce={reduce ? 'true' : 'false'}
      data-testid="sprint-hq"
    >
      <style>{sprintCss}</style>
      <header className="shq-titlebar">
        <div>
          <h1>Drevvy Sprint HQ</h1>
          <p>{sprintName}</p>
        </div>
        <div className="shq-modes" role="radiogroup" aria-label="Data mode">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={state.mode === mode.id}
              className={state.mode === mode.id ? 'is-on' : ''}
              data-testid={`mode-${mode.id}`}
              onClick={() => dispatch({ type: 'setMode', mode: mode.id })}
            >
              {mode.label}
              {mode.id === 'snapshot' ? <span className="shq-default-tag">Fallback</span> : null}
            </button>
          ))}
        </div>
      </header>

      <p className="shq-banner" role="status" data-testid="mode-banner" data-claims-live={view.banner.claimsLive ? 'true' : 'false'} data-banner={view.banner.mode}>
        {view.banner.text}
      </p>
      <p className="shq-default-note">
        {state.mode === 'live' && live?.health === 'fresh'
          ? 'Opened on Live because this GitHub read succeeded. Snapshot and Cinema Demo are unchanged.'
          : state.mode === 'live'
            ? 'Live is selected, but this sync is not fresh. Demo cards are not used.'
            : 'Snapshot is the fallback when GitHub is not fresh. Cinema Demo is a synthetic script.'}
      </p>

      <section className="shq-metrics" aria-label="Sprint metrics">
        {view.metrics.map((metric) => (
          <article key={metric.id} className="shq-metric">
            <h2>{metric.label}</h2>
            <p className="shq-metric-value">{metric.value}</p>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <nav className="shq-nav" aria-label="Sprint HQ">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={state.view === item.id ? 'is-on' : ''}
            aria-current={state.view === item.id ? 'page' : undefined}
            data-testid={`view-${item.id}`}
            onClick={() => dispatch({ type: 'setView', view: item.id })}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {state.view === 'board' || state.view === 'office' ? (
        <div className={state.view === 'office' ? 'shq-stage shq-stage-office' : 'shq-stage'}>
          <OfficeScene
            mode={state.mode}
            poses={poses}
            reduce={reduce}
            officeView={state.officeView}
            activeRole={state.selectedRoleId}
            onSelectRole={(role) => dispatch({ type: 'selectRole', id: role })}
            speech={speech}
            miniBot={miniBot}
            simulatedApproval={simulatedApproval}
            large={state.view === 'office'}
            ciRunning={ciRunning}
          />
          {state.view === 'office' ? (
            <div className="shq-office-tools">
              <div className="shq-seg" role="radiogroup" aria-label="Office view">
                {(['overview', 'follow', 'focus'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={state.officeView === item}
                    className={state.officeView === item ? 'is-on' : ''}
                    onClick={() => dispatch({ type: 'setOfficeView', officeView: item })}
                  >
                    {item === 'overview' ? 'Overview' : item === 'follow' ? 'Follow active worker' : 'Focus selected task'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="shq-main-col">
              <div className="shq-filters">
                <label>
                  <span className="shq-sr">Search cards</span>
                  <input
                    value={state.query}
                    onChange={(event) => dispatch({ type: 'setQuery', query: event.target.value })}
                    placeholder="Search id, outcome, or owner"
                    aria-label="Search cards"
                  />
                </label>
                <label>
                  Owner
                  <select aria-label="Filter by owner" value={state.owner} onChange={(event) => dispatch({ type: 'setOwner', owner: event.target.value })}>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner === 'all' ? 'All owners' : owner}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Hold
                  <select aria-label="Filter by hold" value={state.hold} onChange={(event) => dispatch({ type: 'setHold', hold: event.target.value as UiState['hold'] })}>
                    <option value="all">All cards</option>
                    <option value="holds">Holds only</option>
                    <option value="open">No hold</option>
                  </select>
                </label>
                <label>
                  Kind
                  <select aria-label="Filter by proposal kind" value={state.kind} onChange={(event) => dispatch({ type: 'setKind', kind: event.target.value as UiState['kind'] })}>
                    <option value="all">Proposed and existing</option>
                    <option value="proposed">Proposed</option>
                    <option value="existing">Existing</option>
                  </select>
                </label>
              </div>
              <SprintBoard
                cards={view.filtered}
                mode={state.mode}
                selectedId={state.selectedCardId}
                activeLane={state.activeLane}
                pulsingId={state.pulseStepId ? view.projection?.step.cardId ?? null : null}
                reduce={reduce}
                liveHealth={state.mode === 'live' ? live?.health ?? 'unknown' : null}
                onSelect={(id) => dispatch({ type: 'selectCard', id })}
                onLane={(lane) => dispatch({ type: 'setActiveLane', lane })}
              />
            </div>
          )}
          <ActivityFeed
            items={view.activity}
            mode={state.mode}
            onReplay={(stepId) => dispatch({ type: 'seek', stepId })}
          />
        </div>
      ) : null}

      {state.view === 'agents' ? (
        <AgentsPanel
          mode={state.mode}
          cards={view.cards}
          poses={poses}
          workflowRuns={live?.workflowRuns}
          onSelectRole={(role) => dispatch({ type: 'selectRole', id: role })}
        />
      ) : null}
      {state.view === 'runs' ? <RunsPanel mode={state.mode} cards={view.cards} workflowRuns={live?.workflowRuns} /> : null}
      {state.view === 'approvals' ? (
        <ApprovalsPanel
          cards={view.cards}
          onView={(id) => dispatch({ type: 'selectCard', id })}
          onCopy={(card) => void copyBrief(card)}
        />
      ) : null}
      {state.view === 'reports' ? <ReportsPanel cards={view.cards} mode={state.mode} liveDetail={live?.detail} /> : null}

      <section className="shq-playback" aria-label="Demo playback">
        <div className="shq-playback-row">
          <button type="button" data-testid="play" onClick={() => dispatch({ type: 'play' })} disabled={state.mode !== 'demo' || state.playing}>
            Play
          </button>
          <button type="button" data-testid="pause" onClick={() => dispatch({ type: 'pause' })} disabled={!state.playing}>
            Pause
          </button>
          <button type="button" data-testid="reset" onClick={() => dispatch({ type: 'reset' })}>
            Reset
          </button>
          <div className="shq-seg" role="radiogroup" aria-label="Playback speed">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                role="radio"
                aria-checked={state.speed === speed}
                className={state.speed === speed ? 'is-on' : ''}
                data-testid={`speed-${speed}`}
                onClick={() => dispatch({ type: 'setSpeed', speed })}
              >
                {speed}×
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="reduce-motion"
            aria-pressed={reduce}
            onClick={() => dispatch({ type: 'toggleReduce' })}
          >
            Reduce motion
          </button>
          <p className="shq-clock" data-testid="demo-clock">
            {state.mode === 'demo' ? `Demo clock ${formatClock(view.projection?.elapsedMs ?? 0)}` : 'Playback stays off outside Cinema Demo'}
          </p>
        </div>
        {state.mode === 'demo' ? (
          <div className="shq-events">
            <div className="shq-events-head">
              <h2>Event list</h2>
              {state.watchCardId ? (
                <button type="button" onClick={() => dispatch({ type: 'clearWatch' })}>
                  Clear watch ({state.watchCardId})
                </button>
              ) : (
                <p>Select a card, then Watch selected card, to filter this list.</p>
              )}
            </div>
            <ol>
              {view.script.map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    data-step-id={step.id}
                    aria-current={view.projection?.step.id === step.id ? 'step' : undefined}
                    onClick={() => dispatch({ type: 'seek', stepId: step.id })}
                  >
                    <span>{formatClock(step.atMs)}</span>
                    <span>{step.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="shq-fine">
            {state.mode === 'snapshot'
              ? 'Snapshot cards stay where the Nov 9 proposal placed them. Play does not move them.'
              : 'Live connection unavailable — not configured.'}
          </p>
        )}
      </section>

      {selected ? (
        <CardDrawer
          card={selected}
          copyStatus={state.copyStatus}
          watching={state.watchCardId === selected.id}
          historyAvailable={selected.sourceMode === 'demo'}
          onClose={() => dispatch({ type: 'closeOverlays' })}
          onCopy={(text) => {
            void navigator.clipboard.writeText(text).then(
              () => dispatch({ type: 'copied', message: 'Approval brief copied. It does not grant approval.' }),
              () => dispatch({ type: 'copied', message: 'Clipboard is unavailable. The fields above are the brief.' }),
            );
          }}
          onWatch={() => dispatch({ type: 'watchSelected' })}
        />
      ) : null}
      {state.selectedRoleId ? (
        <RoleDrawer
          role={state.selectedRoleId}
          mode={state.mode}
          cards={view.cards}
          anim={poses[state.selectedRoleId]}
          linked={linkedFor(state.selectedRoleId)}
          onClose={() => dispatch({ type: 'closeOverlays' })}
          onSelectCard={(id) => dispatch({ type: 'selectCard', id })}
        />
      ) : null}
    </div>
  );
}
