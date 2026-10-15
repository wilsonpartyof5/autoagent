'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { parsePlatformBill, type BillFields } from '@/lib/admin/costs';
import { requireAdmin } from '@/lib/admin/guard';
import { insertPlatformBill, PlatformBillSaveError, safeBillError } from '@/lib/admin/platform-bills';

export async function savePlatformBill(formData: FormData): Promise<void> {
  await requireAdmin();
  const fields: BillFields = {
    service: field(formData, 'service'),
    month: field(formData, 'month'),
    amount: field(formData, 'amount'),
    note: field(formData, 'note'),
  };
  const parsed = parsePlatformBill(fields);
  if (!parsed.ok) redirect(costsLocation({ error: parsed.error, fields: parsed.fields }));

  try {
    await insertPlatformBill(parsed.bill);
  } catch (error) {
    const message = error instanceof PlatformBillSaveError
      ? error.message
      : safeBillError(error instanceof Error ? error.message : '');
    redirect(costsLocation({ error: message, fields: parsed.fields }));
  }

  revalidatePath('/admin/costs');
  redirect('/admin/costs?saved=1');
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function costsLocation(input: { error: string; fields: BillFields }): string {
  const params = new URLSearchParams();
  params.set('error', input.error.slice(0, 240));
  if (input.fields.service) params.set('service', input.fields.service.slice(0, 80));
  if (input.fields.month) params.set('month', input.fields.month.slice(0, 7));
  if (input.fields.amount) params.set('amount', input.fields.amount.slice(0, 16));
  if (input.fields.note) params.set('note', input.fields.note.slice(0, 500));
  return `/admin/costs?${params.toString()}`;
}
