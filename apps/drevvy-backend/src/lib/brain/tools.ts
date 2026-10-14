/**
 * Brain LLM tools for function calling.
 * All tools are read-only except write_lesson and propose_action.
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
import { fetchVendorStatus } from './vendor-status';

export type BrainToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
};

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_failed_events',
      description: 'Get recent failed webhook events from brain_vendor_events',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', enum: ['telnyx', 'elevenlabs'], description: 'Filter by vendor' },
          since: { type: 'string', description: 'ISO timestamp to filter events after' },
          channel: { type: 'string', enum: ['call', 'sms', 'email', 'voicemail'], description: 'Filter by channel' },
          limit: { type: 'number', description: 'Max events to return (default 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_transcript',
      description: 'Read a call transcript by deal_id or event_id',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'string', description: 'Deal ID to look up transcript for' },
          event_id: { type: 'string', description: 'Specific event ID to look up' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vendor_status',
      description: 'Get current vendor status including open incidents',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', enum: ['telnyx', 'elevenlabs'], description: 'Specific vendor or omit for all' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_lessons',
      description: 'Read approved lessons from the brain, optionally filtered by scope',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'object',
            properties: {
              brand: { type: 'string' },
              region: { type: 'string' },
              dealer_type: { type: 'string' },
              touchpoint: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_lesson',
      description: 'Propose a new lesson learned from analysis (status=proposed, requires human approval)',
      parameters: {
        type: 'object',
        properties: {
          lesson: { type: 'string', description: 'The lesson text' },
          scope: {
            type: 'object',
            properties: {
              brand: { type: 'string' },
              region: { type: 'string' },
              dealer_type: { type: 'string' },
              touchpoint: { type: 'string' },
            },
          },
          evidence: { type: 'object', description: 'Metric snapshot backing the lesson' },
          confidence: { type: 'number', description: 'Confidence score 0-1' },
        },
        required: ['lesson'],
      },
    },
  },
];

export async function executeTool(
  supabase: SupabaseClient,
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  sourceRunId?: string,
): Promise<BrainToolCall> {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

  let result: unknown;

  switch (name) {
    case 'get_failed_events': {
      const events = await getRecentFailedEvents(supabase, {
        vendor: args.vendor as string | undefined,
        since: args.since as string | undefined,
        channel: args.channel as string | undefined,
        limit: args.limit as number | undefined,
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
        dealId: args.deal_id as string | undefined,
        eventId: args.event_id as string | undefined,
      });
      result = transcript ?? { error: 'No transcript found' };
      break;
    }

    case 'get_vendor_status': {
      const vendor = args.vendor as 'telnyx' | 'elevenlabs' | undefined;
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
      const scope = args.scope as { brand?: string; region?: string; dealer_type?: string; touchpoint?: string } | undefined;
      const lessons = await getApprovedLessons(supabase, scope);
      result = lessons.map((l) => ({
        id: l.id,
        lesson: l.lesson,
        scope: l.scope,
        confidence: l.confidence,
      }));
      break;
    }

    case 'write_lesson': {
      const insertResult = await insertBrainLesson(supabase, {
        lesson: args.lesson as string,
        scope: (args.scope as Record<string, unknown>) ?? {},
        evidence: (args.evidence as Record<string, unknown>) ?? null,
        confidence: args.confidence as number | null ?? null,
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
