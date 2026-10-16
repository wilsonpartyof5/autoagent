import { pushCopy, pushData, type PushCopy, type ShopperPush } from './events';
import { sendPush, type SendPushResult } from './send';
import { listDeviceTokens } from './tokens';
import { sanitizePushText } from './triggers';

export type PushDeliveryReport = {
  event: ShopperPush['event'];
  title: string;
  body: string;
  targeted: number;
  delivered: number;
  reason: 'no_devices' | 'unconfigured' | 'sent' | 'rejected' | 'unavailable';
};

export type PushDeliveryDeps = {
  tokens: (userId: string) => Promise<string[]>;
  send: (message: { token: string; title: string; body: string; data: Record<string, string> }) => Promise<SendPushResult>;
};

export async function deliverShopperPush(push: ShopperPush, deps: PushDeliveryDeps): Promise<PushDeliveryReport> {
  const copy = outgoingCopy(push);
  try {
    const tokens = await deps.tokens(push.userId);
    if (tokens.length === 0) {
      return { event: push.event, ...copy, targeted: 0, delivered: 0, reason: 'no_devices' };
    }
    const results = await Promise.all(tokens.map((token) => deps.send({
      token,
      title: copy.title,
      body: copy.body,
      data: pushData(push),
    })));
    const delivered = results.filter((result) => result.delivered).length;
    const unconfigured = results.every((result) => !result.delivered && result.reason === 'unconfigured');
    return {
      event: push.event,
      ...copy,
      targeted: tokens.length,
      delivered,
      reason: unconfigured ? 'unconfigured' : delivered > 0 ? 'sent' : 'rejected',
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'shopper_push_failed',
      push: push.event,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return { event: push.event, ...copy, targeted: 0, delivered: 0, reason: 'unavailable' };
  }
}

export function deliverShopperPushLive(push: ShopperPush): Promise<PushDeliveryReport> {
  return deliverShopperPush(push, {
    tokens: listDeviceTokens,
    send: (message) => sendPush(message),
  });
}

function outgoingCopy(push: ShopperPush): PushCopy {
  const fallback = pushCopy(push.event);
  return {
    title: sanitizePushText(push.title?.trim() || fallback.title),
    body: sanitizePushText(push.body?.trim() || fallback.body),
  };
}
