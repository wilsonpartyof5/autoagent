export function isOverlayDismiss(label: string, context: string): boolean {
  const text = label.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 40) return false;
  if (/chat|text us|message|gubagoo|carnow|availability|price|question/i.test(text)) return false;
  if (/^(accept all|accept|i agree|agree|allow all|allow cookies|got it|ok)$/i.test(text)) {
    return /cookie|consent|complyauto|onetrust|privacy|gdpr/i.test(`${text} ${context}`) || /^(accept all|i agree|allow all|allow cookies)$/i.test(text);
  }
  if (/trade-?\s?in|value your trade|appraisal/i.test(context) && /^(no thanks|not now|maybe later|close|dismiss|no)$/i.test(text)) {
    return true;
  }
  return false;
}

export function overlayButtons(html: string): Array<{ label: string; context: string }> {
  const found: Array<{ label: string; context: string }> = [];
  for (const match of html.matchAll(/<(button|input)\b([^>]*)>([\s\S]*?)<\/button>|<input\b([^>]*type=["']button["'][^>]*)>/gi)) {
    const attrs = `${match[2] ?? ''} ${match[4] ?? ''}`;
    const label = (match[3] ? visible(match[3]) : '') || attr(attrs, 'value') || attr(attrs, 'aria-label') || '';
    const index = match.index ?? 0;
    const context = visible(html.slice(Math.max(0, index - 500), index + 500));
    if (label) found.push({ label, context });
  }
  return found;
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match?.[1] ?? match?.[2] ?? '';
}

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
