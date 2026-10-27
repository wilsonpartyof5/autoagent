'use client';

import { useState } from 'react';

import { useGlassTheme } from '@/components/glass/glass-theme';
import { DEMO_ROOFTOPS } from '@/lib/dealer/demo-org';

export function RooftopSwitcher() {
  const { rooftopId, setRooftopId } = useGlassTheme();
  const [open, setOpen] = useState(false);
  const current =
    rooftopId === 'all'
      ? 'All rooftops'
      : (DEMO_ROOFTOPS.find(item => item.id === rooftopId)?.name ??
        'Lakeside Honda');

  return (
    <div className={`sel${open ? ' open' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(value => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 0,
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        <span className="m">⌂</span>
        <span className="rn">{current}</span>
        <span aria-hidden>▾</span>
      </button>
      <div className="menu g" role="listbox">
        {DEMO_ROOFTOPS.map(rooftop => (
          <button
            key={rooftop.id}
            type="button"
            role="option"
            aria-selected={rooftopId === rooftop.id}
            onClick={() => {
              setRooftopId(rooftop.id);
              setOpen(false);
            }}
          >
            {rooftop.name} · {rooftop.city}
          </button>
        ))}
        <button
          type="button"
          className="mut"
          role="option"
          aria-selected={rooftopId === 'all'}
          onClick={() => {
            setRooftopId('all');
            setOpen(false);
          }}
        >
          All rooftops (Owner/GM)
        </button>
      </div>
    </div>
  );
}
