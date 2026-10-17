import type { DealerReplyClassification } from '../ai/parse';
import { dealerAskedForShopperContact, dealerAskedIfBot, hasCaptchaChallenge } from '../widgets/guards';
import type { ScriptId } from '../widgets/script';

export function resolveNextMessage(input: {
  classification: DealerReplyClassification;
  dealerText: string;
  sent: ReadonlySet<ScriptId>;
}): ScriptId | null {
  if (input.dealerText && hasCaptchaChallenge(input.dealerText)) return null;
  const botAsked =
    dealerAskedIfBot(input.dealerText) ||
    (input.dealerText === '' && input.classification.next_message === 'bot_disclosure');
  if (botAsked && !input.sent.has('bot_disclosure')) return 'bot_disclosure';
  if (dealerAskedForShopperContact(input.dealerText) || input.classification.status === 'asked_contact') {
    return null;
  }
  if (input.classification.status === 'sold' || input.classification.status === 'human_handoff') return null;

  // Status picks the script line. A next_message outside that line is ignored.
  if (input.classification.status === 'price_given' && !input.sent.has('continue_offline')) {
    return 'continue_offline';
  }
  if (input.classification.status === 'available' && !input.sent.has('listing_price')) {
    return 'listing_price';
  }
  return null;
}
