export async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1));
  let cursor = 0;
  async function lane(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      await worker(item, index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => lane()));
}
