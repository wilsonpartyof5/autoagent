import { randomUUID } from 'node:crypto';

import type { AttemptChannel, AttemptStore, ChannelSelection, WidgetChatAttemptWrite } from './types';

export class MemoryAttemptStore implements AttemptStore {
  readonly attempts: Array<WidgetChatAttemptWrite & { id: string }> = [];

  async insert(attempt: WidgetChatAttemptWrite): Promise<{ id: string }> {
    const id = randomUUID();
    this.attempts.push({ ...attempt, id });
    return { id };
  }

  async annotate(id: string, selection: ChannelSelection): Promise<void> {
    const row = this.attempts.find((attempt) => attempt.id === id);
    if (!row) return;
    row.selected_channels = selection.selected_channels;
    row.channel_reason = selection.channel_reason;
    row.fallback = selection.fallback;
  }

  async hasBlockedSite(dealerSiteUrl: string): Promise<boolean> {
    return this.attempts.some((attempt) => attempt.dealer_site_url === dealerSiteUrl && attempt.status === 'blocked');
  }

  async hasLiveSubmit(vehiclePageUrl: string, channel: AttemptChannel): Promise<boolean> {
    return this.attempts.some(
      (attempt) =>
        attempt.vehicle_page_url === vehiclePageUrl &&
        attempt.channel === channel &&
        attempt.dry_run === false &&
        attempt.status === 'submitted',
    );
  }

  async currentFirstReply(vehiclePageUrl: string): Promise<AttemptChannel | null> {
    return this.attempts.find((attempt) => attempt.vehicle_page_url === vehiclePageUrl && attempt.first_reply_channel)?.first_reply_channel ?? null;
  }

  async setFirstReply(vehiclePageUrl: string, channel: AttemptChannel): Promise<void> {
    const existing = await this.currentFirstReply(vehiclePageUrl);
    if (existing) return;
    for (const attempt of this.attempts) {
      if (attempt.vehicle_page_url === vehiclePageUrl && attempt.first_reply_channel == null) {
        attempt.first_reply_channel = channel;
      }
    }
  }
}
