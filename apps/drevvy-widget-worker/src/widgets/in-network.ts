/**
 * In-network desk opener. Same sentence as `inNetworkOpener` in the backend.
 * Widget chat must not send the availability-first script on these rooftops.
 * Zip is omitted: a lead-form zip is not a financing signal.
 */

const FIRST_NAME = /^[A-Za-z][A-Za-z'-]{0,39}$/;

export function widgetShopperFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const first = raw.trim().split(/\s+/)[0] ?? '';
  if (!FIRST_NAME.test(first)) return null;
  if (/[@\d]/.test(first)) return null;
  return first;
}

export function inNetworkDeskOpener(firstName: string | null | undefined): string {
  const who = widgetShopperFirstName(firstName) ?? 'A shopper';
  return `${who} wants your best itemized out-the-door`;
}
