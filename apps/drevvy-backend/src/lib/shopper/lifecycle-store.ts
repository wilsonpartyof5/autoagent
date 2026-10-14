import { createAdminClient } from '@/lib/supabase/admin';

import { ShopperDealError } from './deals';
import type {
  BuyPromptSource,
  DealEndState,
  LifecycleRecord,
  OutreachChannel,
} from './lifecycle';

export interface LifecycleRepository {
  source: 'memory' | 'supabase';
  get(consumerUserId: string, dealId: string): Promise<LifecycleRecord | null>;
  getById(dealId: string): Promise<LifecycleRecord | null>;
  listForShopper(consumerUserId: string): Promise<LifecycleRecord[]>;
  listAll(): Promise<LifecycleRecord[]>;
  save(record: LifecycleRecord): Promise<void>;
}

const COLUMNS = [
  'deal_id',
  'consumer_user_id',
  'listing_id',
  'added_at',
  'removed_at',
  'first_outreach_at',
  'first_outreach_channel',
  'replied_at',
  'end_state',
  'ended_at',
  'offer_forwarded_at',
  'dealer_revealed',
  'dealer_latitude',
  'dealer_longitude',
  'visit_radius_meters',
  'expected_pickup_date',
  'location_granted',
  'geofence_exit_at',
  'buy_prompt_sent_at',
  'buy_prompt_source',
  'bought',
  'final_price',
  'outcome_answered_at',
].join(', ');

type LifecycleTableRow = {
  deal_id: string;
  consumer_user_id: string;
  listing_id: string;
  added_at: string;
  removed_at: string | null;
  first_outreach_at: string | null;
  first_outreach_channel: string | null;
  replied_at: string | null;
  end_state: string;
  ended_at: string | null;
  offer_forwarded_at: string | null;
  dealer_revealed: boolean;
  dealer_latitude: number | null;
  dealer_longitude: number | null;
  visit_radius_meters: number | null;
  expected_pickup_date: string | null;
  location_granted: boolean | null;
  geofence_exit_at: string | null;
  buy_prompt_sent_at: string | null;
  buy_prompt_source: string | null;
  bought: boolean | null;
  final_price: number | null;
  outcome_answered_at: string | null;
};

export function createMemoryLifecycleRepository(seed: LifecycleRecord[] = []): LifecycleRepository {
  const records = new Map<string, LifecycleRecord>();
  seed.forEach((record) => records.set(record.dealId, record));
  return {
    source: 'memory',
    async get(consumerUserId, dealId) {
      const record = records.get(dealId);
      if (!record || record.consumerUserId !== consumerUserId) return null;
      return record;
    },
    async getById(dealId) {
      return records.get(dealId) ?? null;
    },
    async listForShopper(consumerUserId) {
      return [...records.values()].filter((record) => record.consumerUserId === consumerUserId);
    },
    async listAll() {
      return [...records.values()];
    },
    async save(record) {
      records.set(record.dealId, record);
    },
  };
}

let memorySingleton: LifecycleRepository | null = null;

export function selectLifecycleRepository(
  env: { DEAL_LIFECYCLE_STORE?: string; [key: string]: string | undefined },
  memory: LifecycleRepository,
  supabase: () => LifecycleRepository,
): LifecycleRepository {
  if (env.DEAL_LIFECYCLE_STORE === 'supabase') return supabase();
  return memory;
}

export function getLifecycleRepository(): LifecycleRepository {
  return selectLifecycleRepository(process.env, memoryRepository(), supabaseLifecycleRepository);
}

export function resetLifecycleMemory(): void {
  memorySingleton = createMemoryLifecycleRepository();
}

function memoryRepository(): LifecycleRepository {
  if (!memorySingleton) memorySingleton = createMemoryLifecycleRepository();
  return memorySingleton;
}

