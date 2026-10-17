'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/admin/guard';
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
