import type { RoleId, VisualPose } from '../types';
import { ROLES } from '../roles';

export function RobotFigure({
  role,
  pose,
  anim,
  reduce,
}: {
  role: RoleId;
  pose: VisualPose;
  anim: string;
  reduce: boolean;
}) {
  const accent = ROLES[role].accent;
  return (
    <svg
      className="shq-bot"
      data-role={role}
      data-pose={pose}
      data-anim={anim}
      data-motion={reduce ? 'off' : 'on'}
      viewBox="0 0 80 108"
      aria-hidden="true"
    >
      <ellipse className="shq-shadow" cx="40" cy="102" rx="16" ry="3.5" fill="rgba(0,0,0,0.35)" />
      <g className="shq-rig">
        <g className="shq-arm shq-arm-l">
          <rect x="8" y="50" width="12" height="26" rx="6" fill="#f4f7fb" stroke="#1b2430" strokeWidth="2" />
        </g>
        <g className="shq-arm shq-arm-r">
          <rect x="60" y="50" width="12" height="26" rx="6" fill="#f4f7fb" stroke="#1b2430" strokeWidth="2" />
          {role === 'flutter' ? (
            <g className="shq-phone">
              <rect x="62" y="62" width="12" height="18" rx="2" fill="#1b2430" />
              <rect x="64" y="64" width="8" height="12" rx="1" fill={accent} />
            </g>
          ) : null}
        </g>
        <rect x="22" y="46" width="36" height="40" rx="12" fill="#f7f9fc" stroke="#1b2430" strokeWidth="2" />
        <rect className="shq-led" x="34" y="58" width="12" height="16" rx="3" fill={accent} />
        {role === 'qa' ? (
          <g className="shq-flask">
            <path d="M30 70 h6 l-4 12 h-2 z" fill={accent} stroke="#1b2430" strokeWidth="1.4" />
            <path d="M31 70 v-6 h4 v6" fill="none" stroke="#1b2430" strokeWidth="1.4" />
          </g>
        ) : null}
        {role === 'security' ? (
          <path className="shq-shield" d="M40 52 l10 4 v8 c0 7-6 12-10 14 c-4-2-10-7-10-14 v-8 z" fill={accent} stroke="#1b2430" strokeWidth="1.6" />
        ) : null}
        {role === 'greg' ? (
          <g className="shq-clip">
            <rect x="48" y="66" width="12" height="16" rx="2" fill="#e7fff3" stroke="#1b2430" strokeWidth="1.4" />
            <path d="M50 70 h8 M50 73 h8 M50 76 h5" stroke="#1b2430" strokeWidth="1" />
          </g>
        ) : null}
        <rect x="20" y="14" width="40" height="30" rx="12" fill="#f4f7fb" stroke="#1b2430" strokeWidth="2" />
        <g className="shq-eyes">
          <circle cx="33" cy="28" r="3.2" fill="#1b2430" />
          <circle cx="47" cy="28" r="3.2" fill="#1b2430" />
          <circle cx="34.2" cy="26.8" r="1" fill="#fff" />
          <circle cx="48.2" cy="26.8" r="1" fill="#fff" />
        </g>
        <rect className="shq-scan" x="24" y="22" width="32" height="3" rx="1.5" fill={accent} />
        {role === 'main_pm' ? (
          <g>
            <path d="M18 18 q22-16 44 0" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
            <circle cx="62" cy="20" r="3" fill={accent} />
            <path d="M62 23 v8" stroke={accent} strokeWidth="2" />
            <circle cx="40" cy="12" r="4" fill={accent} stroke="#1b2430" strokeWidth="1.2" />
          </g>
        ) : null}
        {role === 'greg' ? (
          <g className="shq-glasses" fill="none" stroke="#245c45" strokeWidth="1.6">
            <circle cx="33" cy="28" r="6" />
            <circle cx="47" cy="28" r="6" />
            <path d="M39 28 h2" />
          </g>
        ) : null}
        {role === 'pivot' ? (
          <rect x="24" y="24" width="32" height="8" rx="3" fill={accent} opacity="0.85" />
        ) : null}
        <path className="shq-warn" d="M40 8 l5 8 h-10 z" fill="#f0b429" stroke="#1b2430" strokeWidth="1" />
      </g>
    </svg>
  );
}

export function MiniBot({ label }: { label: string }) {
  return (
    <div className="shq-minibot" data-testid="mini-bot">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <rect x="6" y="8" width="24" height="20" rx="6" fill="#f4f7fb" stroke="#1b2430" strokeWidth="2" />
        <circle cx="14" cy="17" r="2" fill="#1b2430" />
        <circle cx="22" cy="17" r="2" fill="#1b2430" />
        <rect x="12" y="22" width="12" height="3" rx="1.5" fill="#5aa2ff" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
