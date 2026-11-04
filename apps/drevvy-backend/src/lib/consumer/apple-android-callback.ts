/**
 * Android Sign in with Apple finishes in a browser tab. Apple posts back to
 * our HTTPS return URL. This builds the intent that the Flutter plugin's
 * callback activity receives. The package name is the shopper applicationId.
 */
export const ANDROID_SHOPPER_PACKAGE = 'com.drevvy.drevvy_app';

const ALLOWED_KEYS = new Set(['code', 'id_token', 'state', 'user', 'error']);
const MAX_VALUE_LENGTH = 20000;

export function appleAndroidIntentLocation(entries: Iterable<[string, string]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value.length === 0 || value.length > MAX_VALUE_LENGTH) continue;
    params.append(key, value);
  }
  const query = params.toString();
  return `intent://callback?${query}#Intent;package=${ANDROID_SHOPPER_PACKAGE};scheme=signinwithapple;end`;
}
