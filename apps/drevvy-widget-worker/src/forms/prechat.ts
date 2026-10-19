import { isAllowlisted } from '../config';
import type { AttemptStatus, AttemptStore, ChannelSelection, ChatPage, TranscriptEntry } from '../chat/types';
import { selectionColumns } from '../chat/types';
import { applyPlan } from './apply';
import { detectPrechat } from './detect';
import { outreachIdentity, type OutreachRunConfig } from './outreach';
import { describePlan, planForm, type FormPlan } from './plan';

export type PrechatGateResult = {
  continueChat: boolean;
  status: AttemptStatus | null;
  stopReason: string | null;
  note: string | null;
  filledPhone: string | null;
};

const CONTINUE: PrechatGateResult = { continueChat: true, status: null, stopReason: null, note: null, filledPhone: null };

export async function runPrechatGate(input: {
  vehiclePageUrl: string;
  dealerSiteUrl: string | null;
  stockNumber: string | null;
  widgetVendor: string | null;
  widgetHtml: string;
  page: ChatPage;
  config: OutreachRunConfig;
  store: AttemptStore;
  now: () => Date;
  log: (line: string) => void;
  started: Date;
  selection?: ChannelSelection;
}): Promise<PrechatGateResult> {
  const form = detectPrechat(input.widgetHtml);
  if (!form) return CONTINUE;

  if (await input.store.hasLiveSubmit(input.vehiclePageUrl, 'prechat')) return CONTINUE;

  const identity = outreachIdentity(input.config);
  const plan = planForm(form, identity, input.stockNumber, 'prechat');
  const transcript: TranscriptEntry[] = plan.fills.map((fill) => ({
    role: 'agent' as const,
    text: `${fill.kind}: ${fill.value}`,
    at: input.now().toISOString(),
    via: 'planned' as const,
  }));
  input.log(`[prechat] ${input.vehiclePageUrl} ${describePlan(plan)}`);

  const filledPhone = plan.fills.find((fill) => fill.kind === 'phone')?.value ?? null;
  if (plan.stop) {
    const stopped = stoppedStatus(plan.stop);
    await insertPrechat(input, transcript, stopped.status, stopped.reason, null, stopped.note);
    return { continueChat: false, status: stopped.status, stopReason: stopped.reason, note: stopped.note, filledPhone: null };
  }

  if (input.config.dryRun) {
    await insertPrechat(input, transcript, 'dry_run', 'dry_run', null, 'Dry run: the pre-chat form was not submitted.');
    return CONTINUE;
  }

  if (!isAllowlisted(input.vehiclePageUrl, input.config.allowlist)) {
    await insertPrechat(input, transcript, 'not_allowlisted', 'not_allowlisted', null, 'Not allowlisted: the pre-chat form was not submitted.');
    return CONTINUE;
  }

  const applied = await applyPlan(input.page, plan, identity, input.stockNumber, 'prechat');
  if (applied !== 'filled') {
    const message = applied === 'fill_failed' ? 'Could not fill an approved pre-chat field.' : 'Could not submit the pre-chat form.';
    await insertPrechat(input, transcript, 'error', applied, message, message);
    return { continueChat: false, status: 'error', stopReason: applied, note: message, filledPhone: null };
  }

  await insertPrechat(input, transcript, 'submitted', 'submitted', null, 'Pre-chat form submitted.');
  return { ...CONTINUE, filledPhone };
}

async function insertPrechat(
  input: Parameters<typeof runPrechatGate>[0],
  transcript: TranscriptEntry[],
  status: AttemptStatus,
  stopReason: string,
  error: string | null,
  note: string,
): Promise<void> {
  transcript.push({ role: 'system', text: note, at: input.now().toISOString(), via: status === 'submitted' ? 'text' : 'planned' });
  const firstReply = await input.store.currentFirstReply(input.vehiclePageUrl);
  await input.store.insert({
    vehicle_page_url: input.vehiclePageUrl,
    dealer_site_url: input.dealerSiteUrl,
    stock_number: input.stockNumber,
    widget_vendor: input.widgetVendor,
    status,
    price: null,
    dry_run: input.config.dryRun,
    transcript,
    stop_reason: stopReason,
    error,
    started_at: input.started.toISOString(),
    finished_at: input.now().toISOString(),
    channel: 'prechat',
    first_reply_channel: firstReply,
    ...selectionColumns(input.selection),
  });
}

function stoppedStatus(stop: NonNullable<FormPlan['stop']>): { status: AttemptStatus; reason: string; note: string } {
  if (stop === 'captcha') return { status: 'captcha', reason: 'captcha', note: 'Stopped: captcha.' };
  if (stop === 'private_info') return { status: 'private_info', reason: 'private_info', note: 'Stopped: the form asks for private information.' };
  if (stop === 'missing_zip') return { status: 'unknown', reason: 'missing_zip', note: 'Stopped: ZIP is not configured.' };
  if (stop === 'phone_required') {
    return { status: 'unknown', reason: 'phone_required', note: 'Stopped: the widget requires a phone and DREVVY_CONTACT_PHONE is not set.' };
  }
  return { status: 'unknown', reason: 'unsupported_field', note: 'Stopped: the form has a field this worker cannot fill.' };
}
