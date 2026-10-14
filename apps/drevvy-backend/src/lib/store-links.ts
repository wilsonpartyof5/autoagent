/**
 * Store URLs and the /get smart-link decision.
 * URLs come from NEXT_PUBLIC_APP_STORE_URL and NEXT_PUBLIC_PLAY_STORE_URL.
 * The QR code on the marketing site points at /get; this module decides
 * where that request goes. No network calls.
 */

export const GET_PATH = '/get';

export type StorePlatform = 'ios' | 'android' | 'other';

/** What the landing-page download CTA should render. */
export type DeviceCta = 'ios' | 'android' | 'both' | 'qr';

export type StoreUrls = {
  appStore?: string;
  playStore?: string;
};

export type GetDestination =
  | { kind: 'redirect'; url: string }
  | { kind: 'coming-soon'; platform: 'ios' | 'android' | 'phone' }
  | { kind: 'landing' };

const IOS_PATTERN = /iphone|ipad|ipod/;
const ANDROID_PATTERN = /android/;
const PHONE_PATTERN = /mobile|phone|opera mini|blackberry|webos|silk/;

/** Encoded by public/qr-drevvy-get.svg. Apex host, not www. */
export const QR_TARGET = 'https://drevvy.com/get';

export function getSmartLink(websiteUrl = 'https://drevvy.com'): string {
  return `${websiteUrl.replace(/\/$/, '')}${GET_PATH}`;
}

export function detectStorePlatform(userAgent: string): StorePlatform {
  const ua = userAgent.toLowerCase();
  if (IOS_PATTERN.test(ua)) return 'ios';
  if (ANDROID_PATTERN.test(ua)) return 'android';
  return 'other';
}

function isUnrecognizedPhone(userAgent: string): boolean {
  return PHONE_PATTERN.test(userAgent.toLowerCase());
}

/**
 * Phones get the matching store badge. If the phone's store can't be
 * identified, both badges are the fallback. Desktop gets a QR code.
 */
export function deviceCtaMode(userAgent: string): DeviceCta {
  const platform = detectStorePlatform(userAgent);
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  if (isUnrecognizedPhone(userAgent)) return 'both';
  return 'qr';
}

function usableStoreUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/$/, '') || '/';
  const ownHost = host === 'drevvy.com' || host === 'www.drevvy.com' || host === 'localhost';
  if (ownHost && path === GET_PATH) return undefined;

  return url.toString();
}

export function storeUrlsFromEnv(env: NodeJS.ProcessEnv = process.env): StoreUrls {
  const appStore = usableStoreUrl(env.NEXT_PUBLIC_APP_STORE_URL);
  const playStore = usableStoreUrl(env.NEXT_PUBLIC_PLAY_STORE_URL);
  return {
    ...(appStore ? { appStore } : {}),
    ...(playStore ? { playStore } : {}),
  };
}

/**
 * /get redirects iOS to the App Store and Android to Google Play when that
 * store URL is configured. A phone whose store URL is unset sees a coming-soon
 * page. Every other device returns to the landing page.
 */
export function resolveGetDestination(userAgent: string, urls: StoreUrls): GetDestination {
  const platform = detectStorePlatform(userAgent);
  const appStore = usableStoreUrl(urls.appStore);
  const playStore = usableStoreUrl(urls.playStore);

  if (platform === 'ios') {
    return appStore
      ? { kind: 'redirect', url: appStore }
      : { kind: 'coming-soon', platform: 'ios' };
  }

  if (platform === 'android') {
    return playStore
      ? { kind: 'redirect', url: playStore }
      : { kind: 'coming-soon', platform: 'android' };
  }

  if (isUnrecognizedPhone(userAgent) && !appStore && !playStore) {
    return { kind: 'coming-soon', platform: 'phone' };
  }

  return { kind: 'landing' };
}
