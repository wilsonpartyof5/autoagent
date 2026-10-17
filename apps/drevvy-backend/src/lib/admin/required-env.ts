/**
 * Names of environment variables the operator console expects.
 * The check reports names only. It never returns or logs values.
 */

export const REQUIRED_ENV_NAMES = [
  'TELNYX_API_KEY',
  'TELNYX_PUBLIC_KEY',
  'TELNYX_FROM_NUMBER',
  'TELNYX_MESSAGING_PROFILE_ID',
  'ELEVENLABS_API_KEY',
  'CRON_SECRET',
  'REVENUECAT_WEBHOOK_SECRET',
  'REVENUECAT_SECRET_API_KEY',
] as const;

export type RequiredEnvName = (typeof REQUIRED_ENV_NAMES)[number];

export function missingRequiredEnv(env: Record<string, string | undefined>): RequiredEnvName[] {
  return REQUIRED_ENV_NAMES.filter((name) => {
    const value = env[name];
    return value == null || value.trim() === '';
  });
}

export function formatMissingEnv(names: readonly string[]): string {
  if (names.length === 0) return 'Required environment variables are set.';
  return `Missing environment variables: ${names.join(', ')}`;
}
