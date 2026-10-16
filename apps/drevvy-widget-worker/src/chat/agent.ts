import type { ChatClient } from '../ai/types';
import { parseClassification, type DealerReplyClassification, type ReplyStatus } from '../ai/parse';
import { isAllowlisted, MAX_TURNS_CAP } from '../config';
import { runPrechatGate } from '../forms/prechat';
import { isBotBlockedPage } from '../forms/outreach';
import {
  dealerAskedForShopperContact,
  hasCaptchaChallenge,
  sharesDisallowedContact,
} from '../widgets/guards';
import { detectWidgetVendor } from '../widgets/detect';
import { extractWidgetScope, WIDGET_ADAPTERS, type WidgetVendor } from '../widgets/vendors';
import { extractStockNumber, isExactScriptMessage, renderScript, type RenderedScript, type ScriptId } from '../widgets/script';
import { siteUrlFromVehiclePage } from '../research/urls';
import type { AttemptChannel, AttemptResult, AttemptStatus, AttemptStore, ChatPage, TranscriptEntry } from './types';
import { resolveNextMessage } from './resolve';

export type WidgetChatConfig = {
  dryRun: boolean;
  allowlist: string[];
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
  maxTurns: number;
  leadLastName?: string;
  leadZip?: string | null;
};

export type ChatAttemptResult = AttemptResult;

const CLASSIFY_SYSTEM = `You classify one dealer chat reply about a car listing.
Return JSON only:
{
  "status": "available" | "sold" | "price_given" | "asked_contact" | "human_handoff" | "unknown",
  "price": string | null,
  "next_message": "availability" | "listing_price" | "continue_offline" | "bot_disclosure" | "none"
}
Rules:
- next_message must be one of those ids. Do not write message text.
- available: the vehicle is still for sale and no price was given. next_message = listing_price.
- sold: sold, pending, or unavailable. next_message = none.
- price_given: a listing price was stated. Put that price in price. next_message = continue_offline.
- asked_contact: they want the shopper's name, phone, or email. next_message = none.
- human_handoff: a person will take over or call. next_message = none.
- If they ask whether this is a bot, AI, or human, next_message = bot_disclosure.
- unknown for anything else. next_message = none.
- Never invent a phone number or email.`;

