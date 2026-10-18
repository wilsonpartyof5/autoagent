/**
 * Strict proposal contract. The model proposes an action and sourced quote
 * fields. Unknown amounts are null. The out-the-door total is not a model field.
 */

import {
  QUOTE_FIELDS,
  emptyQuote,
  type ExtractedQuote,
  type QuoteField,
  type SourcedAmount,
} from './quote';

export const PROPOSED_ACTIONS = [
  'ask_for_itemization',
  'request_fee_clarification',
  'send_reply',
  'wait',
  'escalate',
] as const;

export type ProposedAction = (typeof PROPOSED_ACTIONS)[number];

export type DealProposal = {
  proposed_action: ProposedAction;
  draft: string | null;
  reasoning: string;
  quote: ExtractedQuote;
};

const sourcedAmountSchema: Record<string, unknown> = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        amount: { type: ['number', 'null'] },
        source_snippet: { type: ['string', 'null'] },
        message_ref: { type: ['string', 'null'] },
      },
      required: ['amount', 'source_snippet', 'message_ref'],
    },
  ],
};

export const PROPOSAL_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    proposed_action: { type: 'string', enum: [...PROPOSED_ACTIONS] },
    draft: { type: ['string', 'null'] },
    reasoning: { type: 'string' },
    quote: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(QUOTE_FIELDS.map((field) => [field, sourcedAmountSchema])),
      required: [...QUOTE_FIELDS],
    },
  },
  required: ['proposed_action', 'draft', 'reasoning', 'quote'],
};

export class ProposalSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalSchemaError';
  }
}

export function parseProposal(raw: string): DealProposal {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ProposalSchemaError('invalid JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProposalSchemaError('proposal must be an object');
  }

  const record = data as Record<string, unknown>;
  if (!isProposedAction(record.proposed_action)) {
    throw new ProposalSchemaError('invalid proposed_action');
  }
  if (!(typeof record.draft === 'string' || record.draft === null)) {
    throw new ProposalSchemaError('draft must be a string or null');
  }
  if (typeof record.reasoning !== 'string' || !record.reasoning.trim()) {
    throw new ProposalSchemaError('reasoning is required');
  }
  if (!record.quote || typeof record.quote !== 'object' || Array.isArray(record.quote)) {
    throw new ProposalSchemaError('quote must be an object');
  }

  const quote = emptyQuote();
  const quoteRecord = record.quote as Record<string, unknown>;
  for (const field of QUOTE_FIELDS) {
    if (!(field in quoteRecord)) throw new ProposalSchemaError(`missing quote field ${field}`);
    quote[field] = parseSourcedAmount(quoteRecord[field], field);
  }

  return {
    proposed_action: record.proposed_action,
    draft: record.draft,
    reasoning: record.reasoning,
    quote,
  };
}

function isProposedAction(value: unknown): value is ProposedAction {
  return typeof value === 'string' && (PROPOSED_ACTIONS as readonly string[]).includes(value);
}

function parseSourcedAmount(value: unknown, field: QuoteField): SourcedAmount | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProposalSchemaError(`${field} must be an object or null`);
  }
  const record = value as Record<string, unknown>;
  if (!('amount' in record) || !('source_snippet' in record) || !('message_ref' in record)) {
    throw new ProposalSchemaError(`${field} is missing source fields`);
  }
  const amount = record.amount;
  if (!(typeof amount === 'number' || amount === null) || (typeof amount === 'number' && !Number.isFinite(amount))) {
    throw new ProposalSchemaError(`${field}.amount must be a number or null`);
  }
  const sourceSnippet = record.source_snippet;
  const messageRef = record.message_ref;
  if (!(typeof sourceSnippet === 'string' || sourceSnippet === null)) {
    throw new ProposalSchemaError(`${field}.source_snippet must be a string or null`);
  }
  if (!(typeof messageRef === 'string' || messageRef === null)) {
    throw new ProposalSchemaError(`${field}.message_ref must be a string or null`);
  }
  if (typeof amount === 'number' && !sourceSnippet?.trim() && !messageRef?.trim()) {
    throw new ProposalSchemaError(`${field} amount is missing a source snippet or message reference`);
  }
  return { amount, source_snippet: sourceSnippet, message_ref: messageRef };
}
