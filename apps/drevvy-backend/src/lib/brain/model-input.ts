/**
 * Text sent to the model. Shopper phone, email, and last name are left out
 * and scrubbed if they show up in the dealer message or a lesson.
 */

import type { RouteDecision } from './routing';

export type ModelUserInput = {
  channel: 'sms' | 'email' | 'call';
  dealerState?: string;
  dealerMessage: string;
  messageRef?: string | null;
  dealContext: {
    shopperFirst: string;
    shopperPhone?: string | null;
    shopperEmail?: string | null;
    shopperLast?: string | null;
    vehicle: string;
    fairOtd: number | null;
    currentOfferOtd: number | null;
    pushbackCount: number;
    isItemized: boolean;
  };
};

export type ShopperContact = {
  phone?: string | null;
  email?: string | null;
  last?: string | null;
};

export function redactShopperContact(text: string, contact: ShopperContact): string {
  let out = text;
  const email = contact.email?.trim();
  if (email) out = replaceAll(out, email, '[redacted]');

  const phone = contact.phone?.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      out = out.replace(new RegExp(last10.split('').join('\\D*'), 'g'), '[redacted]');
    } else if (digits) {
      out = replaceAll(out, phone, '[redacted]');
    }
  }

  const last = contact.last?.trim();
  if (last && last.length > 1) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(last)}\\b`, 'gi'), '[redacted]');
  }
  return out;
}

export function buildModelUserContent(
  input: ModelUserInput,
  lessons: Array<{ lesson: string }>,
  route: RouteDecision,
): string {
  const contact: ShopperContact = {
    phone: input.dealContext.shopperPhone,
    email: input.dealContext.shopperEmail,
    last: input.dealContext.shopperLast,
  };
  const lines = [
    `message_ref: ${input.messageRef?.trim() || 'dealer_message'}`,
    `channel: ${input.channel}`,
    `vehicle: ${redactShopperContact(input.dealContext.vehicle, contact)}`,
    `shopper_first: ${redactShopperContact(input.dealContext.shopperFirst, contact)}`,
    `fair_otd: ${input.dealContext.fairOtd ?? 'unknown'}`,
    `current_offer_otd: ${input.dealContext.currentOfferOtd ?? 'unknown'}`,
    `pushback_rounds: ${input.dealContext.pushbackCount}`,
    `price_is_itemized: ${input.dealContext.isItemized}`,
    `dealer_state: ${input.dealerState ?? 'unknown'}`,
  ];

  if (route.lane === 'fast') {
    const label = route.simpleClass ?? 'short';
    lines.push(
      `routing_hint: simple ${label} message. Do not invent fees. If it is actually ambiguous, conflicting, or fee-heavy, say so in reasoning and do not state a confident total.`,
    );
  }

  if (lessons.length > 0) {
    const lessonLines = lessons.map((lesson) => `- ${redactShopperContact(lesson.lesson, contact)}`);
    lines.push(`approved_lessons:\n${lessonLines.join('\n')}`);
  }

  lines.push(`dealer_message:\n${redactShopperContact(input.dealerMessage, contact)}`);
  return lines.join('\n');
}

function replaceAll(text: string, needle: string, replacement: string): string {
  return text.replace(new RegExp(escapeRegExp(needle), 'gi'), replacement);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