export async function runWidgetChat(input: {
  vehiclePageUrl: string;
  stockNumber?: string | null;
  page: ChatPage;
  ai: ChatClient;
  config: WidgetChatConfig;
  store: AttemptStore;
  now?: () => Date;
  log?: (line: string) => void;
}): Promise<ChatAttemptResult> {
  const now = input.now ?? (() => new Date());
  const log = input.log ?? (() => undefined);
  const started = now();
  const transcript: TranscriptEntry[] = [];
  let status: AttemptStatus = 'unknown';
  let stopReason: string | null = null;
  let error: string | null = null;
  let price: string | null = null;
  let vendor: WidgetVendor | null = null;
  let stock = input.stockNumber?.trim() || null;
  let site: string | null = null;
  let terminal = false;
  let observedReply: AttemptChannel | null = null;

  const finish = async (): Promise<ChatAttemptResult> => {
    const firstReply = observedReply ?? (await input.store.currentFirstReply(input.vehiclePageUrl).catch(() => null));
    const result: ChatAttemptResult = {
      id: null,
      vehiclePageUrl: input.vehiclePageUrl,
      dealerSiteUrl: site,
      stockNumber: stock,
      widgetVendor: vendor,
      status,
      price,
      dryRun: input.config.dryRun,
      transcript,
      stopReason,
      error,
      channel: 'widget',
    };
    try {
      const saved = await input.store.insert({
        vehicle_page_url: input.vehiclePageUrl,
        dealer_site_url: site,
        stock_number: stock,
        widget_vendor: vendor,
        status,
        price,
        dry_run: input.config.dryRun,
        transcript,
        stop_reason: stopReason,
        error,
        started_at: started.toISOString(),
        finished_at: now().toISOString(),
        channel: 'widget',
        first_reply_channel: firstReply,
      });
      result.id = saved.id;
    } catch (storeError) {
      result.error = result.error ?? (storeError instanceof Error ? storeError.message : 'Could not save the attempt.');
      result.status = 'error';
      status = 'error';
    }
    return result;
  };

  const mark = (nextStatus: AttemptStatus, reason: string, systemText?: string): void => {
    status = nextStatus;
    stopReason = reason;
    terminal = true;
    if (systemText) transcript.push({ role: 'system', text: systemText, at: now().toISOString() });
  };

  try {
    site = siteUrlFromVehiclePage(input.vehiclePageUrl);
  } catch (urlError) {
    mark('error', 'invalid_url');
    error = urlError instanceof Error ? urlError.message : 'Invalid vehicle page URL.';
    return finish();
  }

  if (await input.store.hasBlockedSite(site)) {
    return {
      id: null,
      vehiclePageUrl: input.vehiclePageUrl,
      dealerSiteUrl: site,
      stockNumber: stock,
      widgetVendor: null,
      status: 'blocked',
      price: null,
      dryRun: input.config.dryRun,
      transcript: [],
      stopReason: 'blocked',
      error: null,
      channel: 'widget',
    };
  }

  try {
    await input.page.goto(input.vehiclePageUrl);
  } catch (gotoError) {
    mark('error', 'navigation_failed');
    error = gotoError instanceof Error ? gotoError.message : 'Could not open the vehicle page.';
    return finish();
  }

  const html = await input.page.content();
  if (isBotBlockedPage(html)) {
    mark('blocked', 'blocked', 'Stopped: the site blocked automated access.');
    return finish();
  }
  vendor = detectWidgetVendor(html);
  if (!stock) stock = extractStockNumber(html);
  const script = renderScript({
    stockNumber: stock,
    drevvyTextNumber: input.config.drevvyTextNumber,
    drevvyEmail: input.config.drevvyEmail,
    shopperFirst: input.config.shopperFirst,
  });

  if (!vendor) {
    mark('no_widget', 'no_widget', 'No supported chat widget found.');
    return finish();
  }

  const scope = (await input.page.widgetHtml(vendor)) || extractWidgetScope(html, vendor);
  if ((await input.page.captchaVisible(vendor)) || hasCaptchaChallenge(scope)) {
    mark('captcha', 'captcha', 'Stopped: captcha.');
    return finish();
  }

  const openGate = async (widgetHtml: string) =>
    runPrechatGate({
      vehiclePageUrl: input.vehiclePageUrl,
      dealerSiteUrl: site,
      stockNumber: stock,
      widgetVendor: vendor,
      widgetHtml,
      page: input.page,
      config: input.config,
      store: input.store,
      now,
      log,
      started,
    });

  const initialGate = await openGate(scope);
  if (!initialGate.continueChat) {
    mark(initialGate.status ?? 'unknown', initialGate.stopReason ?? 'prechat', initialGate.note ?? undefined);
    return finish();
  }

  if (input.config.dryRun) {
    log(`[dry-run] ${input.vehiclePageUrl} vendor=${vendor} would send: ${script.availability}`);
    transcript.push({ role: 'agent', text: script.availability, at: now().toISOString(), via: 'planned' });
    mark('dry_run', 'dry_run', 'Dry run: nothing was sent.');
    return finish();
  }

  if (!isAllowlisted(input.vehiclePageUrl, input.config.allowlist)) {
    log(`[blocked] ${input.vehiclePageUrl} vendor=${vendor} not on allowlist; would send: ${script.availability}`);
    transcript.push({ role: 'agent', text: script.availability, at: now().toISOString(), via: 'planned' });
    mark('not_allowlisted', 'not_allowlisted', 'Not allowlisted: nothing was sent.');
    return finish();
  }

  const adapter = WIDGET_ADAPTERS[vendor];
  const maxTurns = Math.min(MAX_TURNS_CAP, Math.max(1, Math.floor(input.config.maxTurns)));
  const sent = new Set<ScriptId>();
  let turns = 0;
  let lastDealer = '';
  let screenshotFallbacks = 0;

  const send = async (id: ScriptId): Promise<boolean> => {
    if (turns >= maxTurns) {
      mark('turn_limit', 'turn_limit', 'Stopped: turn limit.');
      return false;
    }
    const text = script[id];
    if (!isExactScriptMessage(text, script) || sharesDisallowedContact(text, input.config)) {
      mark('error', 'blocked_unscripted', 'Stopped: refused to send an unscripted message.');
      return false;
    }
    if (sent.size === 0) {
      await input.page.click(adapter.launchSelectors);
      const opened = await input.page.widgetHtml(vendor);
      if ((await input.page.captchaVisible(vendor)) || hasCaptchaChallenge(opened)) {
        mark('captcha', 'captcha', 'Stopped: captcha after opening the widget.');
        return false;
      }
      const openedGate = await openGate(opened);
      if (!openedGate.continueChat) {
        mark(openedGate.status ?? 'unknown', openedGate.stopReason ?? 'prechat', openedGate.note ?? undefined);
        return false;
      }
    }
    const filled = await input.page.fill(adapter.inputSelectors, text);
    if (!filled) {
      mark('contact_form', 'composer_refused', 'Stopped: the composer was missing or looked like a contact field.');
      return false;
    }
    const clicked = await input.page.click(adapter.sendSelectors);
    if (!clicked) {
      const pressed = await input.page.pressEnter(adapter.inputSelectors);
      if (!pressed) {
        error = 'Could not send the chat message.';
        mark('error', 'send_failed');
        return false;
      }
    }
    turns += 1;
    sent.add(id);
    transcript.push({ role: 'agent', text, at: now().toISOString(), via: 'text' });
    log(`[sent] ${text}`);
    return true;
  };

  if (!(await send('availability'))) return finish();

  while (!terminal && turns < maxTurns) {
    const read = await readDealerMessage(input.page, adapter.messageSelectors, lastDealer);
    if (read.kind === 'repeat') {
      mark(statusFromSent(sent), 'no_new_message');
      break;
    }
    if (read.kind === 'screenshot') {
      screenshotFallbacks += 1;
      if (screenshotFallbacks > 2) {
        mark('unknown', 'no_dealer_text', 'Stopped: no dealer text after screenshot fallback.');
        break;
      }
    } else {
      screenshotFallbacks = 0;
      lastDealer = read.text;
      if (!observedReply) {
        const existing = await input.store.currentFirstReply(input.vehiclePageUrl);
        observedReply = existing ?? 'widget';
        if (!existing) await input.store.setFirstReply(input.vehiclePageUrl, 'widget');
      }
    }

    const dealerText = read.kind === 'text' ? read.text : null;
    if (dealerText && hasCaptchaChallenge(dealerText)) {
      transcript.push({ role: 'dealer', text: dealerText, at: now().toISOString(), via: 'text' });
      mark('captcha', 'captcha', 'Stopped: captcha.');
      break;
    }

    let classification: DealerReplyClassification;
    try {
      const raw = await input.ai.complete({
        messages: classificationMessages(script, [...sent], dealerText, read.kind === 'screenshot' ? read.imageBase64 : null),
      });
      classification = parseClassification(raw);
    } catch (aiError) {
      error = aiError instanceof Error ? aiError.message : 'AI classification failed.';
      mark('error', 'ai_error');
      break;
    }
    if (classification.price) price = classification.price;
    transcript.push({
      role: 'dealer',
      text: dealerText ?? '[screenshot]',
      at: now().toISOString(),
      via: read.kind === 'screenshot' ? 'screenshot' : 'text',
    });

    if (await input.page.captchaVisible(vendor)) {
      mark('captcha', 'captcha', 'Stopped: captcha.');
      break;
    }

    const next = resolveNextMessage({ classification, dealerText: dealerText ?? '', sent });
    if (!next) {
      mark(stopStatus(classification.status, dealerText ?? '', sent), classification.status);
      break;
    }
    if (turns >= maxTurns) {
      mark('turn_limit', 'turn_limit', 'Stopped: turn limit.');
      break;
    }
    if (!(await send(next))) break;
    if (next === 'continue_offline') {
      mark('price_given', 'price_given');
      break;
    }
  }

  if (!terminal && turns >= maxTurns) {
    mark('turn_limit', 'turn_limit', 'Stopped: turn limit.');
  }
  return finish();
}

