'use client';

import { useState } from 'react';

import { useGlassTheme } from '@/components/glass/glass-theme';

export function RooftopSwitcher() {
  const { rooftopId, setRooftopId, rooftops, canSwitchAllRooftops } = useGlassTheme();
  const [open, setOpen] = useState(false);
  const current =
    rooftopId === 'all'
      ? 'All rooftops'
      : (rooftops.find(item => item.id === rooftopId)?.name ?? rooftops[0]?.name ?? 'Rooftop');

  if (rooftops.length === 0) return null;

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
        {rooftops.map(rooftop => (
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
            {rooftop.name}
          </button>
        ))}
        {canSwitchAllRooftops ? (
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
        ) : null}
      </div>
    </div>
  );
}
