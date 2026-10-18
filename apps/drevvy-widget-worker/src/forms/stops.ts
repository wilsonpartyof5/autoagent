/** Stop reasons that replace a vague "no lead form" result. */
export const LEAD_FORM_STOPS = [
  'form_not_found',
  'opener_not_found',
  'captcha',
  'iframe_blocked',
  'timeout',
  'unsupported_vendor',
] as const;

export type LeadFormStop = (typeof LEAD_FORM_STOPS)[number];

/**
 * Failures that mean this dealer site has no usable lead form.
 * Captcha and timeout can clear, so they do not flip the dealer flag.
 */
export const NO_FORM_STOPS = ['form_not_found', 'opener_not_found', 'iframe_blocked', 'unsupported_vendor'] as const;

export type NoFormStop = (typeof NO_FORM_STOPS)[number];

/** How many no-form failures on one dealer site mark it call/email only. */
export const CALL_EMAIL_ONLY_AFTER = 3;

export function isLeadFormStop(reason: string | null | undefined): reason is LeadFormStop {
  return LEAD_FORM_STOPS.includes(reason as LeadFormStop);
}

export function isNoFormStop(reason: string | null | undefined): reason is NoFormStop {
  return NO_FORM_STOPS.includes(reason as NoFormStop);
}

export function shouldMarkCallEmailOnly(noFormCount: number): boolean {
  return noFormCount >= CALL_EMAIL_ONLY_AFTER;
}

export function leadStopNote(reason: LeadFormStop): string {
  if (reason === 'form_not_found') return 'No vehicle lead form found after the page settled.';
  if (reason === 'opener_not_found') return 'The Check Availability or Ask a Question opener was not on the page.';
  if (reason === 'captcha') return 'Stopped: captcha.';
  if (reason === 'iframe_blocked') return 'The lead form frame could not be read.';
  if (reason === 'timeout') return 'Stopped: the page timed out.';
  return 'This widget vendor has no lead-form pattern.';
}
