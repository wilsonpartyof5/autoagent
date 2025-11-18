'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setActiveDealership, createDealership } from '@/lib/supabase/dealerships';

export async function switchDealership(dealershipId: string) {
  try {
    await setActiveDealership(dealershipId);
    revalidatePath('/app');
    revalidatePath('/app/inventory');
    revalidatePath('/app/leads');
    revalidatePath('/app/settings');
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to switch dealership. Please try again.',
    );
  }
}

export async function createDealershipAction(input: {
  name: string;
  marketcheckDealerId?: string | null;
  marketcheckZip?: string | null;
}) {
  try {
    const dealership = await createDealership(input);
    revalidatePath('/app');
    revalidatePath('/app/settings');
    return { success: true, dealershipId: dealership.id };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to create dealership. Please try again.',
    );
  }
}
