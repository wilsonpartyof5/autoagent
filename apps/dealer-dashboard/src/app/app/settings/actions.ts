'use server';

import { revalidatePath } from 'next/cache';
import { updateDealerProfile } from '@/lib/supabase/profile';
import { trackEvent } from '@/lib/analytics/tracking';
import { getActiveDealership, updateDealership } from '@/lib/supabase/dealerships';

export async function updateMarketCheckSettings({
  websiteUrl,
}: {
  websiteUrl: string;
}) {
  const normalizedWebsite = normalizeWebsiteUrl(websiteUrl);
  const activeDealership = await getActiveDealership();
  const websiteChanged =
    normalizedWebsite !== (activeDealership?.marketcheckWebsiteUrl ?? null);

  try {
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
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to update MarketCheck settings right now. Please try again.',
    );
  }

  return { success: true };
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
