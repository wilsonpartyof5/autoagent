import { cn } from '@/lib/utils';

type StoreId = 'ios' | 'android';

function AppleIcon({ className = 'h-[22px] w-[22px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('shrink-0', className)} fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.8c-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.4-4zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" />
    </svg>
  );
}

function PlayIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('shrink-0', className)} aria-hidden="true">
      <path d="M4 2.5v19l10-9.5z" fill="#34A853" />
      <path d="M4 2.5l13.5 7.6L14 12z" fill="#4285F4" />
      <path d="M4 21.5l13.5-7.6L14 12z" fill="#EA4335" />
      <path d="M17.5 10.1 21 12l-3.5 1.9L14 12z" fill="#FBBC04" />
    </svg>
  );
}

const STORE_NAME: Record<StoreId, string> = {
  ios: 'App Store',
  android: 'Google Play',
};

const STORE_KICKER: Record<StoreId, string> = {
  ios: 'Download on the',
  android: 'Get it on',
};

export function StoreBadge({
  store,
  href,
  className,
  fullWidth = false,
}: {
  store: StoreId;
  href?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const comingSoon = !href;
  const name = STORE_NAME[store];
  const classNames = cn(
    fullWidth
      ? 'flex h-[68px] w-full items-center justify-center gap-3 rounded-2xl bg-[#0E1020] px-4 text-white'
      : 'inline-flex min-h-[52px] min-w-[148px] items-center gap-2.5 rounded-[14px] bg-[#0E1020] px-4 py-2.5 text-white',
    comingSoon ? 'cursor-default' : 'transition-opacity hover:opacity-90',
    className,
  );
  const inner = (
    <>
      {store === 'ios' ? (
        <AppleIcon className={fullWidth ? 'h-[26px] w-[26px]' : undefined} />
      ) : (
        <PlayIcon className={fullWidth ? 'h-[26px] w-[26px]' : undefined} />
      )}
      <span className={cn('flex flex-col text-left font-extrabold leading-none', fullWidth ? 'text-[21px]' : 'text-[17px]')}>
        <small className={cn('mb-1 font-semibold opacity-80', fullWidth ? 'text-base' : 'text-[10.5px]')}>
          {comingSoon ? 'Coming soon' : STORE_KICKER[store]}
        </small>
        {name}
      </span>
    </>
  );

  if (comingSoon) {
    return (
      <div className={classNames} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={classNames}
      aria-label={store === 'ios' ? 'Download on the App Store' : 'Get it on Google Play'}
    >
      {inner}
    </a>
  );
}

export function StoreTextLink({ store, href }: { store: StoreId; href?: string }) {
  const className =
    'inline-flex min-h-11 items-center gap-1.5 text-base font-extrabold text-[#4B3FD9]';
  const inner = (
    <>
      {store === 'ios' ? <AppleIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
      <span>{STORE_NAME[store]}</span>
    </>
  );

  if (!href) {
    return (
      <span className={cn(className, 'cursor-default')} aria-disabled="true">
        {inner}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, 'underline underline-offset-[3px]')}
    >
      {inner}
    </a>
  );
}
