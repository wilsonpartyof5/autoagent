export type LaunchArea = {
  zip: string;
  radiusMiles: number;
};

const ZIP = /^\d{5}$/;

/** Lines are `ZIP` or `ZIP RADIUS`. Radius is miles. `#` comments and blank lines are ignored. */
export function parseLaunchAreas(text: string, defaultRadius: number | null): LaunchArea[] {
  const areas: LaunchArea[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? '';
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/[\s,]+/).filter((part) => part.length > 0);
    if (parts.length > 2) {
      throw new Error(`Launch area line ${index + 1} must be a ZIP and an optional radius.`);
    }
    const zip = parts[0];
    if (!zip || !ZIP.test(zip)) throw new Error(`Launch area line ${index + 1} is not a 5-digit ZIP.`);
    const radius = parts[1] != null ? parseRadius(parts[1], index) : defaultRadius;
    if (radius == null) {
      throw new Error(`Launch area line ${index + 1} needs a radius in miles, or pass --radius.`);
    }
    if (seen.has(zip)) continue;
    seen.add(zip);
    areas.push({ zip, radiusMiles: radius });
  }
  return areas;
}

export function assertLaunchArea(area: LaunchArea): void {
  if (!ZIP.test(area.zip)) throw new Error('ZIP must be 5 digits.');
  if (!Number.isInteger(area.radiusMiles) || area.radiusMiles < 1 || area.radiusMiles > 500) {
    throw new Error('Radius must be from 1 to 500 miles.');
  }
}

function parseRadius(value: string, index: number): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Launch area line ${index + 1} has a radius that is not a whole number of miles.`);
  }
  const radius = Number(value);
  if (radius < 1 || radius > 500) {
    throw new Error(`Launch area line ${index + 1} radius must be from 1 to 500 miles.`);
  }
  return radius;
}
