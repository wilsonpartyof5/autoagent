import type { SupabaseClient } from '@supabase/supabase-js';

import type { AttemptChannel, AttemptStore, WidgetChatAttemptWrite } from './types';

export function createSupabaseAttemptStore(client: SupabaseClient): AttemptStore {
  return {
    async insert(attempt: WidgetChatAttemptWrite) {
      const { data, error } = await client.from('widget_chat_attempts').insert(attempt).select('id').single();
      if (error) throw new Error(`widget_chat_attempts insert failed: ${error.message}`);
      const row = data as { id?: unknown };
      if (!row || typeof row.id !== 'string') throw new Error('widget_chat_attempts insert did not return an id.');
      return { id: row.id };
    },

    async hasBlockedSite(dealerSiteUrl: string) {
      const { data, error } = await client
        .from('widget_chat_attempts')
        .select('id')
        .eq('dealer_site_url', dealerSiteUrl)
        .eq('status', 'blocked')
        .limit(1);
      if (error) throw new Error(`widget_chat_attempts lookup failed: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },

    async hasLiveSubmit(vehiclePageUrl: string, channel: AttemptChannel) {
      const { data, error } = await client
        .from('widget_chat_attempts')
        .select('id')
        .eq('vehicle_page_url', vehiclePageUrl)
        .eq('channel', channel)
        .eq('dry_run', false)
        .eq('status', 'submitted')
        .limit(1);
      if (error) throw new Error(`widget_chat_attempts lookup failed: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },

    async currentFirstReply(vehiclePageUrl: string) {
      const { data, error } = await client
        .from('widget_chat_attempts')
        .select('first_reply_channel')
        .eq('vehicle_page_url', vehiclePageUrl)
        .not('first_reply_channel', 'is', null)
        .limit(1);
      if (error) throw new Error(`widget_chat_attempts lookup failed: ${error.message}`);
      const row = Array.isArray(data) ? (data[0] as { first_reply_channel?: unknown } | undefined) : undefined;
      const channel = row?.first_reply_channel;
      if (channel === 'widget' || channel === 'lead_form' || channel === 'prechat') return channel;
      return null;
    },

    async setFirstReply(vehiclePageUrl: string, channel: AttemptChannel) {
      const existing = await this.currentFirstReply(vehiclePageUrl);
      if (existing) return;
      const { error } = await client
        .from('widget_chat_attempts')
        .update({ first_reply_channel: channel })
        .eq('vehicle_page_url', vehiclePageUrl)
        .is('first_reply_channel', null);
      if (error) throw new Error(`widget_chat_attempts first reply update failed: ${error.message}`);
    },
  };
}
