'use server';

import { revalidatePath } from 'next/cache';
import { updateDealerProfile } from '@/lib/supabase/profile';

export async function updateMarketCheckSettings({
  dealerId,
  zip,
}: {
  dealerId: string;
  zip?: string;
}) {
  if (!dealerId.trim()) {
    throw new Error('Dealer ID is required.');
  }

  try {
    await updateDealerProfile({
      dmsProvider: 'marketcheck',
      marketcheckDealerId: dealerId.trim(),
      marketcheckZip: zip?.trim() || null,
      inventoryConnected: false,
    });

    revalidatePath('/app/settings');
    revalidatePath('/app/inventory');
    revalidatePath('/app/setup');
    revalidatePath('/app/leads');
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to update MarketCheck settings right now. Please try again.',
    );
  }

  return { success: true };
}

export async function updateLeadDeliverySettings({
  method,
  endpoint,
  email,
}: {
  method: 'http' | 'email' | null;
  endpoint?: string | null;
  email?: string | null;
}) {
  try {
    await updateDealerProfile({
      leadDeliveryMethod: method,
      leadDeliveryEndpoint: endpoint || null,
      leadDeliveryEmail: email || null,
    });

    revalidatePath('/app/settings');
    revalidatePath('/app/leads');
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to update lead delivery settings right now. Please try again.',
    );
  }

  return { success: true };
}
