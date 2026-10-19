import { createAdminClient } from '@/lib/supabase/admin';

export type CallEmailDealer = {
  siteUrl: string;
  name: string | null;
  widgetVendor: string | null;
};

export function presentCallEmailDealers(
  rows: Array<{ site_url?: unknown; name?: unknown; widget_vendor?: unknown; call_email_only?: unknown }>,
): CallEmailDealer[] {
  return rows
    .filter((row) => row.call_email_only === true && typeof row.site_url === 'string' && row.site_url.length > 0)
    .map((row) => ({
      siteUrl: row.site_url as string,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
      widgetVendor: typeof row.widget_vendor === 'string' && row.widget_vendor.trim() ? row.widget_vendor.trim() : null,
    }))
    .sort((left, right) => (left.name ?? left.siteUrl).localeCompare(right.name ?? right.siteUrl));
}

export async function loadCallEmailOnlyDealers(): Promise<{ configured: boolean; dealers: CallEmailDealer[] }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { configured: false, dealers: [] };
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('dealer_directory')
      .select('site_url, name, widget_vendor, call_email_only')
      .eq('call_email_only', true)
      .limit(200);
    if (error) return { configured: true, dealers: [] };
    return { configured: true, dealers: presentCallEmailDealers((data ?? []) as Array<{ site_url?: unknown; name?: unknown; widget_vendor?: unknown; call_email_only?: unknown }>) };
  } catch {
    return { configured: true, dealers: [] };
  }
}
