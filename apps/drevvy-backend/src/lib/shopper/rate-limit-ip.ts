/**
 * Bucket key for per-IP limits. Same grouping as the Discover client-ip
 * helper: IPv4 stays one host, IPv6 shares the /64, and an IPv4-mapped
 * address keeps the embedded IPv4.
 */

function parseIpv4(value: string): string | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part > 255)) return null;
  return parts.join('.');
}

function parseHexGroups(side: string): number[] | null {
  if (!side) return [];
  const parts = side.split(':');
  if (parts.some((part) => part.length === 0)) return null;
  const groups: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    groups.push(Number.parseInt(part, 16));
  }
  return groups;
}

function parseIpv6(value: string): number[] | null {
  let text = value.trim().toLowerCase();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  const zone = text.indexOf('%');
  if (zone >= 0) text = text.slice(0, zone);
  if (!text.includes(':')) return null;

  let v4Tail: number[] | null = null;
  const lastColon = text.lastIndexOf(':');
  const dotted = text.slice(lastColon + 1);
  if (dotted.includes('.')) {
    const v4 = parseIpv4(dotted);
    if (!v4) return null;
    const [a, b, c, d] = v4.split('.').map(Number);
    v4Tail = [(a << 8) | b, (c << 8) | d];
    text = text.slice(0, lastColon);
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const left = parseHexGroups(halves[0] ?? '');
  const right = halves.length === 2 ? parseHexGroups(halves[1] ?? '') : [];
  if (!left || !right) return null;
  const tail = v4Tail ?? [];
  if (halves.length === 1) {
    const groups = [...left, ...tail];
    return groups.length === 8 ? groups : null;
  }
  const missing = 8 - left.length - right.length - tail.length;
  if (missing < 1) return null;
  return [...left, ...Array<number>(missing).fill(0), ...right, ...tail];
}

function embeddedIpv4(groups: number[]): string | null {
  const mapped = groups[5] === 0xffff && groups.slice(0, 5).every((group) => group === 0);
  if (!mapped) return null;
  const hi = groups[6] ?? 0;
  const lo = groups[7] ?? 0;
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function rateLimitIpKey(ip: string): string {
  const trimmed = ip.trim();
  const v4 = parseIpv4(trimmed);
  if (v4) return v4;
  const groups = parseIpv6(trimmed);
  if (!groups) return trimmed.replace(/[^A-Za-z0-9.:_-]/g, '').slice(0, 64) || 'unknown';
  const mapped = embeddedIpv4(groups);
  if (mapped) return mapped;
  return groups.slice(0, 4).map((group) => group.toString(16)).join(':');
}
