import {
  callTranscript,
  defaultCopyContext,
  emailCopy,
  inboundReply,
  smsCopy,
  voicemailScript,
} from './copy';
import {
  DREVVY_NUMBER,
  type CallOutcome,
  type OutreachChannel,
  type OutreachDeal,
  type OutreachEvent,
  type SendStatus,
  type StopReason,
  type TouchpointId,
  type Variant,
} from './types';

const AS_OF = Date.parse('2026-10-10T16:00:00.000Z');

type Dealer = {
  id: string;
  name: string;
  type: 'franchise' | 'independent';
  brand: string;
  region: string;
  size: 'small' | 'mid' | 'large';
  tz: string;
  textable: boolean;
};

const DEALERS: Dealer[] = [
  { id: 'dlr-piedmont', name: 'Piedmont Auto Group', type: 'franchise', brand: 'Chevrolet', region: 'Rock Hill', size: 'large', tz: 'America/New_York', textable: true },
  { id: 'dlr-catawba', name: 'Catawba Motor Co', type: 'independent', brand: 'Toyota', region: 'Fort Mill', size: 'small', tz: 'America/New_York', textable: false },
  { id: 'dlr-york', name: 'York Road Motors', type: 'franchise', brand: 'Honda', region: 'Charlotte', size: 'mid', tz: 'America/New_York', textable: true },
  { id: 'dlr-wylie', name: 'Lake Wylie Cars', type: 'independent', brand: 'Ford', region: 'Lake Wylie', size: 'small', tz: 'America/New_York', textable: false },
  { id: 'dlr-palmetto', name: 'Palmetto Honda', type: 'franchise', brand: 'Honda', region: 'Columbia', size: 'large', tz: 'America/New_York', textable: true },
  { id: 'dlr-ridge', name: 'Blue Ridge Motors', type: 'independent', brand: 'Toyota', region: 'Asheville', size: 'mid', tz: 'America/New_York', textable: true },
  { id: 'dlr-queen', name: 'Queen City Chevrolet', type: 'franchise', brand: 'Chevrolet', region: 'Charlotte', size: 'large', tz: 'America/New_York', textable: true },
  { id: 'dlr-lowcountry', name: 'Lowcountry Auto', type: 'independent', brand: 'Hyundai', region: 'Charleston', size: 'mid', tz: 'America/New_York', textable: false },
];

const SHOPPERS = ['Maya', 'Chris', 'Elena', 'Sam', 'Jordan', 'Avery', 'Priya', 'Riley', 'Noah', 'Sofia', 'Harper', 'Liam'];

const VEHICLES = [
  { id: 'veh-rav4', vehicle: '2024 Toyota RAV4 Hybrid XLE', short: 'RAV4 Hybrid', price: 34990 },
  { id: 'veh-traverse', vehicle: '2023 Chevrolet Traverse RS', short: 'Traverse', price: 35437 },
  { id: 'veh-crv', vehicle: '2024 Honda CR-V EX', short: 'CR-V', price: 32880 },
  { id: 'veh-f150', vehicle: '2022 Ford F-150 XLT', short: 'F-150', price: 41250 },
  { id: 'veh-tucson', vehicle: '2025 Hyundai Tucson SEL', short: 'Tucson', price: 30110 },
  { id: 'veh-camry', vehicle: '2023 Toyota Camry SE', short: 'Camry', price: 27440 },
  { id: 'veh-accord', vehicle: '2024 Honda Accord Sport', short: 'Accord', price: 31200 },
  { id: 'veh-equinox', vehicle: '2024 Chevrolet Equinox LT', short: 'Equinox', price: 28995 },
];

type Step = { id: TouchpointId; channel: OutreachChannel; minutes: number; call?: boolean };

