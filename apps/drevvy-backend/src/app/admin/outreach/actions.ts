'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/admin/guard';
import {
  markUnmatchedReviewed,
  releaseIdentityNumber,
  saveCooldown,
  savePoolNumber,
  saveVoiceNumber,
} from '@/lib/admin/identities';
import { parseSmsOptOutLineForm } from '@/lib/sms/opt-out-line';
import { persistSmsOptOutLineSetting } from '@/lib/sms/settings-admin';

export async function saveSmsOptOutLineSettingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const from = dateField(formData.get('from'));
  const to = dateField(formData.get('to'));
  const parsed = parseSmsOptOutLineForm({
    mode: formData.get('mode'),
    silenceHours: formData.get('silenceHours'),
  });
  if (!parsed.ok) redirect(outreachLocation({ from, to, error: parsed.error }));

  const saved = await persistSmsOptOutLineSetting(parsed.setting, admin.email);
  if (!saved.ok) redirect(outreachLocation({ from, to, error: saved.error }));

  revalidatePath('/admin/outreach');
  redirect(outreachLocation({ from, to, saved: saved.persistence }));
}

export async function addSmsPoolNumber(formData: FormData): Promise<void> {
  await requireAdmin();
  const saved = await savePoolNumber({
    phone: field(formData, 'phone'),
    label: field(formData, 'label'),
    isTest: formData.get('isTest') === '1',
  });
  finish(formData, 'error' in saved ? saved.error : 'Text number added.');
}

export async function addVoiceNumber(formData: FormData): Promise<void> {
  await requireAdmin();
  const saved = await saveVoiceNumber({
    state: field(formData, 'state'),
    phone: field(formData, 'phone'),
    label: field(formData, 'label'),
  });
  finish(formData, 'error' in saved ? saved.error : 'Caller ID saved.');
}

export async function savePoolSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const saved = await saveCooldown({
    cooldownDays: field(formData, 'cooldownDays'),
    watermark: field(formData, 'watermark'),
  });
  finish(formData, 'error' in saved ? saved.error : 'Pool rules saved.');
}

export async function reviewUnmatched(formData: FormData): Promise<void> {
  await requireAdmin();
  await markUnmatchedReviewed(field(formData, 'id'));
  finish(formData, 'Marked reviewed.');
}

export async function releaseConversationNumber(formData: FormData): Promise<void> {
  await requireAdmin();
  const dealId = field(formData, 'dealId');
  const dealerId = field(formData, 'dealerId');
  if (dealId && dealerId) await releaseIdentityNumber(dealId, dealerId);
  finish(formData, 'Text number released for reuse after the cooldown. This conversation keeps the same alias and number.');
}

function dateField(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return value;
}

function outreachLocation(input: { from: string; to: string; saved?: string; error?: string }): string {
  const params = new URLSearchParams();
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  if (input.saved) params.set('smsSetting', input.saved);
  if (input.error) params.set('smsSettingError', input.error.slice(0, 240));
  const query = params.toString();
  return query ? `/admin/outreach?${query}` : '/admin/outreach';
}

function finish(formData: FormData, notice: string): void {
  revalidatePath('/admin/outreach');
  const params = new URLSearchParams();
  params.set('notice', notice.slice(0, 240));
  const from = field(formData, 'from');
  const to = field(formData, 'to');
  const traffic = field(formData, 'traffic');
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (traffic) params.set('traffic', traffic);
  redirect(`/admin/outreach?${params.toString()}`);
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}
