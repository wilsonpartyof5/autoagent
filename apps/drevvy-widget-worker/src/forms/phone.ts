import { normalizePhone } from '../research/validate';
import { detectPrechat, type ParsedForm } from './detect';
import { extractWidgetScope, type WidgetVendor } from '../widgets/vendors';

/**
 * Phone typed into a dealer widget or lead form.
 * This is Drevvy's Telnyx number from DREVVY_CONTACT_PHONE.
 * The shopper's phone is never a candidate.
 */
export function resolveFormPhone(
  configured: string | null | undefined,
  shopperPhone?: string | null,
): string | null {
  const formatted = formatUsPhone(configured);
  if (!formatted) return null;
  const shopper = shopperPhone ? normalizePhone(shopperPhone) : null;
  if (shopper && shopper === normalizePhone(formatted)) return null;
  return formatted;
}

export function formatUsPhone(value: string | null | undefined): string | null {
  const e164 = normalizePhone(value ?? '');
  if (!e164) return null;
  const national = e164.slice(2);
  if (national.length !== 10) return null;
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}

export function formRequiresPhone(form: ParsedForm): boolean {
  return form.fields.some((field) => field.kind === 'phone' && field.required);
}

export function isCheckAvailabilityForm(form: ParsedForm): boolean {
  return /check availability/i.test(`${form.title} ${form.buttonText ?? ''}`);
}

/** A chat widget whose pre-chat gate cannot continue without a phone. */
export function widgetRequiresPhone(html: string, vendor: WidgetVendor | null): boolean {
  const scope = vendor ? extractWidgetScope(html, vendor) || html : html;
  const form = detectPrechat(scope);
  return form ? formRequiresPhone(form) : false;
}
