export function createRateLimiter(
  minIntervalMs: number,
  sleep: (ms: number) => Promise<void> = delay,
  now: () => number = Date.now,
): () => Promise<void> {
  let nextAt = 0;
  return async () => {
    if (minIntervalMs <= 0) return;
    const wait = Math.max(0, nextAt - now());
    if (wait > 0) await sleep(wait);
    nextAt = now() + minIntervalMs;
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