const STEPS: Step[] = [
  { id: 'D0-E1', channel: 'email', minutes: 0 },
  { id: 'D0-C1', channel: 'call', minutes: 45, call: true },
  { id: 'D0-T1', channel: 'sms', minutes: 52 },
  { id: 'D0-C2', channel: 'call', minutes: 360, call: true },
  { id: 'D1-E2', channel: 'email', minutes: 24 * 60 + 90 },
  { id: 'D1-T2', channel: 'sms', minutes: 24 * 60 + 270 },
  { id: 'D2-C3', channel: 'call', minutes: 2 * 24 * 60 + 150, call: true },
  { id: 'D2-T3', channel: 'sms', minutes: 2 * 24 * 60 + 180 },
  { id: 'D4-E3', channel: 'email', minutes: 4 * 24 * 60 + 90 },
  { id: 'D4-T4', channel: 'sms', minutes: 4 * 24 * 60 + 270 },
  { id: 'D5-E4', channel: 'email', minutes: 5 * 24 * 60 + 90 },
];

const VARIANTS: Variant[] = ['A', 'B', 'C'];

function startFor(index: number): Date {
  if (index >= 90) return new Date(Date.UTC(2026, 9, 9, 14, (index % 6) * 8, 0));
  if (index >= 84) return new Date(Date.UTC(2026, 9, 8, 14, (index % 6) * 8, 0));
  const day = Math.floor(index / 6);
  return new Date(Date.UTC(2026, 8, 18 + day, 13, (index % 6) * 7, 0));
}

function localStamp(date: Date, timeZone: string): { iso: string; weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  return {
    iso: `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`,
    weekday: get('weekday'),
    hour: Number.isFinite(hour) ? hour : 0,
  };
}

function variantFor(dealIndex: number, stepIndex: number, dealerId: string, day: string, touchpoint: string, used: Set<string>): Variant {
  let variant = VARIANTS[(dealIndex + stepIndex * 2) % 3];
  const key = `${dealerId}|${day}|${touchpoint}|${variant}`;
  if (used.has(key)) variant = VARIANTS[(VARIANTS.indexOf(variant) + 1) % 3];
  used.add(`${dealerId}|${day}|${touchpoint}|${variant}`);
  return variant;
}

function callOutcome(touchpoint: TouchpointId, variant: Variant, index: number): CallOutcome {
  if (touchpoint === 'D0-C1' && variant === 'B') return index % 4 === 0 ? 'no_answer' : 'number_captured';
  if (touchpoint === 'D0-C1' && variant === 'C') return index % 3 === 0 ? 'number_captured' : index % 3 === 1 ? 'voicemail' : 'transferred';
  if (touchpoint === 'D0-C1') return (['no_answer', 'voicemail', 'transferred', 'number_captured'] as const)[index % 4];
  if (index % 13 === 0) return 'sold';
  if (index % 11 === 0) return 'refused';
  return (['voicemail', 'no_answer', 'transferred', 'number_captured'] as const)[index % 4];
}

function roll(index: number, touchpoint: TouchpointId): number {
  return (index * 17 + touchpoint.length * 3) % 10;
}

function shouldReply(touchpoint: TouchpointId, variant: Variant, index: number): boolean {
  const slot = roll(index, touchpoint);
  if (touchpoint === 'D0-E1') {
    if (variant === 'B') return slot < 4;
    if (variant === 'A') return slot < 1;
    return slot < 2;
  }
  if (touchpoint === 'D0-T1' || touchpoint === 'D0-TS') {
    if (variant === 'B') return slot < 5;
    if (variant === 'A') return slot < 2;
    return slot < 3;
  }
  if (touchpoint === 'D1-E2' && variant === 'B') return slot < 3;
  if (touchpoint === 'D1-T2' && variant === 'B') return slot < 4;
  if (touchpoint === 'D1-T2' && variant === 'A') return slot < 2;
  if (touchpoint === 'D2-T3' && variant === 'B') return slot < 3;
  if (touchpoint === 'D4-T4' && variant !== 'C') return slot < 2;
  if (touchpoint === 'D5-E4' && variant === 'C') return slot < 1;
  return false;
}

