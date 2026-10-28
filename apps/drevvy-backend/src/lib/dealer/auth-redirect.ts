/**
 * Dealer sign-in redirect.
 *
 * Supabase `signInWithOtp` sends the Magic Link template. With PKCE that link
 * verifies at Auth and returns `?code=` to `emailRedirectTo`, or to the Site
 * URL when no redirect is allowed. The Site URL is the marketing host, which
 * does not hold the PKCE verifier. The dealer desk host does.
 */

export const DEALER_AUTH_CALLBACK_PATH = '/dealer/auth/callback';
export const DEALER_DESK_ORIGIN = 'https://admin.drevvy.com';
export const MARKETING_AUTH_HOSTS = ['www.drevvy.com', 'drevvy.com'] as const;

const AUTH_CODE = /^[A-Za-z0-9_-]{8,512}$/;

export function dealerAuthRedirectTo(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (!allowedDeskOrigin(url)) return null;
  url.pathname = DEALER_AUTH_CALLBACK_PATH;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function allowedDeskOrigin(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'admin.drevvy.com') return url.protocol === 'https:';
  if (host === 'localhost' || host === '127.0.0.1') {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }
  if (host.endsWith('.vercel.app')) return url.protocol === 'https:';
  return false;
}

/**
 * A PKCE `?code=` that landed on the marketing homepage belongs to a dealer
 * sign-in started on the desk host. Forward it there so the verifier cookie
 * can be exchanged.
 */
export function marketingAuthCodeForwardUrl(
  host: string,
  pathname: string,
  code: string | null | undefined,
): string | null {
  const normalized = host.replace(/:\d+$/, '').toLowerCase();
  if (!MARKETING_AUTH_HOSTS.includes(normalized as (typeof MARKETING_AUTH_HOSTS)[number])) {
    return null;
  }
  if (pathname !== '/' && pathname !== '') return null;
  if (!code || !AUTH_CODE.test(code)) return null;
  return `${DEALER_DESK_ORIGIN}${DEALER_AUTH_CALLBACK_PATH}?code=${encodeURIComponent(code)}`;
}

export function marketingAuthCodeScript(): string {
  const hosts = JSON.stringify([...MARKETING_AUTH_HOSTS]);
  const callback = JSON.stringify(`${DEALER_DESK_ORIGIN}${DEALER_AUTH_CALLBACK_PATH}`);
  return `(function(){try{var host=location.hostname.toLowerCase();var path=location.pathname;if(${hosts}.indexOf(host)<0)return;if(path!=="/"&&path!=="")return;var code=new URLSearchParams(location.search).get("code");if(!code||!/^[A-Za-z0-9_-]{8,512}$/.test(code))return;location.replace(${callback}+"?code="+encodeURIComponent(code));}catch(e){}})();`;
}

/** Hosted Magic Link template. Auth sends this only after it is saved in the project. */
export const DEALER_MAGIC_LINK_SUBJECT = 'Your Drevvy sign-in code';

export const DEALER_MAGIC_LINK_TEMPLATE = `<h2>Your Drevvy dealer sign-in code</h2>
<p>Enter this code on the dealer desk:</p>
<p><strong>{{ .Token }}</strong></p>
<p>Or open this link in the same browser where you requested it:</p>
<p><a href="{{ .ConfirmationURL }}">Open the dealer desk</a></p>`;

export function dealerOtpType(value: string | null): 'email' | 'magiclink' | null {
  if (value === 'email' || value === 'magiclink') return value;
  return null;
}
