/**
 * Dealer-facing voice for Drevvy.
 * Openings are short and do not lead with "I'm an AI".
 * A sincere "are you a bot?" gets the honest sentence, and the agent never denies being an AI.
 */

export const AGENT_OPENER_TEMPLATE = "Hi, this is Drevvy, working for {first}.";

export const CALL_OPENER = `${AGENT_OPENER_TEMPLATE} Quick heads-up, this call is recorded.`;

export function agentOpener(shopperFirst: string): string {
  return `Hi, this is Drevvy, working for ${shopperFirst.trim()}.`;
}

export function aiDisclosure(shopperFirst: string): string {
  return `I'm Drevvy's AI, working for ${shopperFirst.trim()}.`;
}

const AI_ASK_PATTERNS = [
  /\b(?:are you|r u|is this|am i (?:talking|speaking|chatting|texting|emailing) (?:to|with))\b[\s\S]{0,80}\b(?:a |an )?(?:bot|robot|human|real person|person|ai|a\.i\.|artificial intelligence|automated)\b/i,
  /\b(?:you(?:'re| are)|this is)\s+(?:a |an )?(?:bot|robot|ai|a\.i\.|human|real person|automated assistant)\b/i,
  /\b(?:bot or (?:a )?human|human or (?:a )?(?:bot|ai)|ai or (?:a )?(?:human|person)|real (?:person|human) or (?:a )?(?:bot|ai))\b/i,
  /\bare you (?:real|human|ai)\b/i,
];

/** True when a dealer is asking whether this is a bot, AI, or a human. */
export function dealerAskedIfAi(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return AI_ASK_PATTERNS.some((pattern) => pattern.test(text));
}

/** True when the first sentence leads by calling Drevvy an AI or a bot. */
export function leadsWithAiIdentity(draft: string): boolean {
  const first = draft.trim().split(/(?<=[.!?])\s/)[0] ?? '';
  return /\b(?:i'm|i am)\s+(?:an?\s+)?(?:ai|a\.i\.|bot|robot|artificial intelligence|drevvy's ai)\b/i.test(first)
    || /\bthis is (?:an?\s+)?(?:ai|a\.i\.|bot|drevvy's ai|artificial intelligence)\b/i.test(first);
}

/** True when a draft denies being an AI or claims to be a human. */
export function deniesBeingAi(draft: string): boolean {
  return /\b(?:i(?:'m| am)|we(?:'re| are)|this is)\s+not\s+(?:an?\s+)?(?:ai|a\.i\.|bot|robot|artificial)\b/i.test(draft)
    || /\bnot\s+(?:an?\s+)?(?:ai|a\.i\.|bot|robot)\b/i.test(draft)
    || /\bi(?:'m| am)\s+(?:a\s+)?(?:real\s+)?(?:human|person)\b/i.test(draft);
}
