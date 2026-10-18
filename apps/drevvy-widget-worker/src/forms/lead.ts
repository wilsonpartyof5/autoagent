import { isAllowlisted } from '../config';
import type { AttemptResult, AttemptStatus, AttemptStore, ChannelSelection, ChatPage, TranscriptEntry } from '../chat/types';
import { selectionColumns } from '../chat/types';
import { siteUrlFromVehiclePage } from '../research/urls';
import { detectWidgetVendor } from '../widgets/detect';
import { hasCaptchaChallenge } from '../widgets/guards';
import { extractStockNumber } from '../widgets/script';
import { applyPlan } from './apply';
import { detectLeadForms, type ParsedForm } from './detect';
import { blockWallSignature, outreachIdentity, type OutreachRunConfig } from './outreach';
import { describePlan, planForm, type FormPlan } from './plan';

export async function runLeadForm(input: {
  vehiclePageUrl: string;
  stockNumber?: string | null;
  page: ChatPage;
  config: OutreachRunConfig;
  store: AttemptStore;
  now?: () => Date;
  log?: (line: string) => void;
  selection?: ChannelSelection;
}): Promise<AttemptResult> {
  const now = input.now ?? (() => new Date());
  const log = input.log ?? (() => undefined);
  const started = now();
  const transcript: TranscriptEntry[] = [];
  let status: AttemptStatus = 'unknown';
  let stopReason: string | null = null;
  let error: string | null = null;
  let vendor: string | null = null;
  let stock = input.stockNumber?.trim() || null;
  let site: string | null = null;

  const finish = async (): Promise<AttemptResult> => {
    const firstReply = site ? await input.store.currentFirstReply(input.vehiclePageUrl).catch(() => null) : null;
    const result: AttemptResult = {
      id: null,
      vehiclePageUrl: input.vehiclePageUrl,
      dealerSiteUrl: site,
      stockNumber: stock,
      widgetVendor: vendor,
      status,
      price: null,
      dryRun: input.config.dryRun,
      transcript,
      stopReason,
      error,
      channel: 'lead_form',
    };
    try {
      const saved = await input.store.insert({
        vehicle_page_url: input.vehiclePageUrl,
        dealer_site_url: site,
        stock_number: stock,
        widget_vendor: vendor,
        status,
        price: null,
        dry_run: input.config.dryRun,
        transcript,
        stop_reason: stopReason,
        error,
        started_at: started.toISOString(),
        finished_at: now().toISOString(),
        channel: 'lead_form',
        first_reply_channel: firstReply,
        ...selectionColumns(input.selection),
      });
      result.id = saved.id;
    } catch (storeError) {
      result.error = result.error ?? (storeError instanceof Error ? storeError.message : 'Could not save the attempt.');
      result.status = 'error';
    }
    return result;
  };

  const note = (text: string, via: TranscriptEntry['via'] = 'planned'): void => {
    transcript.push({ role: 'system', text, at: now().toISOString(), via });
  };

  try {
    site = siteUrlFromVehiclePage(input.vehiclePageUrl);
  } catch (urlError) {
    status = 'error';
    stopReason = 'invalid_url';
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
      channel: 'lead_form',
    };
  }

  if (await input.store.hasLiveSubmit(input.vehiclePageUrl, 'lead_form')) {
    status = 'already_submitted';
    stopReason = 'already_submitted';
    note('A lead form for this vehicle was already submitted.');
    return finish();
  }

  try {
    await input.page.goto(input.vehiclePageUrl);
  } catch (gotoError) {
    status = 'error';
    stopReason = 'navigation_failed';
    error = gotoError instanceof Error ? gotoError.message : 'Could not open the vehicle page.';
    return finish();
  }

  await input.page.settle();
  await input.page.dismissOverlays();
  const html = await input.page.content();
  vendor = detectWidgetVendor(html);
  if (!stock) stock = extractStockNumber(html);

  const wall = blockWallSignature(html, input.page.httpStatus());
  if (wall) {
    status = 'blocked';
    stopReason = 'blocked';
    note(`Blocked: ${wall}.`);
    log(`[blocked] ${input.vehiclePageUrl} ${wall}`);
    return finish();
  }

  let forms = await readLeadForms(input.page);
  if (forms.length === 0 && (await input.page.clickLeadOpener())) {
    forms = await readLeadForms(input.page);
  }
  const form = forms[0];
  if (!form) {
    status = 'unknown';
    stopReason = 'no_lead_form';
    note('No vehicle lead form found.');
    log(`[lead] ${input.vehiclePageUrl} no lead form`);
    return finish();
  }

  if (hasCaptchaChallenge(html)) {
    status = 'captcha';
    stopReason = 'captcha';
    note('Stopped: captcha.');
    log(`[lead] ${input.vehiclePageUrl} stopped (captcha)`);
    return finish();
  }

  const identity = outreachIdentity(input.config);
  const mode = input.config.contactMode ?? 'full';
  const plan = planForm(form, identity, stock, 'lead_form', mode);
  recordPlan(transcript, plan, now);
  log(`[lead] ${input.vehiclePageUrl} ${describePlan(plan)}`);

  if (plan.stop) {
    const stopped = stoppedStatus(plan.stop);
    status = stopped.status;
    stopReason = stopped.reason;
    note(stopped.note);
    return finish();
  }

  if (input.config.dryRun) {
    status = 'dry_run';
    stopReason = 'dry_run';
    note('Dry run: the lead form was not submitted.');
    return finish();
  }

  if (!isAllowlisted(input.vehiclePageUrl, input.config.allowlist)) {
    status = 'not_allowlisted';
    stopReason = 'not_allowlisted';
    note('Not allowlisted: the lead form was not submitted.');
    return finish();
  }

  const applied = await applyPlan(input.page, plan, identity, stock, 'lead_form', mode);
  if (applied !== 'filled') {
    status = 'error';
    stopReason = applied;
    error = applied === 'fill_failed' ? 'Could not fill an approved lead field.' : 'Could not submit the lead form.';
    return finish();
  }

  status = 'submitted';
  stopReason = 'submitted';
  note('Lead form submitted.', 'text');
  return finish();
}

async function readLeadForms(page: ChatPage): Promise<ParsedForm[]> {
  const [html, frames, shadow] = await Promise.all([page.content(), page.frames(), page.shadowHtml()]);
  return detectLeadForms([html, ...frames.map((frame) => frame.html), shadow].join('\n'));
}

function recordPlan(transcript: TranscriptEntry[], plan: FormPlan, now: () => Date): void {
  for (const fill of plan.fills) {
    transcript.push({ role: 'agent', text: `${fill.kind}: ${fill.value}`, at: now().toISOString(), via: 'planned' });
  }
}

function stoppedStatus(stop: NonNullable<FormPlan['stop']>): { status: AttemptStatus; reason: string; note: string } {
  if (stop === 'captcha') return { status: 'captcha', reason: 'captcha', note: 'Stopped: captcha.' };
  if (stop === 'private_info') return { status: 'private_info', reason: 'private_info', note: 'Stopped: the form asks for private information.' };
  if (stop === 'missing_zip') return { status: 'unknown', reason: 'missing_zip', note: 'Stopped: ZIP is not configured.' };
  return { status: 'unknown', reason: 'unsupported_field', note: 'Stopped: the form has a field this worker cannot fill.' };
}
