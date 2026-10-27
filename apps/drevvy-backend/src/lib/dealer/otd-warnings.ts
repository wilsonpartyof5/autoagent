/**
 * In-network OTD withhold ladder.
 *
 * Outreach Brain `request_itemization` (`applyPlaybookRules`) is not used.
 * That path escalates when fair OTD is unknown and it drafts a follow-up for
 * the cold outreach brain. Desk only detects a missing itemized best OTD and
 * warns the salesperson on this conversation.
 *
 * Come-in pushes are a separate admin flag. They do not replace this ladder
 * and they do not send a rebuttal.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { shopperFirstNameOnly } from './rooftop-match';

export const OTD_WARNING_LIMIT = 3;

export const OTD_REMOVAL_NOTICE =
  'Your store has been removed from the Drevvy dealer network after 3 warnings for not giving an itemized best out-the-door. Transparency is why Drevvy exists.';

const OPENER_ASK = /wants your best itemized out-the-door/i;
const T6_ASK = /could you share the itemized out-the-door price/i;
const COME_IN = /\b(come on in|come in|stop by|swing by|visit (?:us|the (?:store|dealership)))\b/i;
const MONEY_SOURCE = String.raw`\$\s*\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\$\s*\d{3,6}(?:\.\d{2})?`;

export type DeskThreadMessage = {
  author?: string | null;
  body: string;
};

export type OtdStrikeResult = {
  asked: boolean;
  itemized: boolean;
  replyItemized: boolean;
  warningCount: number;
  warning: string | null;
  removalNotice: string | null;
  recommendRemoval: boolean;
  comeInAdminFlag: boolean;
  comeInCount: number;
};

export function otdWarningMessage(warningNumber: number, firstName: string | null | undefined): string {
  const who = shopperFirstNameOnly(firstName) ?? 'A shopper';
  const n = Math.min(OTD_WARNING_LIMIT, Math.max(1, Math.trunc(warningNumber)));
  return `Warning ${n} of 3: ${who} asked for your best itemized out-the-door and hasn't received it. Transparency is why Drevvy exists. After 3 warnings, your store is removed from the Drevvy dealer network.`;
}

export function threadAskedForItemizedOtd(messages: readonly { body: string }[]): boolean {
  return messages.some((message) => OPENER_ASK.test(message.body) || T6_ASK.test(message.body));
}

/** Vehicle price, a dealer fee, and at least two government fee labels, with dollar amounts. */
export function messageHasItemizedOtd(text: string): boolean {
  const amounts = text.match(new RegExp(MONEY_SOURCE, 'g')) ?? [];
  if (amounts.length < 2) return false;
  const hasPrice = /\b(vehicle price|selling price|sale price|car price|price)\b/i.test(text);
  const hasDealerFee = /\b(doc(?:umentation)? fee|dealer fees?)\b/i.test(text);
  const gov = [/\btax(?:es)?\b/i, /\btitle\b/i, /\breg(?:istration)?\b/i].filter((pattern) => pattern.test(text)).length;
  return hasPrice && hasDealerFee && gov >= 2;
}

function isDealerAuthor(author: string | null | undefined): boolean {
  return author === 'salesperson' || author === 'dealer';
}

