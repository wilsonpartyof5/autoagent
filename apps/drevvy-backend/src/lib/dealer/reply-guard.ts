/**
 * A dealer retry is the same reply again, before the shopper writes back.
 * It must not add another withhold strike. A later, different reply can.
 */

export function isDuplicateDealerReply(
  messages: readonly { author?: string | null; body: string }[],
  body: string,
  idempotencyKey: string | null | undefined,
  seenKeys: ReadonlySet<string> | null | undefined,
): boolean {
  const key = idempotencyKey?.trim() ?? '';
  if (key && seenKeys?.has(key)) return true;
  const text = body.trim();
  if (!text) return false;
  let lastSales: string | null = null;
  let shopperAfter = false;
  for (const message of messages) {
    if (message.author === 'salesperson') {
      lastSales = message.body;
      shopperAfter = false;
    } else if (message.author === 'shopper') {
      shopperAfter = true;
    }
  }
  return lastSales === text && !shopperAfter;
}
