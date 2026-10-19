import { isAllowlisted } from '../config';
import type { AttemptResult, AttemptStatus, AttemptStore, ChannelSelection, ChatPage, TranscriptEntry } from '../chat/types';
import { selectionColumns } from '../chat/types';
import type { DirectoryStore } from '../directory/types';
import { siteUrlFromVehiclePage } from '../research/urls';
import { hasCaptchaChallenge } from '../widgets/guards';
import { isTimeoutError } from '../widgets/timeout';
import { extractStockNumber } from '../widgets/script';
import { applyPlan } from './apply';
import { detectLeadForms, type ParsedForm } from './detect';
import { locateLeadForm } from './open';
import { formRequiresPhone, isCheckAvailabilityForm } from './phone';
import { blockWallSignature, outreachIdentity, type LeadContactMode, type OutreachRunConfig } from './outreach';
import { describePlan, planForm, type FormPlan } from './plan';
import { isNoFormStop, shouldMarkCallEmailOnly, NO_FORM_STOPS } from './stops';
import { isHoneypotField, type VendorFormPattern } from './vendor-patterns';

export async function runLeadForm(input: {
  vehiclePageUrl: string;
  stockNumber?: string | null;
  page: ChatPage;
  config: OutreachRunConfig;
  store: AttemptStore;
  directory?: DirectoryStore | null;
  now?: () => Date;
  log?: (line: string) => void;
  selection?: ChannelSelection;
  saveScreenshot?: (bytes: Buffer) => Promise<string | null>;
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
  let opened = false;
  let screenshotUrl: string | null = null;

  const finish = async (): Promise<AttemptResult> => {
    if (opened && input.saveScreenshot && screenshotUrl == null) {
      try {
        screenshotUrl = await input.saveScreenshot(await input.page.screenshot());
      } catch {
        screenshotUrl = null;
      }
    }
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
        screenshot_url: screenshotUrl,
        ...selectionColumns(input.selection),
      });
      result.id = saved.id;
      if (site && isNoFormStop(stopReason)) await rememberNoForm(input.directory, input.store, site, log);
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
    opened = true;
  } catch (gotoError) {
    const timedOut = isTimeoutError(gotoError);
    status = timedOut ? 'page_timeout' : 'error';
    stopReason = timedOut ? 'timeout' : 'navigation_failed';
    error = gotoError instanceof Error ? gotoError.message : 'Could not open the vehicle page.';
    return finish();
  }

  const located = await locateLeadForm(input.page);
  const html = located.html;
  vendor = located.vendor;
  if (!stock) stock = extractStockNumber(html);

  const wall = blockWallSignature(html, input.page.httpStatus());
  if (wall) {
    status = 'blocked';
    stopReason = 'blocked';
    note(`Blocked: ${wall}.`);
    log(`[blocked] ${input.vehiclePageUrl} ${wall}`);
    return finish();
  }

  if (located.stop) {
    status = located.stop === 'captcha' ? 'captcha' : located.stop === 'timeout' ? 'page_timeout' : 'unknown';
    stopReason = located.stop;
    note(located.note ?? located.stop);
    log(`[lead] ${input.vehiclePageUrl} ${located.stop}`);
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
  const forms = detectLeadForms(html);
  const selected = selectLeadSubmission(
    forms.length > 0 ? forms : located.form ? [located.form] : [],
    input.config.contactMode ?? 'full',
    identity.contactPhone,
  );
  const form = selected.form;
  const mode = selected.mode;
  if (!form) {
    status = 'unknown';
    stopReason = mode === 'check_availability' ? 'no_check_availability' : 'form_not_found';
    note(mode === 'check_availability' ? 'No Check Availability form found.' : 'No vehicle lead form found after the page settled.');
    log(`[lead] ${input.vehiclePageUrl} ${stopReason}`);
    return finish();
  }

  const pattern = located.pattern;
  const plannedForm: ParsedForm = {
    ...form,
    buttonText: submitLabel(form, pattern),
    fields: form.fields.filter((field) => !isHoneypotField(pattern, field)),
  };
  const plan = planForm(plannedForm, identity, stock, 'lead_form', mode);
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

function submitLabel(form: ParsedForm, pattern: VendorFormPattern | null): string | null {
  if (pattern && form.html.toLowerCase().includes(pattern.submitButtonText.toLowerCase())) return pattern.submitButtonText;
  return form.buttonText;
}

async function rememberNoForm(
  directory: DirectoryStore | null | undefined,
  store: AttemptStore,
  site: string,
  log: (line: string) => void,
): Promise<void> {
  if (!directory) return;
  try {
    const count = await store.countStopReasons(site, NO_FORM_STOPS);
    if (!shouldMarkCallEmailOnly(count)) return;
    await directory.markCallEmailOnly(site);
    log(`[lead] ${site} call/email only after ${count} no-form failures`);
  } catch (error) {
    log(`[lead] ${site} could not record call/email only: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function recordPlan(transcript: TranscriptEntry[], plan: FormPlan, now: () => Date): void {
  for (const fill of plan.fills) {
    transcript.push({ role: 'agent', text: `${fill.kind}: ${fill.value}`, at: now().toISOString(), via: 'planned' });
  }
}

export function selectLeadSubmission(
  forms: ParsedForm[],
  requested: LeadContactMode,
  contactPhone: string | null,
): { form: ParsedForm | null; mode: LeadContactMode } {
  if (requested === 'check_availability') {
    return { form: forms.find(isCheckAvailabilityForm) ?? null, mode: 'check_availability' };
  }
  const first = forms[0] ?? null;
  if (first && formRequiresPhone(first) && !contactPhone) {
    const check = forms.find(isCheckAvailabilityForm);
    if (check && !formRequiresPhone(check)) return { form: check, mode: 'check_availability' };
  }
  return { form: first, mode: requested };
}

function stoppedStatus(stop: NonNullable<FormPlan['stop']>): { status: AttemptStatus; reason: string; note: string } {
  if (stop === 'captcha') return { status: 'captcha', reason: 'captcha', note: 'Stopped: captcha.' };
  if (stop === 'private_info') return { status: 'private_info', reason: 'private_info', note: 'Stopped: the form asks for private information.' };
  if (stop === 'missing_zip') return { status: 'unknown', reason: 'missing_zip', note: 'Stopped: ZIP is not configured.' };
  if (stop === 'phone_required') {
    return { status: 'unknown', reason: 'phone_required', note: 'Stopped: the form requires a phone and DREVVY_CONTACT_PHONE is not set.' };
  }
  return { status: 'unknown', reason: 'unsupported_field', note: 'Stopped: the form has a field this worker cannot fill.' };
}
