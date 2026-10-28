import {
  needsReply,
  pricesDiffer,
  replyTemplates,
  slaChip,
  snippetFrom,
  STAGE_LABEL,
  vehicleTitle,
} from './format';
import type { Conversation, ConversationDetail, InboxItem } from './types';

export function toInboxItem(conversation: Conversation, now: Date): InboxItem {
  return {
    id: conversation.id,
    shopperFirstName: conversation.shopperFirstName,
    shopperRef: conversation.shopperRef,
    rooftopId: conversation.rooftopId,
    stage: conversation.stage,
    stageLabel: STAGE_LABEL[conversation.stage],
    vehicleTitle: vehicleTitle(conversation.vehicle),
    stockNumber: conversation.stockNumber,
    advertisedPriceCents: conversation.advertisedPriceCents,
    statedPriceCents: conversation.statedPriceCents,
    priceDiffers: pricesDiffer(
      conversation.advertisedPriceCents,
      conversation.statedPriceCents,
    ),
    snippet: snippetFrom(conversation),
    needsReply: needsReply(conversation),
    openedAt: conversation.openedAt,
    replyDueAt: conversation.replyDueAt,
    sla: slaChip(conversation, now),
  };
}

export function presentFromConversation(
  conversation: Conversation,
  now: Date,
): ConversationDetail {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({ ...message })),
    vehicleTitle: vehicleTitle(conversation.vehicle),
    stageLabel: STAGE_LABEL[conversation.stage],
    priceDiffers: pricesDiffer(
      conversation.advertisedPriceCents,
      conversation.statedPriceCents,
    ),
    needsReply: needsReply(conversation),
    snippet: snippetFrom(conversation),
    sla: slaChip(conversation, now),
    replyTemplates: replyTemplates(conversation),
  };
}
