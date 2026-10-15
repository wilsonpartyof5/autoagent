import { createAdminClient } from '@/lib/supabase/admin';

import { PushError } from './events';
import type { PushLedger } from './triggers';

export function createMemoryPushLedger(): PushLedger {
  const preferences = new Map<string, boolean>();
  const prices = new Map<string, number>();
  const offers = new Map<string, number>();
  return {
    source: 'memory',
    async getPreference(userId) {
      return preferences.has(userId) ? preferences.get(userId) ?? null : null;
    },
    async setPreference(userId, priceDrops) {
      preferences.set(userId, priceDrops);
    },
    async getPrice(dealId) {
      return prices.has(dealId) ? prices.get(dealId) ?? null : null;
    },
    async setPrice(dealId, price) {
      prices.set(dealId, price);
    },
    async getOfferAmount(dealId) {
      return offers.has(dealId) ? offers.get(dealId) ?? null : null;
    },
    async setOfferAmount(dealId, amount) {
      offers.set(dealId, amount);
    },
  };
}

export function selectPushLedger(
  env: { SHOPPER_PUSH_STORE?: string; [key: string]: string | undefined },
  memory: PushLedger,
  supabase: () => PushLedger,
): PushLedger {
  if (env.SHOPPER_PUSH_STORE === 'supabase') return supabase();
  return memory;
}

let memorySingleton: PushLedger | null = null;

export function getPushLedger(): PushLedger {
  return selectPushLedger(process.env, memoryLedger(), supabasePushLedger);
}

export function resetPushLedgerMemory(): void {
  memorySingleton = createMemoryPushLedger();
}

function memoryLedger(): PushLedger {
  if (!memorySingleton) memorySingleton = createMemoryPushLedger();
  return memorySingleton;
}

export function supabasePushLedger(): PushLedger {
  return {
    source: 'supabase',
    async getPreference(userId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_push_preferences')
        .select('price_drops')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      if (!data) return null;
      return (data as { price_drops: boolean }).price_drops;
    },
    async setPreference(userId, priceDrops) {
      const admin = createAdminClient();
      const { error } = await admin.from('shopper_push_preferences').upsert({
        user_id: userId,
        price_drops: priceDrops,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw storageError(error.message);
    },
    async getPrice(dealId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_price_watches')
        .select('price')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      if (!data) return null;
      return Number((data as { price: number }).price);
    },
    async setPrice(dealId, price, meta) {
      const admin = createAdminClient();
      const { error } = await admin.from('shopper_price_watches').upsert({
        deal_id: dealId,
        user_id: meta.userId,
        listing_id: meta.listingId,
        price,
        observed_at: meta.observedAt,
      }, { onConflict: 'deal_id' });
      if (error) throw storageError(error.message);
    },
    async getOfferAmount(dealId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_offer_notices')
        .select('amount')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      if (!data) return null;
      return Number((data as { amount: number }).amount);
    },
    async setOfferAmount(dealId, amount, meta) {
      const admin = createAdminClient();
      const { error } = await admin.from('shopper_offer_notices').upsert({
        deal_id: dealId,
        user_id: meta.userId,
        listing_id: meta.listingId,
        amount,
        notified_at: meta.observedAt,
      }, { onConflict: 'deal_id' });
      if (error) throw storageError(error.message);
    },
  };
}

function storageError(message: string): PushError {
  console.error(JSON.stringify({ event: 'push_ledger_failed', message }));
  return new PushError('Drevvy could not save this notification setting.', 500, 'storage_failed');
}
