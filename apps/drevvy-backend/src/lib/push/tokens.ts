import { createAdminClient } from '@/lib/supabase/admin';

import { PushError } from './events';

const TOKEN = /^[A-Za-z0-9_:\-.]{20,4096}$/;

export function readDeviceToken(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PushError('Send the device token.', 400, 'invalid_token');
  }
  const token = (body as Record<string, unknown>).token;
  if (typeof token !== 'string' || !TOKEN.test(token)) {
    throw new PushError('Send the device token from the phone.', 400, 'invalid_token');
  }
  return token;
}

export async function registerDeviceToken(userId: string, token: string, now = new Date()): Promise<void> {
  const admin = createAdminClient();
  const timestamp = now.toISOString();
  const existing = await admin
    .from('device_tokens')
    .select('created_at')
    .eq('token', token)
    .maybeSingle();
  if (existing.error) throw storageError(existing.error.message);

  const createdAt = existing.data?.created_at ?? timestamp;
  if (existing.data) {
    const removed = await admin.from('device_tokens').delete().eq('token', token);
    if (removed.error) throw storageError(removed.error.message);
  }

  const { error } = await admin.from('device_tokens').insert({
    user_id: userId,
    token,
    platform: 'ios',
    created_at: createdAt,
    updated_at: timestamp,
  });
  if (error) throw storageError(error.message);
}

export async function unregisterDeviceToken(userId: string, token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token)
    .select('token');
  if (error) throw storageError(error.message);
  return (data ?? []).length > 0;
}

export async function listDeviceTokens(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId);
  if (error) throw storageError(error.message);
  return (data ?? []).map((row) => String((row as { token: string }).token));
}

function storageError(message: string): PushError {
  console.error(JSON.stringify({ event: 'device_token_storage_failed', message }));
  return new PushError('Drevvy could not save this device.', 500, 'storage_failed');
}
