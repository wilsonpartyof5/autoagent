import type { AnimState, OfficeView, RoleId } from '../types';
import { ROLES, ROLE_IDS, confirmedStatus, visualPose } from '../roles';
import type { DataMode } from '../types';
import { MiniBot, RobotFigure } from './robots';

export function OfficeScene({
  mode,
  poses,
  reduce,
  officeView,
  activeRole,
  onSelectRole,
  speech,
  miniBot,
  simulatedApproval,
  large,
  ciRunning = false,
}: {
  mode: DataMode;
  poses: Record<RoleId, AnimState>;
  reduce: boolean;
  officeView: OfficeView;
  activeRole: RoleId | null;
  onSelectRole: (role: RoleId) => void;
  speech: { role: RoleId; text: string } | null;
  miniBot: { desk: 'pivot' | 'flutter'; label: string } | null;
  simulatedApproval: boolean;
  large: boolean;
  ciRunning?: boolean;
}) {
  return (
    <section className={`shq-office${large ? ' is-large' : ''}`} data-office-view={officeView} aria-label="Office simulation">
      <svg className="shq-office-bg" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="shqSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#16324d" />
            <stop offset="1" stopColor="#0d1528" />
          </linearGradient>
          <linearGradient id="shqFloor" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1a2744" />
            <stop offset="1" stopColor="#10182c" />
          </linearGradient>
        </defs>
        <rect width="1000" height="320" fill="url(#shqSky)" />
        <g opacity="0.9">
          <rect x="40" y="70" width="70" height="120" fill="#132033" />
          <rect x="130" y="40" width="54" height="150" fill="#18283f" />
          <rect x="200" y="86" width="80" height="104" fill="#122033" />
          <rect x="760" y="58" width="60" height="132" fill="#18283f" />
          <rect x="840" y="78" width="90" height="112" fill="#132033" />
          {Array.from({ length: 18 }).map((_, index) => (
            <rect
              key={index}
              x={48 + (index % 6) * 18 + Math.floor(index / 6) * 250}
              y={88 + (index % 3) * 16}
              width="6"
              height="8"
              fill={index % 4 === 0 ? '#7dffa8' : '#3ee0ff'}
              opacity="0.55"
            />
          ))}
        </g>
        <rect x="0" y="188" width="1000" height="132" fill="url(#shqFloor)" />
        <ellipse cx="500" cy="250" rx="280" ry="46" fill="#121c33" stroke="rgba(62,224,255,0.25)" />
        <path className="shq-path" d="M120 250 H880" fill="none" stroke="rgba(62,224,255,0.45)" strokeWidth="3" strokeDasharray="8 10" />
        <g>
          <rect x="70" y="24" width="210" height="36" rx="10" fill="#07101f" stroke="#3ee0ff" />
          <text x="175" y="48" textAnchor="middle" fill="#9ff6ff" fontSize="18" fontFamily="inherit">
            Drevvy HQ
          </text>
        </g>
        <g transform="translate(40 210)">
          <rect x="0" y="28" width="8" height="36" fill="#2f6b45" />
          <circle cx="4" cy="24" r="16" fill="#3ddc97" />
          <circle cx="16" cy="34" r="12" fill="#1fbf7a" />
        </g>
        <g transform="translate(900 214)">
          <rect x="8" y="24" width="46" height="28" rx="6" fill="#10192e" stroke="#c4a6ff" />
          <circle cx="20" cy="38" r="3" fill="#c4a6ff" />
          <circle cx="34" cy="38" r="3" fill="#3ee0ff" />
        </g>
      </svg>
      <div className="shq-desks">
        {ROLE_IDS.map((role) => {
          const profile = ROLES[role];
          const anim = poses[role];
          const pose = visualPose(anim, mode);
          const selected = activeRole === role;
          return (
            <button
              key={role}
              type="button"
              className={`shq-desk${selected ? ' is-selected' : ''}${officeView === 'follow' && pose !== 'idle' ? ' is-follow' : ''}`}
              data-role={role}
              onClick={() => onSelectRole(role)}
              aria-pressed={selected}
            >
              <RobotFigure role={role} pose={pose} anim={anim} reduce={reduce} />
              {miniBot && miniBot.desk === role ? <MiniBot label={miniBot.label} /> : null}
              <span className="shq-nameplate">{profile.name}</span>
              <span className="shq-desk-status">{confirmedStatus(mode, anim)}</span>
            </button>
          );
        })}
      </div>
      {speech ? (
        <p className="shq-speech" role="status">
          {mode === 'demo' ? <span className="shq-sim">SIMULATION</span> : null}
          <strong>{ROLES[speech.role].name}.</strong> {speech.text}
        </p>
      ) : (
        <p className="shq-speech shq-speech-quiet">
          {mode === 'snapshot'
            ? 'Bots stay idle. No fresh telemetry, so nobody is shown typing.'
            : mode === 'live'
              ? ciRunning
                ? 'GitHub Actions has a check in progress on a card head. The six roles stay idle because GitHub does not assign them.'
                : 'The six roles are idle. No card head has a check run in progress. Cursor telemetry is not connected.'
              : 'Press Play to run the synthetic office script.'}
        </p>
      )}
      {mode === 'live' ? (
        <p
          className={`shq-ci-lamp${ciRunning && !reduce ? ' is-running' : ''}`}
          data-testid="github-actions-runner"
          data-anim={ciRunning ? 'building' : 'idle'}
        >
          GitHub Actions: {ciRunning ? 'check in progress' : 'idle'}
        </p>
      ) : null}
      {simulatedApproval ? <p className="shq-sim-approval">Simulated approval</p> : null}
      {!reduce && mode === 'demo' && Object.values(poses).includes('released') ? (
        <div className="shq-confetti" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
      ) : null}
    </section>
  );
}
