'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePlatformAdmin } from '@/lib/supabase/platform-admin';

export async function routePlatformLead(formData: FormData) {
  await requirePlatformAdmin();
  const leadId = String(formData.get('leadId') ?? '');
  const dealerId = String(formData.get('dealerId') ?? '');
  if (!leadId || !dealerId) throw new Error('Lead and dealership are required');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const admin = createAdminClient();
  const { data: dealership } = await admin
    .from('dealerships')
    .select('marketcheck_dealer_id')
    .eq('id', dealerId)
    .single();
  if (!dealership?.marketcheck_dealer_id) throw new Error('Dealership is not connected');

  const { error } = await admin
    .from('leads')
    .update({
      dealer_id: dealership.marketcheck_dealer_id,
      routing_status: 'routed',
      routed_at: new Date().toISOString(),
      routed_by: user.id,
    })
    .eq('id', leadId)
    .eq('routing_status', 'platform_inbox');
  if (error) throw new Error(error.message);
  revalidatePath('/app/admin/leads');
}