function shouldOptOut(touchpoint: TouchpointId, variant: Variant, index: number): boolean {
  if (touchpoint !== 'D1-T2') return false;
  const slot = index % 10;
  if (variant === 'C') return slot < 4;
  if (variant === 'A') return slot === 0;
  return false;
}

function replyKind(index: number): 'otd' | 'come_in' | 'need_phone' | 'credit_app' {
  const slot = index % 7;
  if (slot === 0) return 'come_in';
  if (slot === 1) return 'need_phone';
  if (slot === 2) return 'credit_app';
  return 'otd';
}

let cached: OutreachDeal[] | null = null;

export function getOutreachDeals(): OutreachDeal[] {
  if (!cached) cached = buildBook();
  return cached;
}

export function getOutreachDeal(id: string): OutreachDeal | null {
  return getOutreachDeals().find((deal) => deal.id === id) ?? null;
}

function buildBook(): OutreachDeal[] {
  const used = new Set<string>();
  return Array.from({ length: 96 }, (_, index) => buildDeal(index, used));
}

function buildDeal(index: number, used: Set<string>): OutreachDeal {
  const dealer = DEALERS[index % DEALERS.length];
  const shopper = SHOPPERS[index % SHOPPERS.length];
  const vehicle = VEHICLES[(index * 3) % VEHICLES.length];
  const started = startFor(index);
  const stock = `A${1000 + index}`;
  const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(vehicle.price);
  const ctx = defaultCopyContext({
    first: shopper,
    vehicle: vehicle.vehicle,
    vehicleShort: vehicle.short,
    stock,
    price,
  });
  const dealId = `cadence-${String(index + 1).padStart(3, '0')}`;
  const events: OutreachEvent[] = [];
  let stop: StopReason = 'in_progress';
  let stopAt: string | null = null;
  let salesperson: string | null = null;
  let sequence = 0;

  const finish = (reason: StopReason, at: string) => {
    stop = reason;
    stopAt = at;
  };

  for (const [stepIndex, step] of STEPS.entries()) {
    const when = new Date(started.getTime() + step.minutes * 60 * 1000);
    if (when.getTime() > AS_OF) {
      finish('in_progress', events.at(-1)?.sentAt ?? started.toISOString());
      break;
    }
    const local = localStamp(when, dealer.tz);
    const touchpoint: TouchpointId = step.id === 'D0-T1' && salesperson ? 'D0-TS' : step.id;
    const variant = variantFor(index, stepIndex, dealer.id, local.iso.slice(0, 10), touchpoint, used);
    const toType = touchpoint === 'D0-TS' || (step.channel === 'sms' && salesperson) ? 'salesperson' : step.channel === 'email' ? 'email' : 'main_line';

    if (step.channel === 'sms' && !salesperson && !dealer.textable) {
      events.push(event({
        dealId, dealer, vehicleId: vehicle.id, touchpoint, variant, channel: 'sms', direction: 'outbound', toType: 'main_line',
        when, local, status: 'skipped_not_textable', body: 'Skipped. Main line is not SMS-capable and no salesperson number has been captured.',
        callOutcome: null, duration: null, captured: null, optOut: false,
      }, sequence++));
      continue;
    }

    if (step.call && (touchpoint === 'D0-C1' || touchpoint === 'D0-C2' || touchpoint === 'D2-C3')) {
      const outcome = callOutcome(touchpoint, variant, index);
      const captured = outcome === 'number_captured' ? `803-555-${String(1400 + index).slice(-4)}` : null;
      const script = callTranscript(touchpoint, variant, ctx, outcome, captured);
      const call = event({
        dealId, dealer, vehicleId: vehicle.id, touchpoint, variant, channel: 'call', direction: 'outbound', toType: 'main_line',
        when, local, status: 'delivered', body: script.summary, transcript: script.transcript, summary: script.summary,
        callOutcome: outcome, duration: script.durationS, captured, optOut: outcome === 'refused',
      }, sequence++);
      events.push(call);
      if (captured) salesperson = captured;
      if (outcome === 'voicemail') {
        const vmWhen = new Date(when.getTime() + 20 * 1000);
        const vmLocal = localStamp(vmWhen, dealer.tz);
        events.push(event({
          dealId, dealer, vehicleId: vehicle.id, touchpoint: 'VM-1', variant, channel: 'voicemail', direction: 'outbound', toType: 'main_line',
          when: vmWhen, local: vmLocal, status: 'delivered', body: voicemailScript(ctx), transcript: voicemailScript(ctx),
          summary: 'Voicemail left on the main line.', callOutcome: 'voicemail', duration: 15, captured: null, optOut: false,
        }, sequence++));
      }
      if (outcome === 'sold') {
        finish('sold', call.sentAt);
        break;
      }
      if (outcome === 'refused') {
        finish('opt_out', call.sentAt);
        break;
      }
      continue;
    }

    const email = step.channel === 'email' ? emailCopy(touchpoint, variant, ctx) : null;
    const sms = step.channel === 'sms' ? smsCopy(touchpoint, variant, ctx) : null;
    const bounced = step.channel === 'email' && index % 23 === 0 && touchpoint !== 'D0-E1';
    const status: SendStatus = bounced ? 'bounced' : 'delivered';
    const opened = step.channel === 'email' && !bounced && index % 2 === 0 ? new Date(when.getTime() + 2 * 60 * 60 * 1000).toISOString() : null;
    const body = email ? `Subject: ${email.subject}\n\n${email.body}` : sms ?? '';
    const outbound = event({
      dealId, dealer, vehicleId: vehicle.id, touchpoint, variant, channel: step.channel, direction: 'outbound', toType,
      when, local, status, body, openedAt: opened, callOutcome: null, duration: null, captured: salesperson, optOut: false,
    }, sequence++);
    events.push(outbound);

    if (bounced) continue;
    if (step.channel === 'sms' && shouldOptOut(touchpoint, variant, index)) {
      outbound.optOut = true;
      const replyAt = new Date(when.getTime() + 25 * 60 * 1000);
      events.push(inbound(outbound, replyAt, dealer, 'sms', inboundReply('stop', ctx), sequence++));
      finish('opt_out', replyAt.toISOString());
      break;
    }
    if (shouldReply(touchpoint, variant, index)) {
      const kind = replyKind(index);
      const channel = index % 5 === 0 ? 'email' : index % 7 === 0 ? 'call' : 'sms';
      const replyAt = new Date(when.getTime() + (4 + (index % 10)) * 60 * 60 * 1000);
      if (replyAt.getTime() > AS_OF) {
        finish('in_progress', outbound.sentAt);
        break;
      }
      const text = inboundReply(kind, ctx);
      const row = inbound(outbound, replyAt, dealer, channel, text, sequence++);
      events.push(row);
      if (channel === 'call') {
        row.transcript = `Dealer called back: ${text}\nDrevvy: Thanks. We'll pass that to ${shopper}. You can text ${DREVVY_NUMBER}.`;
        row.summary = 'Dealer called back.';
        row.callDurationS = 40;
        row.callOutcome = 'transferred';
      }
      outbound.replied = true;
      outbound.replyAt = row.sentAt;
      outbound.replyChannel = channel;
      finish('reply', row.sentAt);
      break;
    }
  }

  if (stop === 'in_progress' && events.some((row) => row.touchpoint === 'D5-E4' && row.direction === 'outbound')) {
    finish('ended_no_response', events.filter((row) => row.touchpoint === 'D5-E4').at(-1)?.sentAt ?? started.toISOString());
  }
  if (!stopAt && events.length > 0 && events.every((row) => row.sentAt <= new Date(AS_OF).toISOString()) && events.some((row) => row.touchpoint === 'D5-E4')) {
    finish('ended_no_response', events.at(-1)?.sentAt ?? started.toISOString());
  }

  const firstOutbound = events.find((row) => row.direction === 'outbound' && row.status !== 'skipped_not_textable');
  const firstReply = events.find((row) => row.direction === 'inbound');
  const attributed = [...events].reverse().find((row) => row.replied);
  const replyWithin5Days = Boolean(
    firstOutbound && firstReply && Date.parse(firstReply.sentAt) - Date.parse(firstOutbound.sentAt) <= 5 * 24 * 60 * 60 * 1000,
  );
  const otdReceived = events.some((row) => row.direction === 'inbound' && /\$\d/.test(row.body));

  return {
    id: dealId,
    shopperFirst: shopper,
    dealerId: dealer.id,
    dealerName: dealer.name,
    dealerType: dealer.type,
    brand: dealer.brand,
    region: dealer.region,
    dealerSize: dealer.size,
    dealerTz: dealer.tz,
    mainLineTextable: dealer.textable,
    vehicleId: vehicle.id,
    vehicle: vehicle.vehicle,
    vehicleShort: vehicle.short,
    stock,
    listedPrice: vehicle.price,
    startedAt: started.toISOString(),
    stop,
    stopAt,
    otdReceived,
    firstReplyAt: firstReply?.sentAt ?? null,
    firstReplyTouchpoint: attributed?.touchpoint ?? null,
    replyWithin5Days,
    events,
  };
}

