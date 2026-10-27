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

import { DEMO_ROOFTOPS, type DemoRooftopId } from '@/lib/dealer/demo-org';

export type GlassTheme = 'dark' | 'light';

const THEME_KEY = 'drevvy-theme';
const ROOFTOP_KEY = 'drevvy-rooftop';

interface GlassState {
  theme: GlassTheme;
  setTheme: (theme: GlassTheme) => void;
  rooftopId: DemoRooftopId;
  setRooftopId: (id: DemoRooftopId) => void;
  rooftopLabel: string;
}

const GlassContext = createContext<GlassState | null>(null);

export function useGlassTheme(): GlassState {
  const value = useContext(GlassContext);
  if (!value) {
    throw new Error('useGlassTheme must be used inside GlassRoot');
  }
  return value;
}

export function GlassRoot({
  children,
  defaultRooftop = 'lakeside',
}: {
  children: ReactNode;
  defaultRooftop?: DemoRooftopId;
}) {
  const [theme, setThemeState] = useState<GlassTheme>('dark');
  const [rooftopId, setRooftopState] = useState<DemoRooftopId>(defaultRooftop);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme);
    }
    const savedRooftop = window.localStorage.getItem(ROOFTOP_KEY);
    if (savedRooftop && DEMO_ROOFTOPS.some(item => item.id === savedRooftop)) {
      setRooftopState(savedRooftop as DemoRooftopId);
    }
  }, []);

  const setTheme = useCallback((next: GlassTheme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_KEY, next);
  }, []);

  const setRooftopId = useCallback((id: DemoRooftopId) => {
    setRooftopState(id);
    window.localStorage.setItem(ROOFTOP_KEY, id);
  }, []);

  const rooftopLabel =
    DEMO_ROOFTOPS.find(item => item.id === rooftopId)?.name ?? 'All rooftops';

  const value = useMemo(
    () => ({ theme, setTheme, rooftopId, setRooftopId, rooftopLabel }),
    [theme, setTheme, rooftopId, setRooftopId, rooftopLabel]
  );

  return (
    <GlassContext.Provider value={value}>
      <div className="glass-app" data-theme={theme}>
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
