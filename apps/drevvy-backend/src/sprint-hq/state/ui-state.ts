import { demoStep } from '../fixtures/demo-script';
import { DEFAULT_MODE } from '../display';
import type { DataMode, OfficeView, RoleId, Speed, ViewId } from '../types';

export type HoldFilter = 'all' | 'holds' | 'open';
export type KindFilter = 'all' | 'proposed' | 'existing';

export type UiState = {
  mode: DataMode;
  view: ViewId;
  selectedCardId: string | null;
  selectedRoleId: RoleId | null;
  watchCardId: string | null;
  query: string;
  owner: string;
  hold: HoldFilter;
  kind: KindFilter;
  reduceMotion: boolean;
  playing: boolean;
  speed: Speed;
  elapsedMs: number;
  pulseStepId: string | null;
  officeView: OfficeView;
  copyStatus: string | null;
  activeLane: string | null;
};

export const initialUiState: UiState = {
  mode: DEFAULT_MODE,
  view: 'board',
  selectedCardId: null,
  selectedRoleId: null,
  watchCardId: null,
  query: '',
  owner: 'all',
  hold: 'all',
  kind: 'all',
  reduceMotion: false,
  playing: false,
  speed: 1,
  elapsedMs: 0,
  pulseStepId: null,
  officeView: 'overview',
  copyStatus: null,
  activeLane: null,
};

export type UiAction =
  | { type: 'setMode'; mode: DataMode }
  | { type: 'setView'; view: ViewId }
  | { type: 'selectCard'; id: string }
  | { type: 'selectRole'; id: RoleId }
  | { type: 'closeOverlays' }
  | { type: 'watchSelected' }
  | { type: 'clearWatch' }
  | { type: 'setQuery'; query: string }
  | { type: 'setOwner'; owner: string }
  | { type: 'setHold'; hold: HoldFilter }
  | { type: 'setKind'; kind: KindFilter }
  | { type: 'toggleReduce' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'tick'; dtMs: number }
  | { type: 'seek'; stepId: string }
  | { type: 'setOfficeView'; officeView: OfficeView }
  | { type: 'copied'; message: string }
  | { type: 'setActiveLane'; lane: string };

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'setMode':
      return {
        ...state,
        mode: action.mode,
        playing: false,
        elapsedMs: 0,
        pulseStepId: null,
        watchCardId: null,
        selectedCardId: null,
        selectedRoleId: null,
        copyStatus: null,
      };
    case 'setView':
      return { ...state, view: action.view };
    case 'selectCard':
      return { ...state, selectedCardId: action.id, selectedRoleId: null, copyStatus: null };
    case 'selectRole':
      return { ...state, selectedRoleId: action.id, selectedCardId: null, copyStatus: null };
    case 'closeOverlays':
      return { ...state, selectedCardId: null, selectedRoleId: null, copyStatus: null };
    case 'watchSelected':
      return state.selectedCardId ? { ...state, watchCardId: state.selectedCardId, view: 'board' } : state;
    case 'clearWatch':
      return { ...state, watchCardId: null };
    case 'setQuery':
      return { ...state, query: action.query };
    case 'setOwner':
      return { ...state, owner: action.owner };
    case 'setHold':
      return { ...state, hold: action.hold };
    case 'setKind':
      return { ...state, kind: action.kind };
    case 'toggleReduce':
      return { ...state, reduceMotion: !state.reduceMotion };
    case 'play':
      return state.mode === 'demo' ? { ...state, playing: true } : state;
    case 'pause':
      return { ...state, playing: false };
    case 'reset':
      return { ...state, playing: false, elapsedMs: 0, pulseStepId: null };
    case 'setSpeed':
      return { ...state, speed: action.speed };
    case 'tick': {
      if (state.mode !== 'demo' || !state.playing) return state;
      const dt = Number.isFinite(action.dtMs) ? Math.max(0, action.dtMs) : 0;
      return { ...state, elapsedMs: state.elapsedMs + dt * state.speed };
    }
    case 'seek': {
      if (state.mode !== 'demo') return state;
      const step = demoStep(action.stepId);
      return { ...state, elapsedMs: step.atMs, pulseStepId: step.id, playing: true };
    }
    case 'setOfficeView':
      return { ...state, officeView: action.officeView };
    case 'copied':
      return { ...state, copyStatus: action.message };
    case 'setActiveLane':
      return { ...state, activeLane: action.lane };
    default:
      return state;
  }
}
