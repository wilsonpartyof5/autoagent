import { createClient } from "./server";

export type InventoryProvider = 'marketcheck' | 'cdk' | 'vauto';
export type PlatformRole = 'dealer_user' | 'platform_admin';

export type DealerProfile = {
  onboardingCompleted: boolean;
  inventoryConnected: boolean;
  billingActive: boolean;
  platformRole: PlatformRole;
  dmsProvider?: InventoryProvider | null;
  marketcheckDealerId?: string | null;
  marketcheckZip?: string | null;
  marketcheckWebsiteUrl?: string | null;
  leadDeliveryMethod?: 'http' | 'email' | null;
  leadDeliveryEndpoint?: string | null;
  leadDeliveryEmail?: string | null;
};

export async function getDealerProfile(): Promise<DealerProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "onboarding_completed, inventory_connected, billing_active, platform_role, dms_provider, marketcheck_dealer_id, marketcheck_zip, marketcheck_website_url, lead_delivery_method, lead_delivery_endpoint, lead_delivery_email",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profiles] failed to load profile", error);
    return {
      onboardingCompleted: false,
      inventoryConnected: false,
      billingActive: false,
      platformRole: 'dealer_user',
    };
  }

  return {
    onboardingCompleted: Boolean(data?.onboarding_completed),
    inventoryConnected: Boolean(data?.inventory_connected),
    billingActive: Boolean(data?.billing_active),
    platformRole: data?.platform_role === 'platform_admin' ? 'platform_admin' : 'dealer_user',
    dmsProvider: data?.dms_provider ?? null,
    marketcheckDealerId: data?.marketcheck_dealer_id ?? null,
    marketcheckZip: data?.marketcheck_zip ?? null,
    marketcheckWebsiteUrl: data?.marketcheck_website_url ?? null,
    leadDeliveryMethod: (data?.lead_delivery_method as 'http' | 'email' | null) ?? null,
    leadDeliveryEndpoint: data?.lead_delivery_endpoint ?? null,
    leadDeliveryEmail: data?.lead_delivery_email ?? null,
  };
}

type UpdateDealerProfileInput = {
  onboardingCompleted?: boolean;
  inventoryConnected?: boolean;
  billingActive?: boolean;
  dmsProvider?: InventoryProvider | null;
  marketcheckDealerId?: string | null;
  marketcheckZip?: string | null;
  marketcheckWebsiteUrl?: string | null;
  leadDeliveryMethod?: 'http' | 'email' | null;
  leadDeliveryEndpoint?: string | null;
  leadDeliveryEmail?: string | null;
};

export async function updateDealerProfile(input: UpdateDealerProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const payload: Record<string, unknown> = {
    id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (input.onboardingCompleted !== undefined) {
    payload["onboarding_completed"] = input.onboardingCompleted;
  }
  if (input.inventoryConnected !== undefined) {
    payload["inventory_connected"] = input.inventoryConnected;
  }
  if (input.billingActive !== undefined) {
    payload["billing_active"] = input.billingActive;
  }
  if (input.dmsProvider !== undefined) {
    payload["dms_provider"] = input.dmsProvider;
  }
  if (input.marketcheckDealerId !== undefined) {
    payload["marketcheck_dealer_id"] = input.marketcheckDealerId;
  }
  if (input.marketcheckZip !== undefined) {
    payload["marketcheck_zip"] = input.marketcheckZip;
  }
  if (input.marketcheckWebsiteUrl !== undefined) {
    payload["marketcheck_website_url"] = input.marketcheckWebsiteUrl;
  }
  if (input.leadDeliveryMethod !== undefined) {
    payload["lead_delivery_method"] = input.leadDeliveryMethod;
  }
  if (input.leadDeliveryEndpoint !== undefined) {
    payload["lead_delivery_endpoint"] = input.leadDeliveryEndpoint;
  }
  if (input.leadDeliveryEmail !== undefined) {
    payload["lead_delivery_email"] = input.leadDeliveryEmail;
  }

  console.log("[profiles] Attempting to update profile:", {
    userId: payload.id,
    fields: Object.keys(payload).filter(key => key !== 'id' && key !== 'updated_at'),
    payload: { ...payload, id: payload.id, updated_at: payload.updated_at },
  });

  const { data, error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
  });

  const dataType = data 
    ? (Array.isArray(data) ? `Array(${(data as unknown[]).length})` : 'Object')
    : null;
    
  console.log("[profiles] Profile update result:", {
    success: !error,
    error: error ? {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    } : null,
    data: dataType,
  });

  if (error) {
    console.error("[profiles] failed to update profile", {
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: (error as any).status,
      },
      payload: {
        id: payload.id,
        fields: Object.keys(payload),
      },
    });
    throw new Error("Unable to update dealer profile. Please try again.");
  }
}
