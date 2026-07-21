'use server';

import { revalidatePath } from 'next/cache';
import { updateDealerProfile } from '@/lib/supabase/profile';
import { trackEvent } from '@/lib/analytics/tracking';
import {
  createDealership,
  fetchUserDealerships,
  getActiveDealership,
  updateDealership,
} from '@/lib/supabase/dealerships';
import { resyncInventory } from '@/app/app/setup/actions';

export async function updateMarketCheckSettings({
  websiteUrl,
  dealershipId,
}: {
  websiteUrl: string;
  dealershipId?: string;
}) {
  const normalizedWebsite = normalizeWebsiteUrl(websiteUrl);
  let activeDealership = dealershipId
    ? (await fetchUserDealerships()).find((dealership) => dealership.id === dealershipId) ?? null
    : await getActiveDealership();

  if (dealershipId && !activeDealership) {
    throw new Error('You do not have access to the selected dealership.');
  }
  const websiteChanged =
    normalizedWebsite !== (activeDealership?.marketcheckWebsiteUrl ?? null);

  try {
    // If no dealership exists, create one so we can sync and show in "Your Stores"
    if (!activeDealership) {
      activeDealership = await createDealership({
        name: normalizedWebsite,
        marketcheckWebsiteUrl: normalizedWebsite,
      });
    }

    await updateDealerProfile({
      dmsProvider: 'marketcheck',
      marketcheckWebsiteUrl: normalizedWebsite,
      ...(websiteChanged ? { marketcheckDealerId: null } : {}),
      inventoryConnected: false,
    });
    
    if (activeDealership) {
      updateDealership(activeDealership.id, {
        marketcheckWebsiteUrl: normalizedWebsite,
        ...(websiteChanged ? { marketcheckDealerId: null } : {}),
      }).catch(() => {
        // Non-blocking update; fall back to profile value if dealership update fails
      });
    }

    // Track settings update
    trackEvent(
      'dashboard.settings.update',
      {
        settingsCategory: 'inventory_provider',
        fieldsChanged: ['dmsProvider', 'marketcheckWebsiteUrl'],
      },
      {
        dealerId: activeDealership?.marketcheckDealerId || undefined,
      },
    ).catch(() => {
      // Tracking failures should not break the request
    });

    revalidatePath('/app/settings');
    revalidatePath('/app/inventory');
    revalidatePath('/app/setup');
    revalidatePath('/app/leads');

    // Kick off an auto-sync after saving settings
    let syncResult:
      | { status: 'synced'; fetched: number; imported: number }
      | { status: 'no_match'; fetched: number; imported: number; message?: string }
      | null = null;

    try {
      const result = await resyncInventory(activeDealership?.id);
      if (result?.status === 'no_match') {
        syncResult = {
          status: 'no_match',
          fetched: result.fetched ?? 0,
          imported: result.imported ?? 0,
          message:
            result.message ||
            'We requested MarketCheck to map your website. Please try again in 24-48 hours.',
        };
      } else {
        syncResult = {
          status: 'synced',
          fetched: result?.fetched ?? 0,
          imported: result?.imported ?? 0,
        };
      }
    } catch (syncError) {
      console.error('[settings] MarketCheck auto-sync after save failed:', syncError);
    }

    return { success: true, syncResult };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to update MarketCheck settings right now. Please try again.',
    );
  }
}

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Dealership website URL is required.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;

  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Enter a valid dealership website URL (e.g., https://exampledealer.com).');
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new Error('Enter a valid dealership website URL (e.g., https://exampledealer.com).');
  }

  const hostname = parsed.hostname.startsWith('www.') ? parsed.hostname.slice(4) : parsed.hostname;
  return hostname.toLowerCase();
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

    // Track settings update
    const activeDealership = await getActiveDealership();
    trackEvent('dashboard.settings.update', {
      settingsCategory: 'lead_delivery',
      fieldsChanged: ['leadDeliveryMethod', 'leadDeliveryEndpoint', 'leadDeliveryEmail'],
    }, {
      dealerId: activeDealership?.marketcheckDealerId || undefined,
    }).catch(() => {
      // Tracking failures should not break the request
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
