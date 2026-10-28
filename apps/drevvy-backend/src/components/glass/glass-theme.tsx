'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEMO_ROOFTOPS } from '@/lib/dealer/demo-org';

export type GlassTheme = 'dark' | 'light';

export type GlassRooftop = {
  id: string;
  name: string;
};

const THEME_KEY = 'drevvy-theme';
const ROOFTOP_KEY = 'drevvy-rooftop';

interface GlassState {
  theme: GlassTheme;
  setTheme: (theme: GlassTheme) => void;
  rooftopId: string;
  setRooftopId: (id: string) => void;
  rooftopLabel: string;
  rooftops: GlassRooftop[];
  canSwitchAllRooftops: boolean;
}

const GlassContext = createContext<GlassState | null>(null);

export function useGlassTheme(): GlassState {
  const value = useContext(GlassContext);
  if (!value) {
    throw new Error('useGlassTheme must be used inside GlassRoot');
  }
  return value;
}

function readStoredTheme(): GlassTheme | null {
  if (typeof document !== 'undefined') {
    const marked = document.documentElement.getAttribute('data-drevvy-theme');
    if (marked === 'dark' || marked === 'light') return marked;
  }
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function persistTheme(theme: GlassTheme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('data-drevvy-theme', theme);
}

export function GlassThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          "(function(){try{var t=localStorage.getItem('drevvy-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-drevvy-theme',t);}}catch(e){}})();",
      }}
    />
  );
}

function fallbackRooftops(): GlassRooftop[] {
  return DEMO_ROOFTOPS.map((rooftop) => ({ id: rooftop.id, name: rooftop.name }));
}

export function GlassRoot({
  children,
  rooftops,
  canSwitchAllRooftops = false,
  defaultRooftop,
}: {
  children: ReactNode;
  rooftops?: GlassRooftop[];
  canSwitchAllRooftops?: boolean;
  defaultRooftop?: string;
}) {
  const rooftopKey = (rooftops ?? []).map((item) => item.id).join('|');
  const available = useMemo(
    () => (rooftops && rooftops.length > 0 ? rooftops : fallbackRooftops()),
    // rooftopKey is the stable identity of the live membership list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooftopKey],
  );
  const initialId = defaultRooftop
    ?? (canSwitchAllRooftops ? 'all' : available[0]?.id ?? 'all');
  const [theme, setThemeState] = useState<GlassTheme>(
    () => readStoredTheme() ?? 'dark'
  );
  const [rooftopId, setRooftopState] = useState(initialId);

  useEffect(() => {
    const savedTheme = readStoredTheme();
    if (savedTheme) {
      setThemeState(savedTheme);
      persistTheme(savedTheme);
    }
    const savedRooftop = window.localStorage.getItem(ROOFTOP_KEY);
    const known = savedRooftop === 'all'
      ? canSwitchAllRooftops
      : available.some((item) => item.id === savedRooftop);
    if (savedRooftop && known) {
      setRooftopState(savedRooftop);
      return;
    }
    setRooftopState(canSwitchAllRooftops ? 'all' : available[0]?.id ?? 'all');
  }, [available, canSwitchAllRooftops]);

  const setTheme = useCallback((next: GlassTheme) => {
    setThemeState(next);
    persistTheme(next);
  }, []);

  const setRooftopId = useCallback((id: string) => {
    setRooftopState(id);
    window.localStorage.setItem(ROOFTOP_KEY, id);
  }, []);

  const rooftopLabel =
    rooftopId === 'all'
      ? 'All rooftops'
      : (available.find((item) => item.id === rooftopId)?.name ?? available[0]?.name ?? 'Rooftop');

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      rooftopId,
      setRooftopId,
      rooftopLabel,
      rooftops: available,
      canSwitchAllRooftops,
    }),
    [theme, setTheme, rooftopId, setRooftopId, rooftopLabel, available, canSwitchAllRooftops]
  );

  return (
    <GlassContext.Provider value={value}>
      <div className="glass-app" data-theme={theme} suppressHydrationWarning>
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        {children}
      </div>
    </GlassContext.Provider>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useGlassTheme();
  return (
    <div className="tg" role="group" aria-label="Theme">
      <button
        type="button"
        className={theme === 'dark' ? 'on' : undefined}
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme('dark')}
      >
        Dark
      </button>
      <button
        type="button"
        className={theme === 'light' ? 'on' : undefined}
        aria-pressed={theme === 'light'}
        onClick={() => setTheme('light')}
      >
        Light
      </button>
    </div>
  );
}
