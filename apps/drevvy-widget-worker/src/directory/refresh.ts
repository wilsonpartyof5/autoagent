/** A directory row older than this many days is due for another fetch. */
export const REFRESH_AFTER_DAYS = 30;

const REFRESH_AFTER_MS = REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000;

export function isDueForRefresh(lastCheckedAt: string | null, now: Date = new Date()): boolean {
  if (!lastCheckedAt) return true;
  const checked = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(checked)) return true;
  return now.getTime() - checked > REFRESH_AFTER_MS;
}
