import { useEffect, useState, type ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';
import { approvalBrief, drawerRows } from '../display';
import { botReadout } from '../roles';
import type { AnimState, DataMode, RoleId, SprintCard } from '../types';

function SheetPortal({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setRoot(document.body);
  }, []);
  if (!root) return children;
  return createPortal(children, root);
}

export function CardDrawer({
  card,
  copyStatus,
  onClose,
  onCopy,
  onWatch,
  watching,
  historyAvailable,
}: {
  card: SprintCard;
  copyStatus: string | null;
  onClose: () => void;
  onCopy: (text: string) => void;
  onWatch: () => void;
  watching: boolean;
  historyAvailable: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, [card.id]);

  const rows = drawerRows(card);
  return (
    <SheetPortal>
    <div className="shq-sheet-wrap">
      <button type="button" className="shq-backdrop" aria-label="Close details" onClick={onClose} />
      <div className="shq-sheet" role="dialog" aria-modal="true" aria-labelledby="shq-card-title" data-testid="card-drawer">
        <header className="shq-sheet-bar">
          <div>
            <p className="shq-kicker">{card.sourceMode === 'demo' ? 'SIMULATION' : 'Snapshot card'}</p>
            <h2 id="shq-card-title">{card.id}</h2>
          </div>
          <button ref={closeRef} type="button" className="shq-icon-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="shq-sheet-outcome">{card.title}</p>
        <div className="shq-sheet-actions">
          <button type="button" onClick={onWatch} aria-pressed={watching} disabled={!historyAvailable}>
            {watching ? 'Watching this card' : 'Watch selected card'}
          </button>
          <button type="button" onClick={() => onCopy(approvalBrief(card))}>
            Copy approval brief
          </button>
        </div>
        {historyAvailable ? null : (
          <p>No event history is stored for this card. Snapshot placements do not replay.</p>
        )}
        {copyStatus ? <p role="status">{copyStatus}</p> : null}
        {card.sourceMode === 'demo' && card.releaseAuthorized ? (
          <p className="shq-sim-approval">Simulated approval — not a production decision</p>
        ) : null}
        <dl className="shq-fields">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
    </SheetPortal>
  );
}

export function RoleDrawer({
  role,
  mode,
  cards,
  anim,
  linked,
  onClose,
  onSelectCard,
}: {
  role: RoleId;
  mode: DataMode;
  cards: readonly SprintCard[];
  anim: AnimState;
  linked: string | null;
  onClose: () => void;
  onSelectCard: (id: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, [role]);
  const readout = botReadout(role, mode, cards, anim, linked);
  const owned = cards.filter((card) => card.ownerRole === readout.role);
  return (
    <SheetPortal>
    <div className="shq-sheet-wrap">
      <button type="button" className="shq-backdrop" aria-label="Close profile" onClick={onClose} />
      <div className="shq-sheet" role="dialog" aria-modal="true" aria-labelledby="shq-role-title" data-testid="role-drawer">
        <header className="shq-sheet-bar">
          <h2 id="shq-role-title">{readout.role}</h2>
          <button ref={closeRef} type="button" className="shq-icon-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <dl className="shq-fields">
          <div>
            <dt>Role</dt>
            <dd>{readout.role}</dd>
          </div>
          <div>
            <dt>Current assignment</dt>
            <dd>{readout.currentAssignment}</dd>
          </div>
          <div>
            <dt>Confirmed status</dt>
            <dd>{readout.confirmedStatus}</dd>
          </div>
          <div>
            <dt>Last evidence</dt>
            <dd>{readout.lastEvidence}</dd>
          </div>
          <div>
            <dt>Linked PR/run</dt>
            <dd>{readout.linkedPrRun}</dd>
          </div>
          <div>
            <dt>Next action</dt>
            <dd>{readout.nextAction}</dd>
          </div>
        </dl>
        {owned.length > 0 ? (
          <ul className="shq-link-list">
            {owned.map((card) => (
              <li key={card.id}>
                <button type="button" onClick={() => onSelectCard(card.id)}>
                  {card.id}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
    </SheetPortal>
  );
}