function classificationMessages(
  script: RenderedScript,
  sent: ScriptId[],
  dealerText: string | null,
  imageBase64: string | null,
): { role: 'system' | 'user'; content: string | Array<{ type: 'text'; text: string } | { type: 'image'; imageBase64: string; mediaType: 'image/png' }> }[] {
  const sentLines = sent.map((id) => `${id}: ${script[id]}`).join('\n');
  const instruction = dealerText
    ? `Messages already sent:\n${sentLines || '(none)'}\n\nDealer reply:\n${dealerText}`
    : `Messages already sent:\n${sentLines || '(none)'}\n\nThe dealer reply could not be read as text. Use the screenshot. If it shows a captcha or a form asking for a name, phone, or email, set status to asked_contact and next_message to none.`;
  if (!imageBase64) {
    return [
      { role: 'system', content: CLASSIFY_SYSTEM },
      { role: 'user', content: instruction },
    ];
  }
  return [
    { role: 'system', content: CLASSIFY_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: instruction },
        { type: 'image', imageBase64, mediaType: 'image/png' },
      ],
    },
  ];
}

async function readDealerMessage(
  page: ChatPage,
  selectors: string[],
  lastDealer: string,
): Promise<{ kind: 'text'; text: string } | { kind: 'repeat' } | { kind: 'screenshot'; imageBase64: string }> {
  const text = (await page.readLatestDealerText(selectors))?.trim() ?? '';
  if (text && text === lastDealer) return { kind: 'repeat' };
  if (text) return { kind: 'text', text };
  const shot = await page.screenshot();
  return { kind: 'screenshot', imageBase64: shot.toString('base64') };
}

function stopStatus(status: ReplyStatus, dealerText: string, sent: ReadonlySet<ScriptId>): AttemptStatus {
  if (dealerAskedForShopperContact(dealerText) || status === 'asked_contact') return 'asked_contact';
  if (status === 'sold') return 'sold';
  if (status === 'human_handoff') return 'human_handoff';
  if (status === 'price_given' && sent.has('continue_offline')) return 'price_given';
  if (status === 'available') return 'available';
  if (status === 'price_given') return 'price_given';
  return 'unknown';
}

function statusFromSent(sent: ReadonlySet<ScriptId>): AttemptStatus {
  if (sent.has('continue_offline')) return 'price_given';
  if (sent.has('listing_price')) return 'available';
  return 'unknown';
}
