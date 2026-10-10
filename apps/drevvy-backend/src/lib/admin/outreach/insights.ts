import OpenAI from 'openai';

import { buildOutreachReport } from './analytics';
import { getOutreachDeals } from './mock-source';
import { dealsStartedBetween } from './analytics';
import type { OutreachInsight, OutreachRange, TouchpointId } from './types';
import { TOUCHPOINT_IDS } from './types';

const cache = new Map<string, OutreachInsight>();

export async function getOutreachInsight(
  range: OutreachRange,
  options: { regenerate?: boolean; apiKey?: string | null } = {},
): Promise<OutreachInsight> {
  const key = `${range.from}|${range.to}`;
  if (options.regenerate) cache.delete(key);
  const cached = cache.get(key);
  if (cached) return cached;

  const apiKey = options.apiKey === undefined ? process.env.OPENAI_API_KEY : options.apiKey;
  const insight = apiKey ? await llmInsight(range, apiKey) : sampleInsight(range);
  cache.set(key, insight);
  return insight;
}

export function clearOutreachInsightCache(): void {
  cache.clear();
}

function sampleInsight(range: OutreachRange): OutreachInsight {
  const report = buildOutreachReport(range.from, range.to);
  const objections = objectionCounts(range);
  const guarded = report.variants.find((row) => row.guardrail);
  const winner = report.variants.find((row) => row.winner);
  const quiet = report.firstReplyByTouchpoint.slice().sort((a, b) => a.count - b.count)[0];
  const working = winner
    ? [`${winner.touchpoint} variant ${winner.variant} has the highest reply rate among arms with enough sends (${pct(winner.replyRate)}).`]
    : ['Most touchpoints are still under 30 sends per variant, so early reply rates are directional only.'];
  if ((report.kpis.numberCaptureRate ?? 0) > 0) {
    working.push(`Calls that reach a person capture a salesperson number ${pct(report.kpis.numberCaptureRate)} of the time.`);
  }
  const notWorking = [
    guarded
      ? `${guarded.touchpoint} variant ${guarded.variant} is over the opt-out guardrail (more than twice control). Pause it for a human to review.`
      : 'No variant is over the opt-out guardrail in this range.',
  ];
  if ((report.kpis.soldBeforeReplyRate ?? 0) > 0) {
    notWorking.push(`${pct(report.kpis.soldBeforeReplyRate)} of contacted deals were sold before a reply, so some silence is the car leaving, not the copy.`);
  }
  const bottlenecks = [
    objections.come_in + objections.need_phone + objections.credit_app > 0
      ? `Inbound replies often stall on "come in" (${objections.come_in}), "need a phone" (${objections.need_phone}), or a credit app (${objections.credit_app}).`
      : 'Few inbound objections are in this range yet.',
    quiet ? `The thinnest first-reply touchpoint in this cut is ${quiet.touchpoint} (${quiet.count}).` : 'No first replies are attributed yet.',
    `${report.kpis.endedNoResponse} deals ran to the closing email with no response.`,
  ];
  return {
    source: 'sample',
    label: 'Sample insight. No OPENAI_API_KEY is set, so this is a labeled read of the mock metrics, not a model.',
    generatedAt: new Date().toISOString(),
    working,
    notWorking,
    bottlenecks,
    nextSteps: [
      'Keep equal traffic until an arm has about 30 sends, then read the interval before calling a winner.',
      'A person still approves any new control. This panel does not change the cadence.',
      'When a dealer says come in, need a phone, or credit app, hand the thread to the reply workflow instead of sending the next touch.',
    ],
    proposedVariants: [
      {
        touchpoint: 'D1-T2',
        hypothesis: 'Naming the buyer and asking only for an itemized price, without a deadline, lowers opt-outs versus the short OTD variant.',
        sketch: 'Drevvy for {first} on #{stock}. One line with the itemized out-the-door price is enough. Text is perfect.',
      },
      {
        touchpoint: 'D0-C1',
        hypothesis: 'Leading with the buyer\'s first name and the number ask in the first sentence raises number capture.',
        sketch: 'Hi, this is Drevvy calling for {first}. What\'s the best number to text a salesperson about stock {stock}?',
      },
    ],
  };
}

async function llmInsight(range: OutreachRange, apiKey: string): Promise<OutreachInsight> {
  try {
    const report = buildOutreachReport(range.from, range.to);
    const samples = recentInbound(range).slice(0, 8);
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `You advise a human on Drevvy's dealer outreach cadence. Suggestions only. Do not say the cadence changed.
Rules: calls introduce themselves as Drevvy calling for the buyer by first name. Never write "automated assistant". Never use the word "negotiate". Never include a shopper phone, email, or last name.
Return JSON with keys working, notWorking, bottlenecks, nextSteps (string arrays) and proposedVariants (array of {touchpoint, hypothesis, sketch}). touchpoint must be one of ${TOUCHPOINT_IDS.join(', ')}. Propose 1 or 2 variants.

Metrics:
${JSON.stringify({ kpis: report.kpis, stops: report.stops, variants: report.variants.filter((row) => row.sends > 0), objections: objectionCounts(range) })}

Recent inbound messages and transcripts:
${samples.map((row) => `- ${row.touchpoint} ${row.channel}: ${row.transcript ?? row.body}`).join('\n')}`,
      }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as Partial<OutreachInsight>;
    return {
      source: 'llm',
      label: 'Model suggestions from the aggregated mock metrics. Nothing was sent to dealers.',
      generatedAt: new Date().toISOString(),
      working: strings(parsed.working),
      notWorking: strings(parsed.notWorking),
      bottlenecks: strings(parsed.bottlenecks),
      nextSteps: strings(parsed.nextSteps),
      proposedVariants: variants(parsed.proposedVariants),
    };
  } catch {
    const fallback = sampleInsight(range);
    return { ...fallback, label: 'Sample insight. The model call failed, so this is a labeled read of the mock metrics.' };
  }
}

function objectionCounts(range: OutreachRange): { come_in: number; need_phone: number; credit_app: number } {
  const inbound = recentInbound(range);
  return {
    come_in: inbound.filter((row) => /come in/i.test(row.body)).length,
    need_phone: inbound.filter((row) => /phone number/i.test(row.body)).length,
    credit_app: inbound.filter((row) => /credit app/i.test(row.body)).length,
  };
}

function recentInbound(range: OutreachRange) {
  return dealsStartedBetween(range.from, range.to, getOutreachDeals())
    .flatMap((deal) => deal.events.filter((event) => event.direction === 'inbound'))
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6);
}

function variants(value: unknown): OutreachInsight['proposedVariants'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { touchpoint?: string; hypothesis?: string; sketch?: string };
    if (!row.touchpoint || !TOUCHPOINT_IDS.includes(row.touchpoint as TouchpointId)) return [];
    if (typeof row.hypothesis !== 'string' || typeof row.sketch !== 'string') return [];
    return [{ touchpoint: row.touchpoint as TouchpointId, hypothesis: row.hypothesis, sketch: row.sketch }];
  }).slice(0, 2);
}

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}
