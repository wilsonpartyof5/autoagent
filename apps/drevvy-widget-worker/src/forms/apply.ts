import type { ChatPage } from '../chat/types';
import { isApprovedFill, type LeadContactMode, type ListingCue, type OutreachIdentity } from './outreach';
import type { FormPlan } from './plan';

export async function applyPlan(
  page: ChatPage,
  plan: FormPlan,
  identity: OutreachIdentity,
  stockNumber: string | null,
  channel: 'lead_form' | 'prechat',
  mode: LeadContactMode = 'full',
  cue: ListingCue = {},
): Promise<'filled' | 'fill_failed' | 'submit_failed'> {
  for (const fill of plan.fills) {
    if (!isApprovedFill(fill, identity, stockNumber, channel, mode, cue)) return 'fill_failed';
    const filled = await page.fillOutreach(fill);
    if (!filled) return 'fill_failed';
  }
  const submitted = await page.submitForm(plan.formId, plan.buttonText);
  return submitted ? 'filled' : 'submit_failed';
}
