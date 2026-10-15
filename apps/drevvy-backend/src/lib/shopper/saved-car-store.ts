import { createAdminClient } from '@/lib/supabase/admin';

import { ShopperDealError } from './deals';
import {
  savedCarColumns,
  type SavedCarRepository,
  type SavedCarRow,
} from './saved-cars';

const COLUMNS = 'user_id, listing_id, vin, saved_at, moved_to_deal_id';

type SavedCarTableRow = {
  user_id: string;
  listing_id: string;
  vin: string | null;
  saved_at: string;
  moved_to_deal_id: string | null;
};

export function supabaseSavedCarRepository(): SavedCarRepository {
  return {
    async list(userId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('saved_cars')
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });
      if (error) throw storageError(error.message);
      return (data ?? []).map((row) => toRow(row as SavedCarTableRow));
    },

    async find(userId, listingId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('saved_cars')
        .select(COLUMNS)
        .eq('user_id', userId)
        .eq('listing_id', listingId)
        .maybeSingle();
      if (error) throw storageError(error.message);
      return data ? toRow(data as SavedCarTableRow) : null;
    },

    async save(row) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('saved_cars')
        .upsert(savedCarColumns(row), { onConflict: 'user_id,listing_id' })
        .select(COLUMNS)
        .single();
      if (error) throw storageError(error.message);
      return toRow(data as SavedCarTableRow);
    },

    async remove(userId, listingId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('saved_cars')
        .delete()
        .eq('user_id', userId)
        .eq('listing_id', listingId)
        .select('listing_id');
      if (error) throw storageError(error.message);
      return (data ?? []).length > 0;
    },
  };
}

export async function shopperOwnsDeal(userId: string, dealId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('shopper_deals')
    .select('id')
    .eq('id', dealId)
    .eq('consumer_user_id', userId)
    .maybeSingle();
  if (error) throw storageError(error.message);
  return Boolean(data);
}

function toRow(row: SavedCarTableRow): SavedCarRow {
  return {
    userId: row.user_id,
    listingId: row.listing_id,
    vin: row.vin,
    savedAt: row.saved_at,
    movedToDealId: row.moved_to_deal_id,
  };
}

function storageError(message: string): ShopperDealError {
  console.error(JSON.stringify({ event: 'saved_car_storage_failed', message }));
  return new ShopperDealError('Drevvy could not save this car.', 500, 'storage_failed');
}
