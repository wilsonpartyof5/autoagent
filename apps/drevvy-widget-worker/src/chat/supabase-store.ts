import type { SupabaseClient } from '@supabase/supabase-js';

import type { AttemptStore, WidgetChatAttemptWrite } from './types';

export function createSupabaseAttemptStore(client: SupabaseClient): AttemptStore {
  return {
    async insert(attempt: WidgetChatAttemptWrite) {
      const { data, error } = await client.from('widget_chat_attempts').insert(attempt).select('id').single();
      if (error) throw new Error(`widget_chat_attempts insert failed: ${error.message}`);
      const row = data as { id?: unknown };
      if (!row || typeof row.id !== 'string') throw new Error('widget_chat_attempts insert did not return an id.');
      return { id: row.id };
    },
  };
}
