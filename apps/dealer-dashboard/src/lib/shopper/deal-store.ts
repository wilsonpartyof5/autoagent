import { createAdminClient } from '@/lib/supabase/admin';

import {
  ShopperDealConflict,
  ShopperDealError,
  type ShopperDealRepository,
  type ShopperDealRow,
} from './deals';

const COLUMNS = 'id, consumer_user_id, listing_id, status, outreach_locked_until_paid, vehicle_snapshot, created_at, updated_at';

type DealTableRow = {
  id: string;
  consumer_user_id: string;
  listing_id: string;
  status: string;
  outreach_locked_until_paid: boolean;
  vehicle_snapshot: unknown;
  created_at: string;
  updated_at: string;
};

export function supabaseShopperDealRepository(): ShopperDealRepository {
  return {
    async findOpen(consumerUserId, listingId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deals')
        .select(COLUMNS)
        .eq('consumer_user_id', consumerUserId)
        .eq('listing_id', listingId)
        .in('status', ['interested', 'negotiating'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw storageError(error.message);
      return data ? toRow(data as DealTableRow) : null;
    },

    async insert(deal) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deals')
        .insert({
          consumer_user_id: deal.consumerUserId,
          listing_id: deal.listingId,
          status: deal.status,
          outreach_locked_until_paid: true,
          vehicle_snapshot: deal.vehicle,
        })
        .select(COLUMNS)
        .single();
      if (error) {
        if (error.code === '23505') throw new ShopperDealConflict();
        throw storageError(error.message);
      }
      return toRow(data as DealTableRow);
    },

    async list(consumerUserId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deals')
        .select(COLUMNS)
        .eq('consumer_user_id', consumerUserId)
        .order('created_at', { ascending: false });
      if (error) throw storageError(error.message);
      return (data ?? []).map((row) => toRow(row as DealTableRow));
    },

    async get(consumerUserId, dealId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('shopper_deals')
        .select(COLUMNS)
        .eq('consumer_user_id', consumerUserId)
        .eq('id', dealId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      return data ? toRow(data as DealTableRow) : null;
    },
  };
}

function toRow(row: DealTableRow): ShopperDealRow {
  return {
    id: row.id,
    consumerUserId: row.consumer_user_id,
    listingId: row.listing_id,
    status: row.status,
    outreachLockedUntilPaid: row.outreach_locked_until_paid,
    vehicle: row.vehicle_snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function storageError(message: string): ShopperDealError {
  console.error(JSON.stringify({ event: 'shopper_deal_storage_failed', message }));
  return new ShopperDealError('Drevvy could not save this deal.', 500, 'storage_failed');
}
