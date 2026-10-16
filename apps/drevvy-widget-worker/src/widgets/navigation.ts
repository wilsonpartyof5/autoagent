export function isDestroyedContext(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /execution context was destroyed|most likely because of a navigation|frame was detached/i.test(message);
}

export async function withNavigationRetry<T>(work: () => Promise<T>, waitForLoad: () => Promise<void>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!isDestroyedContext(error)) throw error;
    await waitForLoad();
    return await work();
  }
}
