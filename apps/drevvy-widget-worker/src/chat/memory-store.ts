import { randomUUID } from 'node:crypto';

import type { AttemptStore, WidgetChatAttemptWrite } from './types';

export class MemoryAttemptStore implements AttemptStore {
  readonly attempts: Array<WidgetChatAttemptWrite & { id: string }> = [];

  async insert(attempt: WidgetChatAttemptWrite): Promise<{ id: string }> {
    const id = randomUUID();
    this.attempts.push({ ...attempt, id });
    return { id };
  }
}