function event(input: {
  dealId: string;
  dealer: Dealer;
  vehicleId: string;
  touchpoint: TouchpointId;
  variant: Variant;
  channel: OutreachChannel;
  direction: 'outbound' | 'inbound';
  toType: 'main_line' | 'salesperson' | 'email';
  when: Date;
  local: { iso: string; weekday: string };
  status: SendStatus;
  body: string;
  transcript?: string | null;
  summary?: string | null;
  openedAt?: string | null;
  callOutcome: CallOutcome | null;
  duration: number | null;
  captured: string | null;
  optOut: boolean;
}, sequence: number): OutreachEvent {
  return {
    id: `${input.dealId}-${sequence}`,
    dealId: input.dealId,
    dealerId: input.dealer.id,
    vehicleId: input.vehicleId,
    touchpoint: input.touchpoint,
    variant: input.variant,
    channel: input.channel,
    direction: input.direction,
    toType: input.toType,
    sentAt: input.when.toISOString(),
    dealerLocalTime: input.local.iso,
    dealerTz: input.dealer.tz,
    dayOfWeek: input.local.weekday,
    status: input.status,
    openedAt: input.openedAt ?? null,
    replied: false,
    replyAt: null,
    replyChannel: null,
    callOutcome: input.callOutcome,
    callDurationS: input.duration,
    capturedNumber: input.captured,
    optOut: input.optOut,
    dealerType: input.dealer.type,
    brand: input.dealer.brand,
    region: input.dealer.region,
    dealerSize: input.dealer.size,
    body: input.body,
    transcript: input.transcript ?? null,
    summary: input.summary ?? null,
  };
}

function inbound(
  outbound: OutreachEvent,
  when: Date,
  dealer: Dealer,
  channel: 'email' | 'sms' | 'call',
  body: string,
  sequence: number,
): OutreachEvent {
  const local = localStamp(when, dealer.tz);
  const row = event({
    dealId: outbound.dealId,
    dealer,
    vehicleId: outbound.vehicleId,
    touchpoint: outbound.touchpoint,
    variant: outbound.variant,
    channel,
    direction: 'inbound',
    toType: outbound.toType,
    when,
    local,
    status: 'delivered',
    body,
    callOutcome: null,
    duration: null,
    captured: outbound.capturedNumber,
    optOut: body === 'STOP',
  }, sequence);
  return row;
}
