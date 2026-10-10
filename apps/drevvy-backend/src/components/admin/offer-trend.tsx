export function OfferTrend({ points }: { points: Array<{ at: string; otd: number }> }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400">No out-the-door quotes yet.</p>;
  }
  const values = points.map((point) => point.otd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 320;
  const height = 120;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point.otd - min) / span) * (height - 16) - 8;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" role="img" aria-label="Offer trend">
      <polyline fill="none" stroke="#6ee7b7" strokeWidth="3" points={coords.join(' ')} />
      {coords.map((coord) => {
        const [x, y] = coord.split(',');
        return <circle key={coord} cx={x} cy={y} r="4" fill="#d1fae5" />;
      })}
    </svg>
  );
}