export function supabaseLifecycleRepository(): LifecycleRepository {
  return {
    source: 'supabase',
    async get(consumerUserId, dealId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deal_lifecycle')
        .select(COLUMNS)
        .eq('consumer_user_id', consumerUserId)
        .eq('deal_id', dealId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      return data ? fromRow(data as unknown as LifecycleTableRow) : null;
    },
    async getById(dealId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deal_lifecycle')
        .select(COLUMNS)
        .eq('deal_id', dealId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      return data ? fromRow(data as unknown as LifecycleTableRow) : null;
    },
    async listForShopper(consumerUserId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deal_lifecycle')
        .select(COLUMNS)
        .eq('consumer_user_id', consumerUserId);
      if (error) throw storageError(error.message);
      return (data ?? []).map((row) => fromRow(row as unknown as LifecycleTableRow));
    },
    async listAll() {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deal_lifecycle')
        .select(COLUMNS);
      if (error) throw storageError(error.message);
      return (data ?? []).map((row) => fromRow(row as unknown as LifecycleTableRow));
    },
    async save(record) {
      const admin = createAdminClient();
      const { error } = await admin
        .from('shopper_deal_lifecycle')
        .upsert(toRow(record), { onConflict: 'deal_id' });
      if (error) throw storageError(error.message);
    },
  };
}

function toRow(record: LifecycleRecord): LifecycleTableRow & { updated_at: string } {
  return {
    deal_id: record.dealId,
    consumer_user_id: record.consumerUserId,
    listing_id: record.listingId,
    added_at: record.addedAt,
    removed_at: record.removedAt,
    first_outreach_at: record.outreachSentAt,
    first_outreach_channel: record.outreachChannel,
    replied_at: record.repliedAt,
    end_state: record.endState,
    ended_at: record.endedAt,
    offer_forwarded_at: record.offerForwardedAt,
    dealer_revealed: record.dealerRevealed,
    dealer_latitude: record.dealerLatitude,
    dealer_longitude: record.dealerLongitude,
    visit_radius_meters: record.visitRadiusMeters,
    expected_pickup_date: record.expectedPickupDate,
    location_granted: record.locationGranted,
    geofence_exit_at: record.geofenceExitAt,
    buy_prompt_sent_at: record.buyPromptSentAt,
    buy_prompt_source: record.buyPromptSource,
    bought: record.bought,
    final_price: record.finalPrice,
    outcome_answered_at: record.outcomeAnsweredAt,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: LifecycleTableRow): LifecycleRecord {
  return {
    dealId: row.deal_id,
    consumerUserId: row.consumer_user_id,
    listingId: row.listing_id,
    addedAt: row.added_at,
    removedAt: row.removed_at,
    outreachSentAt: row.first_outreach_at,
    outreachChannel: channel(row.first_outreach_channel),
    repliedAt: row.replied_at,
    endState: endState(row.end_state),
    endedAt: row.ended_at,
    offerForwardedAt: row.offer_forwarded_at,
    dealerRevealed: row.dealer_revealed,
    dealerLatitude: row.dealer_latitude,
    dealerLongitude: row.dealer_longitude,
    visitRadiusMeters: row.visit_radius_meters,
    expectedPickupDate: dateOnly(row.expected_pickup_date),
    locationGranted: row.location_granted,
    geofenceExitAt: row.geofence_exit_at,
    buyPromptSentAt: row.buy_prompt_sent_at,
    buyPromptSource: promptSource(row.buy_prompt_source),
    bought: row.bought,
    finalPrice: row.final_price,
    outcomeAnsweredAt: row.outcome_answered_at,
  };
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function channel(value: string | null): OutreachChannel | null {
  if (value === 'email' || value === 'text' || value === 'call') return value;
  return null;
}

function endState(value: string): DealEndState {
  if (value === 'sold' || value === 'ended_no_response' || value === 'removed' || value === 'dealer_declined') return value;
  return 'open';
}

function promptSource(value: string | null): BuyPromptSource | null {
  if (value === 'geofence_exit' || value === 'pickup_fallback') return value;
  return null;
}

function storageError(message: string): ShopperDealError {
  console.error(JSON.stringify({ event: 'deal_lifecycle_storage_failed', message }));
  return new ShopperDealError('Drevvy could not save this deal.', 500, 'storage_failed');
}
