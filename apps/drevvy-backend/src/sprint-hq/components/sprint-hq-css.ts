export const sprintCss = `
.shq {
  --shq-text: var(--tx, #e8eef8);
  --shq-muted: #c5cedf;
  --shq-line: var(--bd, rgba(255, 255, 255, 0.14));
  --shq-panel: linear-gradient(160deg, var(--gl1, rgba(255, 255, 255, 0.08)), var(--gl2, rgba(255, 255, 255, 0.02)));
  color: var(--shq-text);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 15px;
  line-height: 1.45;
}
html[data-drevvy-theme='light'] .shq,
.glass-app[data-theme='light'] .shq {
  --shq-muted: #3d4860;
}
.shq * { box-sizing: border-box; }
.shq h1, .shq h2, .shq h3 { margin: 0; font-weight: 750; letter-spacing: -0.02em; }
.shq h1 { font-size: 1.35rem; }
.shq h2 { font-size: 1rem; }
.shq h3 { font-size: 0.95rem; }
.shq p { margin: 0; }
.shq button, .shq select, .shq input, .shq-sheet button {
  font: inherit;
  color: inherit;
  min-height: 44px;
  min-width: 44px;
  border-radius: 12px;
  border: 1px solid var(--shq-line, rgba(255, 255, 255, 0.16));
  background: var(--soft, rgba(255, 255, 255, 0.06));
}
.shq button, .shq-sheet button { padding: 0 14px; cursor: pointer; }
.shq button:focus-visible, .shq select:focus-visible, .shq input:focus-visible, .shq a:focus-visible, .shq-sheet button:focus-visible {
  outline: 2px solid #3ee0ff;
  outline-offset: 2px;
}
.shq button.is-on, .shq button[aria-checked='true'] {
  background: linear-gradient(135deg, #145e66, #1d4e8f);
  color: #f4feff;
  border-color: transparent;
}
.shq button:disabled, .shq-sheet button:disabled { opacity: 0.45; cursor: not-allowed; }
.shq-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
.shq-titlebar, .shq-playback-row, .shq-modes, .shq-nav, .shq-filters, .shq-seg, .shq-sheet-actions, .shq-events-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.shq-titlebar, .shq-metric, .shq-panel, .shq-playback, .shq-activity, .shq-office, .shq-lane, .shq-sheet {
  background: var(--shq-panel);
  border: 1px solid var(--shq-line);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 var(--rim, rgba(255, 255, 255, 0.16));
}
.shq-titlebar, .shq-playback, .shq-panel { padding: 12px; }
.shq-titlebar { justify-content: space-between; }
.shq-titlebar p, .shq-fine, .shq-exit, .shq-fresh, .shq-default-note, .shq-metric p, .shq-desk-status {
  color: var(--shq-muted);
  font-size: 0.92rem;
}
.shq-default-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(62, 224, 255, 0.18);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.shq-banner {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: repeating-linear-gradient(-45deg, rgba(240, 180, 41, 0.2), rgba(240, 180, 41, 0.2) 10px, rgba(240, 180, 41, 0.05) 10px, rgba(240, 180, 41, 0.05) 20px);
  border: 1px solid rgba(240, 180, 41, 0.7);
}
.shq[data-mode='snapshot'] .shq-banner {
  text-transform: none;
  letter-spacing: 0;
  background: rgba(62, 224, 255, 0.12);
  border-color: rgba(62, 224, 255, 0.55);
}
.shq[data-mode='live'] .shq-banner {
  text-transform: none;
  letter-spacing: 0;
  background: rgba(255, 255, 255, 0.04);
  border-style: dashed;
  border-color: var(--shq-muted);
}
.shq-metrics {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 2px;
}
.shq-metric { padding: 12px; min-width: 0; flex: 0 0 168px; }
.shq-metric h2 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--shq-muted); font-weight: 700; }
.shq-metric-value { font-size: 1.45rem; font-weight: 780; margin: 4px 0; }
.shq-nav, .shq-modes { max-width: 100%; }
.shq-nav { flex-wrap: nowrap; overflow-x: auto; }
.shq-nav button, .shq-modes button, .shq-seg button { flex: 0 0 auto; }
.shq-stage { display: flex; flex-direction: column; gap: 12px; min-width: 0; max-width: 100%; }
.shq-main-col, .shq-board-block, .shq-board-scroll { min-width: 0; max-width: 100%; }
.shq-filters { margin-bottom: 10px; }
.shq-filters label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: var(--shq-muted); flex: 1 1 140px; }
.shq-filters input, .shq-filters select { padding: 0 10px; width: 100%; }
.shq-lane-switch {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 8px;
}
.shq-lane-switch button { flex: 0 0 auto; }
.shq-board-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}
.shq-lanes { display: flex; gap: 10px; width: max-content; max-width: none; }
.shq-lane {
  flex: 0 0 min(78vw, 260px);
  width: min(78vw, 260px);
  padding: 10px;
  border-top: 4px solid var(--lane, #8b93a7);
  min-height: 180px;
}
.shq-lane[data-lane='backlog'] { --lane: #8b93a7; }
.shq-lane[data-lane='ready'] { --lane: #3ee0ff; }
.shq-lane[data-lane='building'] { --lane: #f0b429; }
.shq-lane[data-lane='review'] { --lane: #b388ff; }
.shq-lane[data-lane='validation'] { --lane: #3ddc97; }
.shq-lane[data-lane='release_ready'] { --lane: #2ee6c7; }
.shq-lane[data-lane='live'] { --lane: #1fbf7a; }
.shq-lane-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.shq-count {
  min-width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lane) 28%, transparent);
  font-weight: 750;
}
.shq-exit, .shq-merged-note, .shq-empty { margin-top: 6px; }
.shq-merged-note {
  padding: 8px;
  border-radius: 10px;
  background: rgba(46, 230, 199, 0.1);
  border: 1px dashed rgba(46, 230, 199, 0.5);
  font-size: 0.85rem;
}
.shq-cards { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.shq-card {
  width: 100%;
  min-height: 44px;
  height: auto;
  text-align: left;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  white-space: normal;
}
.shq-card.is-selected { border-color: #3ee0ff; }
.shq-card.is-held { box-shadow: inset 3px 0 0 #f0b429; }
.shq-card.is-pulse { box-shadow: 0 0 0 2px #3ee0ff; }
.shq-card-id { font-weight: 800; }
.shq-card-title { font-weight: 650; }
.shq-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.shq-chip {
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.75rem;
}
.shq-chip-hold { background: rgba(240, 180, 41, 0.2); }
.shq-chip-sim { background: rgba(240, 180, 41, 0.28); font-weight: 800; }
.shq-office { position: relative; overflow: hidden; min-height: 280px; padding: 8px; color: #e8eef8; }
.shq-office .shq-desk-status, .shq-office .shq-speech-quiet { color: #c5cedf; }
.shq-office.is-large { min-height: 420px; }
.shq-office-bg { width: 100%; height: 210px; display: block; border-radius: 14px; }
.shq-office.is-large .shq-office-bg { height: 280px; }
.shq-desks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: -28px;
  position: relative;
  z-index: 1;
}
.shq-desk {
  min-height: 44px;
  height: auto;
  padding: 4px 2px 8px;
  background: rgba(7, 12, 24, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.shq-desk.is-selected { border-color: #3ee0ff; }
.shq-desk.is-follow { box-shadow: 0 0 0 2px rgba(62, 224, 255, 0.7); }
.shq-bot { width: 72px; height: 96px; overflow: visible; }
.shq-nameplate { font-weight: 750; font-size: 0.78rem; text-align: center; }
.shq-desk-status { text-align: center; font-size: 0.72rem; }
.shq-speech, .shq-sim-approval, .shq-callout, .shq-live-empty {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 14, 28, 0.45);
}
.shq-sim, .shq-sim-approval {
  display: inline-block;
  margin-right: 6px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #ffd27a;
}
.shq-sim-approval { display: block; border: 1px solid rgba(240, 180, 41, 0.7); }
.shq-path { animation: shq-dash 12s linear infinite; }
.shq-bot[data-pose='idle'] .shq-rig { animation: shq-bob 4.8s ease-in-out infinite; transform-origin: 40px 100px; }
.shq-bot[data-role='greg'][data-pose='idle'] .shq-rig { animation-duration: 5.6s; }
.shq-bot[data-role='flutter'][data-pose='idle'] .shq-rig { animation-duration: 6.4s; }
.shq-bot[data-role='security'][data-pose='idle'] .shq-rig { animation-duration: 7.2s; }
.shq-bot[data-pose='idle'] .shq-eyes { animation: shq-blink 5.2s infinite; transform-box: fill-box; transform-origin: center; }
.shq-bot[data-pose='work'] .shq-arm-r { animation: shq-type 0.42s ease-in-out infinite; transform-origin: 66px 52px; transform-box: fill-box; }
.shq-bot[data-pose='review'] .shq-scan { animation: shq-scan 1.3s linear infinite; }
.shq-bot[data-pose='blocked'] .shq-led { fill: #f0b429; }
.shq-bot[data-pose='blocked'] .shq-warn { opacity: 1; }
.shq-warn { opacity: 0; }
.shq-scan { opacity: 0; }
.shq-bot[data-pose='review'] .shq-scan { opacity: 0.9; }
.shq-bot[data-pose='celebrate'] .shq-arm-l,
.shq-bot[data-pose='celebrate'] .shq-arm-r { animation: shq-cheer 0.7s ease-in-out infinite; transform-box: fill-box; }
.shq-bot[data-pose='celebrate'] .shq-arm-l { transform-origin: 14px 52px; }
.shq-bot[data-pose='celebrate'] .shq-arm-r { transform-origin: 66px 52px; animation-delay: 0.1s; }
.shq-confetti { position: absolute; inset: 12px 12px auto 12px; height: 80px; pointer-events: none; }
.shq-confetti span {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #3ee0ff;
  animation: shq-confetti 1.4s ease-in infinite;
}
.shq-confetti span:nth-child(2) { left: 20%; background: #ff7ab8; animation-delay: 0.1s; }
.shq-confetti span:nth-child(3) { left: 40%; background: #7dffa8; animation-delay: 0.2s; }
.shq-confetti span:nth-child(4) { left: 60%; background: #f0b429; animation-delay: 0.3s; }
.shq-confetti span:nth-child(5) { left: 80%; background: #c4a6ff; }
.shq-minibot {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 750;
}
.shq-minibot svg { width: 28px; height: 28px; }
.shq-activity { padding: 12px; max-height: 520px; overflow: auto; }
.shq-activity ol, .shq-events ol, .shq-rules, .shq-agent-list, .shq-approval-list, .shq-run-list, .shq-counts, .shq-link-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.shq-activity li > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}
.shq-activity button, .shq-events button, .shq-agent-list button {
  width: 100%;
  height: auto;
  min-height: 44px;
  text-align: left;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  white-space: normal;
}
.shq-activity-title { font-weight: 750; }
.shq-events { margin-top: 8px; max-width: 100%; }
.shq-events ol { max-height: 240px; overflow: auto; }
.shq-events button[aria-current='step'] { border-color: #3ee0ff; }
.shq-panel { display: flex; flex-direction: column; gap: 8px; }
.shq-rules li, .shq-counts li, .shq-run-list li, .shq-approval-list li {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}
.shq-counts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.shq-counts li { display: flex; justify-content: space-between; gap: 8px; }
.shq-agent-list button { flex-direction: row; align-items: center; }
.shq-agent-list button span { display: flex; flex-direction: column; }
.shq-swatch { width: 14px; height: 14px; border-radius: 99px; flex: 0 0 auto; }
.shq-sheet-wrap { position: fixed; inset: 0; z-index: 80; }
.shq-backdrop { position: absolute; inset: 0; width: 100%; min-width: 0; height: 100%; border: 0; border-radius: 0; background: rgba(4, 8, 16, 0.62); }
.shq-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: min(78dvh, 720px);
  overflow: auto;
  border-radius: 20px 20px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  z-index: 1;
  background: #10182c;
  color: #e8eef8;
  border: 1px solid rgba(255, 255, 255, 0.16);
}
html[data-drevvy-theme='light'] .shq-sheet {
  background: #f6f7fb;
  color: #161a2b;
}
.shq-sheet .shq-fields dt { color: #b7c3d6; }
html[data-drevvy-theme='light'] .shq-sheet .shq-fields dt { color: #3d4860; }
.shq-sheet-bar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  position: sticky;
  top: 0;
  background: #10182c;
  padding-bottom: 8px;
  z-index: 1;
}
html[data-drevvy-theme='light'] .shq-sheet-bar { background: #f6f7fb; }
.shq-icon-btn { min-width: 44px; }
.shq-kicker { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em; color: #ffd27a; }
.shq-fields { margin: 10px 0 0; display: grid; gap: 8px; }
.shq-fields div { display: grid; gap: 2px; }
.shq-fields dt { font-size: 0.75rem; letter-spacing: 0.01em; color: var(--shq-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.shq-fields dd { margin: 0; overflow-wrap: anywhere; }
.shq-clock { margin-left: auto; font-variant-numeric: tabular-nums; }
@keyframes shq-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes shq-blink { 0%, 42%, 48%, 100% { transform: scaleY(1); } 45% { transform: scaleY(0.12); } }
@keyframes shq-type { 0%, 100% { transform: rotate(16deg); } 50% { transform: rotate(-12deg); } }
@keyframes shq-scan { 0% { transform: translateY(-6px); opacity: 0; } 30% { opacity: 0.9; } 100% { transform: translateY(8px); opacity: 0; } }
@keyframes shq-cheer { 0%, 100% { transform: rotate(8deg); } 50% { transform: rotate(-48deg); } }
@keyframes shq-dash { to { stroke-dashoffset: -180; } }
@keyframes shq-confetti { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(64px); opacity: 0; } }
@media (max-width: 699px) {
  .shq-filters { flex-direction: column; }
  .shq-filters label { flex: 1 1 auto; width: 100%; }
}
@media (min-width: 700px) {
  .shq-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; }
  .shq-metric { flex: none; }
  .shq-desks { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .shq-nav { flex-wrap: wrap; overflow: visible; }
}
@media (min-width: 1100px) {
  .shq-metrics { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .shq-stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    align-items: start;
  }
  .shq-office { grid-column: 1 / -1; grid-row: 2; }
  .shq-main-col { grid-column: 1; grid-row: 1; }
  .shq-activity { grid-column: 2; grid-row: 1; }
  .shq-stage-office .shq-office { grid-row: 1; grid-column: 1 / -1; }
  .shq-stage-office .shq-office-tools { grid-row: 2; grid-column: 1; }
  .shq-stage-office .shq-activity { grid-row: 2; }
  .shq-lane { flex-basis: 220px; width: 220px; }
  .shq-sheet {
    left: auto;
    top: 0;
    bottom: 0;
    width: min(440px, 100%);
    max-height: none;
    border-radius: 20px 0 0 20px;
  }
}
.shq-reduce .shq-bot .shq-rig,
.shq-reduce .shq-bot .shq-eyes,
.shq-reduce .shq-bot .shq-arm-l,
.shq-reduce .shq-bot .shq-arm-r,
.shq-reduce .shq-bot .shq-scan,
.shq-reduce .shq-path,
.shq-reduce .shq-confetti span,
.shq-reduce .shq-card {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .shq .shq-bot .shq-rig,
  .shq .shq-bot .shq-eyes,
  .shq .shq-bot .shq-arm-l,
  .shq .shq-bot .shq-arm-r,
  .shq .shq-bot .shq-scan,
  .shq .shq-path,
  .shq .shq-confetti,
  .shq .shq-card {
    animation: none !important;
  }
}
`;
