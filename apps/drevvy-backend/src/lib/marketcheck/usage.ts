import { currentSubjectHash } from './context';

/**
 * Per-call MarketCheck usage. Logs the endpoint name and a count only.
 * A subject, when the route has an opaque shopper id, is a hash — never a
 * VIN, ZIP, name, email, or coordinate.
 */

const totals = new Map<string, number>();
const bySubject = new Map<string, Map<string, number>>();
const SUBJECT_CAP = 1000;

export type MarketCheckCallLog = {
  event: 'marketcheck_call';
  endpoint: string;
  count: number;
  total: number;
  subject?: string;
  subjectCount?: number;
};

export function recordMarketCheckCall(endpoint: string): MarketCheckCallLog {
  const total = (totals.get(endpoint) ?? 0) + 1;
  totals.set(endpoint, total);

  const subject = currentSubjectHash();
  let subjectCount: number | undefined;
  if (subject) {
    if (!bySubject.has(subject) && bySubject.size >= SUBJECT_CAP) {
      const oldest = bySubject.keys().next().value;
      if (oldest) bySubject.delete(oldest);
    }
    const bucket = bySubject.get(subject) ?? new Map<string, number>();
    subjectCount = (bucket.get(endpoint) ?? 0) + 1;
    bucket.set(endpoint, subjectCount);
    bySubject.set(subject, bucket);
  }

  const entry: MarketCheckCallLog = {
    event: 'marketcheck_call',
    endpoint,
    count: 1,
    total,
    ...(subject ? { subject, subjectCount } : {}),
  };
  console.log(JSON.stringify(entry));
  return entry;
}

export function marketCheckEndpointTotals(): { endpoint: string; count: number }[] {
  return [...totals.entries()]
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((left, right) => left.endpoint.localeCompare(right.endpoint));
}

export function resetMarketCheckUsageForTests(): void {
  totals.clear();
  bySubject.clear();
}
