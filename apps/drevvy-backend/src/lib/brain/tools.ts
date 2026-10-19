/**
 * Brain LLM tools for function calling.
 * Definitions are strict JSON schemas for the Responses API. Chat Completions
 * tools are derived from the same specs for callers that still need that shape.
 * All tools are read-only except write_lesson.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';

import {
  getRecentFailedEvents,
  getOpenIncidents,
  getEventTranscript,
  getApprovedLessons,
  insertBrainLesson,
} from './repository';
import { fenceUntrusted } from './model-input';
import { fetchVendorStatus } from './vendor-status';

export type BrainToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
};

type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };

function strictObject(
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  };
}

const scopeSchema = {
  anyOf: [
    { type: 'null' },
    strictObject(
      {
        brand: nullableString,
        region: nullableString,
        dealer_type: nullableString,
        touchpoint: nullableString,
      },
      ['brand', 'region', 'dealer_type', 'touchpoint'],
    ),
  ],
};

const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_failed_events',
    description: 'Get recent failed webhook events from brain_vendor_events',
    parameters: strictObject(
      {
        vendor: { type: ['string', 'null'], enum: ['telnyx', 'elevenlabs', null] },
        since: nullableString,
        channel: { type: ['string', 'null'], enum: ['call', 'sms', 'email', 'voicemail', null] },
        limit: nullableNumber,
      },
      ['vendor', 'since', 'channel', 'limit'],
    ),
  },
  {
    name: 'read_transcript',
    description: 'Read a call transcript by deal_id or event_id',
    parameters: strictObject(
      {
        deal_id: nullableString,
        event_id: nullableString,
      },
      ['deal_id', 'event_id'],
    ),
  },
  {
    name: 'get_vendor_status',
    description: 'Get current vendor status including open incidents',
    parameters: strictObject(
      {
        vendor: { type: ['string', 'null'], enum: ['telnyx', 'elevenlabs', null] },
      },
      ['vendor'],
    ),
  },
  {
    name: 'read_lessons',
    description: 'Read approved lessons from the brain, optionally filtered by scope',
    parameters: strictObject({ scope: scopeSchema }, ['scope']),
  },
  {
    name: 'write_lesson',
    description: 'Propose a new lesson learned from analysis (status=proposed, requires human approval)',
    parameters: strictObject(
      {
        lesson: { type: 'string' },
        scope: scopeSchema,
        evidence: {
          anyOf: [
            { type: 'null' },
            strictObject({ summary: { type: 'string' } }, ['summary']),
          ],
        },
        confidence: nullableNumber,
      },
      ['lesson', 'scope', 'evidence', 'confidence'],
    ),
  },
];

export const RESPONSE_TOOLS: OpenAI.Responses.FunctionTool[] = TOOL_SPECS.map((spec) => ({
  type: 'function',
  name: spec.name,
  description: spec.description,
  parameters: spec.parameters,
  strict: true,
}));

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = TOOL_SPECS.map((spec) => ({
  type: 'function',
  function: {
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
    strict: true,
  },
}));

export async function executeTool(
  supabase: SupabaseClient,
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  sourceRunId?: string,
): Promise<BrainToolCall> {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
  const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

  let result: unknown;

  switch (name) {
    case 'get_failed_events': {
      const events = await getRecentFailedEvents(supabase, {
        vendor: asString(args.vendor),
        since: asString(args.since),
        channel: asString(args.channel),
        limit: asNumber(args.limit),
      });
      result = events.map((e) => ({
        id: e.id,
        vendor: e.vendor,
        event_type: e.event_type,
        channel: e.channel,
        deal_id: e.deal_id,
        error_code: e.error_code,
        error_detail: e.error_detail,
        occurred_at: e.occurred_at,
      }));
      break;
    }

    case 'read_transcript': {
      const transcript = await getEventTranscript(supabase, {
        dealId: asString(args.deal_id),
        eventId: asString(args.event_id),
      });
      result = transcript
        ? {
          transcript: fenceUntrusted('transcript', transcript.transcript ?? ''),
          summary: fenceUntrusted('summary', transcript.summary ?? ''),
        }
        : { error: 'No transcript found' };
      break;
    }

    case 'get_vendor_status': {
      const vendor = asString(args.vendor) as 'telnyx' | 'elevenlabs' | undefined;
      if (vendor) {
        const [status, incidents] = await Promise.all([
          fetchVendorStatus(vendor),
          getOpenIncidents(supabase, vendor),
        ]);
        result = { live: status, storedIncidents: incidents };
      } else {
        const [telnyxStatus, elevenLabsStatus, incidents] = await Promise.all([
          fetchVendorStatus('telnyx'),
          fetchVendorStatus('elevenlabs'),
          getOpenIncidents(supabase),
        ]);
        result = {
          telnyx: telnyxStatus,
          elevenlabs: elevenLabsStatus,
          storedIncidents: incidents,
        };
      }
      break;
    }

    case 'read_lessons': {
      const scope = args.scope && typeof args.scope === 'object'
        ? args.scope as { brand?: string; region?: string; dealer_type?: string; touchpoint?: string }
        : undefined;
      const lessons = await getApprovedLessons(supabase, scope);
      result = lessons.map((l) => ({
        id: l.id,
        lesson: fenceUntrusted('lesson', l.lesson),
        scope: l.scope,
        confidence: l.confidence,
      }));
      break;
    }

    case 'write_lesson': {
      const insertResult = await insertBrainLesson(supabase, {
        lesson: typeof args.lesson === 'string' ? args.lesson : '',
        scope: args.scope && typeof args.scope === 'object' ? args.scope as Record<string, unknown> : {},
        evidence: args.evidence && typeof args.evidence === 'object' ? args.evidence as Record<string, unknown> : null,
        confidence: asNumber(args.confidence) ?? null,
        status: 'proposed',
        source_run_id: sourceRunId ?? null,
        approved_by: null,
        approved_at: null,
      });
      result = insertResult;
      break;
    }

    default:
      result = { error: `Unknown tool: ${name}` };
  }

  return { name, arguments: args, result };
}
