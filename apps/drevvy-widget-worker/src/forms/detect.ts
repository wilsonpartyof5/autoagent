import { hasCaptchaChallenge } from '../widgets/guards';
import { isPrivateFieldHint, type OutreachFieldKind } from './outreach';

export type ParsedField = {
  kind: OutreachFieldKind | 'private' | 'unknown';
  name: string | null;
  id: string | null;
  type: string | null;
  required: boolean;
  label: string;
};

export type ParsedForm = {
  id: string | null;
  title: string;
  buttonText: string | null;
  fields: ParsedField[];
  html: string;
};

const LEAD_CTA =
  /ask a question|check availability|confirm availability|get today'?s price|unlock(?:\s+\S+){0,4}\s+price|out the door price|today'?s price|get e-?price|request (?:more )?info|email us|contact (?:the )?dealer|get a quote|check current price|instant price/i;

/** Ordered. A lower index wins when several vehicle-page controls are visible. */
export const LEAD_OPENER_PATTERNS = [
  'check availability',
  'ask a question',
  'confirm availability',
  "get today'?s price|today'?s price|get e-?price|instant price|check current price",
  'unlock\\s+\\S+(?:\\s+\\S+){0,3}\\s+price|out the door price',
  'request (?:more )?info|email us|contact (?:the )?dealer|get a quote',
] as const;

const VEHICLE_LEAD_MARK = /lead-form|contactform|e-price-lead/i;

const WIDGET_BLOCK =
  /<div\b[^>]*(?:gubagoo|gg-chat|podium-bubble|podium-website-widget|ae-chat|cn-chat|kenect-widget|cao-widget|als-widget|impel-chat|matador-chat)[^>]*>[\s\S]*?<\/div>/gi;

export function detectLeadForms(html: string): ParsedForm[] {
  const withoutWidgets = html.replace(WIDGET_BLOCK, ' ');
  return formsIn(withoutWidgets).filter((form) => isVehicleLeadForm(form));
}

export function leadOpenerRank(text: string): number | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 40) return null;
  const index = LEAD_OPENER_PATTERNS.findIndex((source) => new RegExp(source, 'i').test(cleaned));
  return index === -1 ? null : index;
}

/** Label of a vehicle-page control that reveals a lead form. Submit buttons inside a form are ignored. */
export function findLeadOpener(html: string): string | null {
  const withoutForms = html.replace(/<form\b[\s\S]*?<\/form>/gi, ' ');
  let best: { rank: number; text: string } | null = null;
  for (const match of withoutForms.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = visible(match[2] ?? '');
    const rank = leadOpenerRank(text);
    if (rank == null) continue;
    if (!best || rank < best.rank) best = { rank, text };
  }
  return best?.text ?? null;
}

function isVehicleLeadForm(form: ParsedForm): boolean {
  if (LEAD_CTA.test(`${form.title} ${form.buttonText ?? ''}`)) return true;
  const open = form.html.match(/^<form\b([^>]*)>/i)?.[1] ?? '';
  if (!VEHICLE_LEAD_MARK.test(`${open} ${form.id ?? ''}`)) return false;
  const kinds = new Set(form.fields.map((field) => field.kind));
  const identity = kinds.has('first_name') || kinds.has('last_name') || kinds.has('full_name');
  const reach = kinds.has('phone') || kinds.has('email');
  return identity && reach;
}

export function detectPrechat(widgetHtml: string): ParsedForm | null {
  const forms = formsIn(widgetHtml).filter((form) => {
    const kinds = new Set(form.fields.map((field) => field.kind));
    const hasIdentity = kinds.has('first_name') || kinds.has('last_name') || kinds.has('full_name');
    const hasReach = kinds.has('phone') || kinds.has('email');
    return hasIdentity && hasReach;
  });
  return forms[0] ?? null;
}

export function formHasCaptcha(form: ParsedForm): boolean {
  return hasCaptchaChallenge(form.html);
}

export function formRequiresPrivateInfo(form: ParsedForm): boolean {
  return form.fields.some((field) => field.kind === 'private');
}

function formsIn(html: string): ParsedForm[] {
  const matches = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  return matches.map((formHtml) => parseForm(formHtml));
}

function parseForm(formHtml: string): ParsedForm {
  const open = formHtml.match(/^<form\b([^>]*)>/i)?.[1] ?? '';
  const heading = visible(formHtml.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] ?? '');
  const legend = visible(formHtml.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i)?.[1] ?? '');
  const buttonInner = formHtml.match(/<button\b[^>]*>([\s\S]*?)<\/button>/i)?.[1] ?? '';
  const buttonText = visible(buttonInner) || attr(formHtml.match(/<input\b[^>]*type=["']submit["'][^>]*>/i)?.[0] ?? '', 'value');
  return {
    id: attr(open, 'id'),
    title: heading || legend || buttonText || '',
    buttonText,
    fields: parseFields(formHtml),
    html: formHtml,
  };
}

function parseFields(formHtml: string): ParsedField[] {
  const labels = new Map<string, string>();
  for (const match of formHtml.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const forId = attr(match[1] ?? '', 'for');
    if (forId) labels.set(forId, visible(match[2] ?? ''));
  }
  const fields: ParsedField[] = [];
  const seen = new Set<string>();
  for (const match of formHtml.matchAll(/<(input|textarea)\b([^>]*)>/gi)) {
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = match[2] ?? '';
    const type = (attr(attrs, 'type') ?? (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'image'].includes(type)) continue;
    const id = attr(attrs, 'id');
    const name = attr(attrs, 'name');
    const className = attr(attrs, 'class') ?? '';
    if (/\bhoneypot\b/i.test(`${name ?? ''} ${id ?? ''} ${className}`)) continue;
    const key = `${name ?? ''}|${id ?? ''}|${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = (id && labels.get(id)) || '';
    fields.push({
      kind: classifyField({ tag, type, name, id, label, placeholder: attr(attrs, 'placeholder') }),
      name,
      id,
      type,
      required: /\brequired\b/i.test(attrs) || /aria-required=["']true["']/i.test(attrs),
      label,
    });
  }
  return fields;
}

function classifyField(input: {
  tag: string;
  type: string;
  name: string | null;
  id: string | null;
  label: string;
  placeholder: string | null;
}): ParsedField['kind'] {
  const blob = [input.type, input.name, input.id, input.label, input.placeholder].filter(Boolean).join(' ');
  if (isPrivateFieldHint(blob)) return 'private';
  if (/zip|postal/i.test(blob)) return 'zip';
  if (input.type === 'email' || /e-?mail/i.test(blob)) return 'email';
  if (input.type === 'tel' || /mobile|phone/i.test(blob)) return 'phone';
  if (input.tag === 'textarea' || input.type === 'textarea' || /message|comment|question/i.test(blob)) return 'message';
  if (/last[_\s-]?name|lname|surname/i.test(blob)) return 'last_name';
  if (/first[_\s-]?name|fname|given[_\s-]?name/i.test(blob)) return 'first_name';
  if (/full[_\s-]?name|your[_\s-]?name|contact[_\s-]?name|customer[_\s-]?name|(?:^|\s)name(?:\s|$)|name=["']name["']/i.test(blob)) {
    return 'full_name';
  }
  return 'unknown';
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? value : null;
}

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
