/**
 * How a dealer's lead form becomes visible.
 * Matador is the first entry. Add another vendor by appending a pattern.
 * The runner never fills a honeypot and never clicks submit during a dry run.
 */

export type FormOpenMode = 'settle_then_click';

export type HoneypotHandling = 'leave_blank';

export type VendorFormPattern = {
  vendor: string;
  /** The form is not in the first HTML paint. Wait, then click the opener. */
  open: FormOpenMode;
  openerSelectors: string[];
  /** Visible label on the button that reveals the form. */
  openerText: RegExp;
  formSelectors: string[];
  /** Button the worker may click only when a live send is allowed. */
  submitButtonText: string;
  /** Lead form iframe. Unreadable contents stop as iframe_blocked. */
  frameUrl: RegExp | null;
  honeypot: {
    handling: HoneypotHandling;
    selectors: string[];
    namePattern: RegExp;
  };
};

export const VENDOR_FORM_PATTERNS: readonly VendorFormPattern[] = [
  {
    vendor: 'matador',
    open: 'settle_then_click',
    openerSelectors: [
      '[data-matador="check-availability"]',
      '[data-matador="ask-question"]',
      'button.matador-check-availability',
      'a.matador-ask-question',
      '#matador-lead-opener',
    ],
    openerText: /check availability|ask a question/i,
    formSelectors: [
      'form.matador-lead',
      'form[data-matador-form]',
      '#matador-lead-form',
      '.matador-modal form',
    ],
    submitButtonText: 'Send',
    frameUrl: /matador\.ai/i,
    honeypot: {
      handling: 'leave_blank',
      selectors: [
        'input[name="website"]',
        'input[name="company_website"]',
        'input[name="honeypot"]',
        'input.matador-hp',
        '.matador-honeypot input',
      ],
      namePattern: /website|company_website|honeypot|\bhp_|leaveblank|leave_blank/i,
    },
  },
];

export function patternForVendor(vendor: string | null | undefined): VendorFormPattern | null {
  if (!vendor) return null;
  const key = vendor.trim().toLowerCase();
  return VENDOR_FORM_PATTERNS.find((pattern) => pattern.vendor === key) ?? null;
}

export function isHoneypotField(
  pattern: VendorFormPattern | null,
  field: { name: string | null; id: string | null; label: string },
): boolean {
  if (!pattern || pattern.honeypot.handling !== 'leave_blank') return false;
  const blob = [field.name, field.id, field.label].filter(Boolean).join(' ');
  if (pattern.honeypot.namePattern.test(blob)) return true;
  const token = (field.name ?? field.id ?? '').toLowerCase();
  if (!token) return false;
  return pattern.honeypot.selectors.some((selector) => selectorNames(selector).includes(token));
}

function selectorNames(selector: string): string[] {
  return [...selector.toLowerCase().matchAll(/\bname\s*=\s*["']([^"']+)["']/g)].map((match) => match[1] ?? '');
}
