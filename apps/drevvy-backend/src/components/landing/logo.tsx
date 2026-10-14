import Link from 'next/link';

export function DrevvyMark({ id, className = 'h-[34px] w-[34px]' }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B4FE9" />
          <stop offset="100%" stopColor="#3A6FF0" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        d="M22 16H48A34 34 0 0 1 48 84H22Z M37 31H48A19 19 0 0 1 48 69H37Z"
        fill={`url(#${id})`}
      />
      <path
        d="M48.5 37Q50.58 47.92 61.5 50Q50.58 52.08 48.5 63Q46.42 52.08 35.5 50Q46.42 47.92 48.5 37Z"
        fill={`url(#${id})`}
      />
      <path
        d="M80 12Q80.96 17.04 86 18Q80.96 18.96 80 24Q79.04 18.96 74 18Q79.04 17.04 80 12Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

export function Logo({
  gradientId,
  className = '',
}: {
  gradientId: string;
  className?: string;
}) {
  return (
    <Link href="/" className={`inline-flex min-h-11 items-center gap-2.5 ${className}`}>
      <DrevvyMark id={gradientId} />
      <span className="text-[21px] font-extrabold tracking-[-0.02em] text-[#171A2C]">Drevvy</span>
    </Link>
  );
}
