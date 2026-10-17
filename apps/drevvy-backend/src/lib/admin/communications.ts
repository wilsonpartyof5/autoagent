import type { TrafficFilter } from './outreach/types';

export type { TrafficFilter };

export type CommunicationRecord = {
  id: string;
  channel: 'call' | 'sms' | 'email' | 'voicemail';
  direction: 'inbound' | 'outbound' | null;
  from: string | null;
  to: string | null;
  body: string;
  transcript: string | null;
  summary: string | null;
  occurredAt: string;
  dealId: string | null;
  dealerId: string | null;
  touchpoint: string | null;
  status: string | null;
  durationS: number | null;
  recordingPath: string | null;
  isTest: boolean;
  conversationType: string | null;
  textableNumber: string | null;
  email: string | null;
  goalReached: boolean;
  voicemailLeft: boolean;
  callControlId: string | null;
};

const TERMINAL_CALL = /hangup|conversation\.ended|recording\.saved|analyzed|insights|conversation_ended/;

export function communicationFromRow(row: Record<string, unknown>): CommunicationRecord | null {
  const channel = row.channel;
  if (channel !== 'call' && channel !== 'sms' && channel !== 'email' && channel !== 'voicemail') return null;
  const body = text(row.body) ?? '';
  const transcript = text(row.transcript);
  const recordingPath = text(row.recording_path);
  const eventType = text(row.event_type) ?? '';
  const visible = channel === 'sms' || channel === 'email'
    ? Boolean(body || transcript)
    : Boolean(transcript || recordingPath || body || TERMINAL_CALL.test(eventType));
  if (!visible) return null;
  const structured = row.structured && typeof row.structured === 'object' ? row.structured as Record<string, unknown> : {};
  const direction = row.direction === 'inbound' || row.direction === 'outbound' ? row.direction : null;
  return {
    id: text(row.id) ?? `${eventType}:${text(row.occurred_at) ?? ''}`,
    channel,
    direction,
    from: text(row.from_address),
    to: text(row.to_address),
    body: body || transcript || '',
    transcript,
    summary: text(row.summary),
    occurredAt: text(row.occurred_at) ?? '',
    dealId: text(row.deal_id),
    dealerId: text(row.dealer_id),
    touchpoint: text(row.touchpoint),
    status: text(row.status),
    durationS: typeof row.duration_s === 'number' ? row.duration_s : null,
    recordingPath,
    isTest: row.is_test === true || row.conversation_type === 'ai_to_ai_test',
    conversationType: text(row.conversation_type),
    textableNumber: text(structured.textableNumber),
    email: text(structured.email),
    goalReached: structured.goalReached === true,
    voicemailLeft: structured.voicemailLeft === true,
    callControlId: text(row.call_control_id),
  };
}

export function collapseCallRecords(rows: CommunicationRecord[]): CommunicationRecord[] {
  const grouped = new Map<string, CommunicationRecord>();
  for (const row of rows) {
    if (!row.callControlId || (row.channel !== 'call' && row.channel !== 'voicemail')) continue;
    const current = grouped.get(row.callControlId);
    grouped.set(row.callControlId, current ? fillCall(current, row) : row);
  }
  const emitted = new Set<string>();
  const merged: CommunicationRecord[] = [];
  for (const row of rows) {
    if (!row.callControlId || (row.channel !== 'call' && row.channel !== 'voicemail')) {
      merged.push(row);
      continue;
    }
    if (emitted.has(row.callControlId)) continue;
    emitted.add(row.callControlId);
    const combined = grouped.get(row.callControlId);
    if (combined) merged.push(combined);
  }
  return merged;
}

function fillCall(primary: CommunicationRecord, extra: CommunicationRecord): CommunicationRecord {
  return {
    ...primary,
    body: primary.body || extra.body,
    transcript: primary.transcript || extra.transcript,
    summary: primary.summary || extra.summary,
    recordingPath: primary.recordingPath || extra.recordingPath,
    durationS: primary.durationS ?? extra.durationS,
    textableNumber: primary.textableNumber || extra.textableNumber,
    email: primary.email || extra.email,
    goalReached: primary.goalReached || extra.goalReached,
    voicemailLeft: primary.voicemailLeft || extra.voicemailLeft,
    from: primary.from || extra.from,
    to: primary.to || extra.to,
    status: primary.status || extra.status,
    dealId: primary.dealId || extra.dealId,
    dealerId: primary.dealerId || extra.dealerId,
    touchpoint: primary.touchpoint || extra.touchpoint,
    isTest: primary.isTest || extra.isTest,
  };
}

export function filterCommunications(rows: CommunicationRecord[], traffic: TrafficFilter): CommunicationRecord[] {
  return rows.filter((row) => {
    if (traffic === 'live') return !row.isTest;
    if (traffic === 'test') return row.isTest;
    return true;
  });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
