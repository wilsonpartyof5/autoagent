import {
  DealerMobileApiError,
  type DealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import type { AuthorizedDealership } from '@/lib/dealer-mobile/dealerships';

export type MobileInventoryVehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  priceCents?: number;
  mileage?: number;
  stockNumber?: string;
  vin?: string;
  imageURL?: string;
  daysOnMarket?: number;
};

export async function listMobileInventory(
  auth: DealerMobileAuth,
  dealership: AuthorizedDealership,
  options: { limit?: number; offset?: number } = {},
): Promise<MobileInventoryVehicle[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = auth.supabase
    .from('uvs_vehicles')
    .select(
      'id, dealership_id, dealer_id, vin, year, make, model, trim, price, miles, stock_number, days_on_market, uvs_data',
    )
    .eq('availability_status', 'available')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = dealership.marketcheckDealerId
    ? query.or(
        `dealership_id.eq.${dealership.id},and(dealership_id.is.null,dealer_id.eq.${dealership.marketcheckDealerId})`,
      )
    : query.eq('dealership_id', dealership.id);

  const { data, error } = await query;
  if (error) {
    console.error('[dealer-mobile] Failed to load inventory:', error);
    throw new DealerMobileApiError(
      'Inventory could not be loaded.',
      500,
      'inventory_unavailable',
    );
  }

  return (data ?? []).map((vehicle: any) => {
    const media =
      vehicle.uvs_data?.media && typeof vehicle.uvs_data.media === 'object'
        ? vehicle.uvs_data.media
        : {};
    const imageURL =
      media.primaryPhotoUrl ??
      media.thumbnailUrl ??
      (Array.isArray(media.photoUrls) ? media.photoUrls[0] : undefined);
    const price = Number(vehicle.price);
    const mileage = Number(vehicle.miles);

    return {
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      ...(vehicle.trim ? { trim: vehicle.trim } : {}),
      ...(Number.isFinite(price) ? { priceCents: Math.round(price * 100) } : {}),
      ...(Number.isFinite(mileage) ? { mileage: Math.round(mileage) } : {}),
      ...(vehicle.stock_number ? { stockNumber: vehicle.stock_number } : {}),
      ...(vehicle.vin ? { vin: vehicle.vin } : {}),
      ...(imageURL ? { imageURL } : {}),
      ...(typeof vehicle.days_on_market === 'number'
        ? { daysOnMarket: vehicle.days_on_market }
        : {}),
    };
  });
}
