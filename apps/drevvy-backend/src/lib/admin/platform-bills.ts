import { createAdminClient } from '@/lib/supabase/admin';

import type { NewPlatformBill } from './costs';

export type PlatformBill = {
  id: string;
  service: string;
  month: string;
  amountUsd: number;
  note: string;
  createdAt: string;
};

export class PlatformBillSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformBillSaveError';
  }
}

type BillRow = {
  id: number | string;
  service: string;
  billed_month: string;
  amount_usd: number | string;
  note: string | null;
  created_at: string;
};

export function safeBillError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('platform_bills') || lower.includes('schema cache') || lower.includes('does not exist')) {
    return 'The bill was not saved. Apply the platform_bills migration before recording costs.';
  }
  if (lower.includes('not configured') || lower.includes('service_role') || lower.includes('supabase')) {
    return 'Supabase is not configured, so the bill was not saved.';
  }
  return 'The bill was not saved.';
}

export async function listPlatformBills(): Promise<{ bills: PlatformBill[]; unavailable: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { bills: [], unavailable: 'Supabase is not configured, so saved bills cannot be loaded.' };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('platform_bills')
      .select('id, service, billed_month, amount_usd, note, created_at')
      .order('billed_month', { ascending: false })
      .order('id', { ascending: false })
      .limit(500);
    if (error) return { bills: [], unavailable: listBillError(error.message) };
    return { bills: (data ?? []).map((row) => toBill(row as BillRow)), unavailable: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Saved bills could not be loaded.';
    return { bills: [], unavailable: listBillError(message) };
  }
}

export async function insertPlatformBill(bill: NewPlatformBill): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new PlatformBillSaveError('Supabase is not configured, so the bill was not saved.');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('platform_bills').insert({
    service: bill.service,
    billed_month: `${bill.month}-01`,
    amount_usd: bill.amountUsd,
    note: bill.note,
  });
  if (error) throw new PlatformBillSaveError(safeBillError(error.message));
}

function listBillError(message: string): string {
  const saved = safeBillError(message);
  if (saved.startsWith('The bill was not saved. ')) {
    return saved.slice('The bill was not saved. '.length);
  }
  if (saved === 'Supabase is not configured, so the bill was not saved.') {
    return 'Supabase is not configured, so saved bills cannot be loaded.';
  }
  return 'Saved bills could not be loaded.';
}

function toBill(row: BillRow): PlatformBill {
  const amount = typeof row.amount_usd === 'number' ? row.amount_usd : Number(row.amount_usd);
  return {
    id: String(row.id),
    service: row.service,
    month: String(row.billed_month).slice(0, 7),
    amountUsd: Number.isFinite(amount) ? amount : 0,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}
