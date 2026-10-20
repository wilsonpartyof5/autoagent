const UNTRUSTED_END = '<<<END UNTRUSTED>>>';

/**
 * Dealer page and chat text is data. Replacing the fence opener stops that
 * text from closing the block and adding its own instructions.
 */
export function fenceUntrusted(label: string, value: string): string {
  const safeLabel = label.replace(/[^a-z0-9_]+/gi, '_').slice(0, 40) || 'data';
  const safe = value.split('<<<').join('‹‹‹');
  return `<<<UNTRUSTED ${safeLabel}>>>\n${safe}\n${UNTRUSTED_END}`;
}