export function evaluateOtdWithhold(input: {
  shopperFirstName?: string | null;
  messages: readonly DeskThreadMessage[];
  dealerReply: string;
  warningCount: number;
  removalRecommended?: boolean;
  comeInAdminFlag?: boolean;
  priorComeInCount?: number;
  alreadyItemized?: boolean;
}): OtdStrikeResult {
  const reply = input.dealerReply.trim();
  const asked = threadAskedForItemizedOtd(input.messages) || OPENER_ASK.test(reply) || T6_ASK.test(reply);
  const priorItemized = input.alreadyItemized === true
    || input.messages.some((message) => isDealerAuthor(message.author) && messageHasItemizedOtd(message.body));
  const replyItemized = messageHasItemizedOtd(reply);
  const itemized = priorItemized || replyItemized;
  const scannedComeIns = input.messages.filter((message) => isDealerAuthor(message.author) && COME_IN.test(message.body)).length;
  const priorComeIns = input.priorComeInCount ?? scannedComeIns;
  const comeInCount = priorComeIns + (COME_IN.test(reply) ? 1 : 0);
  const comeInAdminFlag = input.comeInAdminFlag === true || comeInCount > 1;
  const warningCount = Math.max(0, Math.trunc(input.warningCount) || 0);
  const base = {
    asked,
    itemized,
    replyItemized,
    comeInAdminFlag,
    comeInCount,
  };

  if (!asked || itemized || warningCount >= OTD_WARNING_LIMIT) {
    return {
      ...base,
      warningCount,
      warning: null,
      removalNotice: null,
      recommendRemoval: input.removalRecommended === true || warningCount >= OTD_WARNING_LIMIT,
    };
  }

  const next = warningCount + 1;
  const recommendRemoval = next >= OTD_WARNING_LIMIT;
  return {
    ...base,
    warningCount: next,
    warning: otdWarningMessage(next, input.shopperFirstName),
    removalNotice: recommendRemoval ? OTD_REMOVAL_NOTICE : null,
    recommendRemoval,
  };
}

type ConversationWarningRow = {
  opener: string | null;
  shopper_first_name: string | null;
  otd_warning_count: number | null;
  otd_itemized_at: string | null;
  otd_removal_recommended_at: string | null;
  come_in_count: number | null;
  come_in_admin_flag: boolean | null;
};

export async function recordLiveDealerReply(
  supabase: SupabaseClient,
  dealId: string,
  dealerReply: string,
): Promise<OtdStrikeResult | null> {
  const loaded = await supabase
    .from('shopper_dealer_conversations')
    .select('opener, shopper_first_name, otd_warning_count, otd_itemized_at, otd_removal_recommended_at, come_in_count, come_in_admin_flag')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (loaded.error) {
    console.error(JSON.stringify({ event: 'otd_warning_load_failed', dealId, message: loaded.error.message }));
    return null;
  }
  const data = loaded.data as ConversationWarningRow | null;
  if (!data) return null;

  const result = evaluateOtdWithhold({
    shopperFirstName: data.shopper_first_name,
    messages: [{ author: 'drevvy', body: data.opener ?? '' }],
    dealerReply,
    warningCount: data.otd_warning_count ?? 0,
    removalRecommended: data.otd_removal_recommended_at != null,
    comeInAdminFlag: data.come_in_admin_flag === true,
    priorComeInCount: data.come_in_count ?? 0,
    alreadyItemized: data.otd_itemized_at != null,
  });

  const patch: Record<string, unknown> = {
    come_in_count: result.comeInCount,
    come_in_admin_flag: result.comeInAdminFlag,
  };
  if (result.replyItemized && data.otd_itemized_at == null) {
    patch.otd_itemized_at = new Date().toISOString();
  }
  if (result.warning) patch.otd_warning_count = result.warningCount;
  if (result.recommendRemoval && data.otd_removal_recommended_at == null) {
    patch.otd_removal_recommended_at = new Date().toISOString();
  }

  const updated = await supabase.from('shopper_dealer_conversations').update(patch).eq('deal_id', dealId);
  if (updated.error) {
    console.error(JSON.stringify({ event: 'otd_warning_save_failed', dealId, message: updated.error.message }));
    return null;
  }
  if (result.warning) {
    const saved = await supabase.from('dealer_otd_warnings').upsert({
      deal_id: dealId,
      warning_number: result.warningCount,
      body: result.warning,
      removal_notice: result.removalNotice,
    }, { onConflict: 'deal_id,warning_number' });
    if (saved.error) {
      console.error(JSON.stringify({ event: 'otd_warning_insert_failed', dealId, message: saved.error.message }));
    }
  }
  return result;
}

export async function persistLiveOtdReply(dealId: string, dealerReply: string): Promise<OtdStrikeResult | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dealId)) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return await recordLiveDealerReply(createAdminClient(), dealId, dealerReply);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'otd_warning_persist_failed',
      dealId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return null;
  }
}
