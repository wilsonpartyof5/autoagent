import { headers } from 'next/headers';
import { deviceCtaMode, storeUrlsFromEnv } from '@/lib/store-links';
import { QRCode } from '@/components/landing/qr-code';
import { StoreBadge, StoreTextLink } from '@/components/landing/store-badges';

function QrCard({
  appStore,
  playStore,
}: {
  appStore?: string;
  playStore?: string;
}) {
  const pending = !appStore || !playStore;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 rounded-3xl border border-white bg-white/80 p-5 text-center shadow-[0_16px_40px_rgba(40,50,110,0.12)] backdrop-blur-md sm:w-fit sm:flex-row sm:items-center sm:gap-6 sm:py-5 sm:pl-5 sm:pr-7 sm:text-left">
      <div className="h-[132px] w-[132px] shrink-0 rounded-2xl bg-white p-2.5 shadow-[inset_0_0_0_1px_#E3E6F0]">
        <QRCode size={112} className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-extrabold tracking-[-0.01em]">Scan to get Drevvy on your phone</p>
        <p className="mx-auto mt-1 max-w-[290px] text-base text-[#565D73] sm:mx-0">
          Point your camera at the code. It opens drevvy.com/get.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 sm:justify-start">
          <StoreTextLink store="ios" href={appStore} />
          <StoreTextLink store="android" href={playStore} />
        </div>
        {pending ? (
          <p className="mt-2 text-base font-semibold text-[#171A2C]/70 lg:text-[13px]">
            Coming soon to iOS and Android.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export async function StoreCta({ id }: { id?: string }) {
  const headerList = await headers();
  const userAgent = headerList.get('user-agent') ?? '';
  const urls = storeUrlsFromEnv();
  const mode = deviceCtaMode(userAgent);
  const showIos = mode === 'ios' || mode === 'both';
  const showAndroid = mode === 'android' || mode === 'both';
  const shownStorePending = (showIos && !urls.appStore) || (showAndroid && !urls.playStore);

  return (
    <div id={id} data-cta-mode={mode} className="mt-7 scroll-mt-28">
      {mode === 'qr' ? (
        <QrCard appStore={urls.appStore} playStore={urls.playStore} />
      ) : (
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3">
          {showIos ? <StoreBadge store="ios" href={urls.appStore} fullWidth /> : null}
          {showAndroid ? <StoreBadge store="android" href={urls.playStore} fullWidth /> : null}
          {shownStorePending ? (
            <p className="text-center text-base font-semibold text-[#171A2C]/70">
              Coming soon to iOS and Android.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
