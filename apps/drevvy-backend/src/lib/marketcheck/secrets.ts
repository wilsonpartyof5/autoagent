/**
 * Strip MarketCheck credentials before anything is logged or returned.
 * The key is allowed on the outbound server-side request only.
 */

const SECRET_ENV_NAMES = [
  'MARKETCHECK_API_KEY',
  'MARKETCHECK_API_SECRET',
  'MARKETCHECK_MCP_AUTH_TOKEN',
  'INVENTORY_SEARCH_API_KEY',
] as const;

const QUERY_SECRET =
  /([?&#](?:api[_-]?key|apikey|api[_-]?secret|access[_-]?token|auth[_-]?token|authorization)=)[^&#\s"'\\]+/gi;

export function configuredSecrets(): string[] {
  const values: string[] = [];
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.length >= 6) values.push(value);
  }
  return values;
}

export function redactSecrets(value: string): string {
  let out = value;
  for (const secret of configuredSecrets()) {
    if (out.includes(secret)) out = out.split(secret).join('[redacted]');
  }
  return out.replace(QUERY_SECRET, '$1[redacted]');
}

export function containsSecret(value: string): boolean {
  for (const secret of configuredSecrets()) {
    if (value.includes(secret)) return true;
  }
  return /[?&#](?:api[_-]?key|apikey|api[_-]?secret)=(?!\[redacted\])[^&#\s"'\\]+/i.test(value);
}

export function payloadContainsSecret(payload: unknown): boolean {
  try {
    return containsSecret(JSON.stringify(payload));
  } catch {
    return false;
  }
}
