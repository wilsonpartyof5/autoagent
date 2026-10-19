import { DAY0_FALLBACK, type ChannelSelection, type Day0Fallback } from '../chat/types';

export type Day0Channel = 'widget' | 'lead_form';

export type Day0Plan = {
  channels: Day0Channel[];
  reason: string;
  fallback: Day0Fallback | null;
  widgetStatus: string;
};

const READY_STATUS = 'dry_run';

export function selectDay0Channels(widgetStatus: string): Day0Plan {
  if (widgetStatus === 'blocked') {
    return {
      channels: [],
      reason: 'Bot wall. Do not retry. Marked for email, text, and call fallback.',
      fallback: DAY0_FALLBACK,
      widgetStatus,
    };
  }
  if (widgetStatus === READY_STATUS) {
    return {
      channels: ['widget', 'lead_form'],
      reason: 'Widget is ready. Send the widget chat and the lead form with the first name and the Drevvy number only.',
      fallback: null,
      widgetStatus,
    };
  }
  const label = widgetStatus === 'captcha' || widgetStatus === 'contact_form' ? 'blocked-for-chat' : widgetStatus;
  return {
    channels: ['lead_form'],
    reason: `Widget status is ${label}. Lead form is the day-0 first touch.`,
    fallback: null,
    widgetStatus,
  };
}

export function applyCallEmailOnly(plan: Day0Plan, callEmailOnly: boolean): Day0Plan {
  if (!callEmailOnly || !plan.channels.includes('widget')) return plan;
  return {
    ...plan,
    channels: plan.channels.filter((channel) => channel !== 'widget'),
    reason: 'Call and email only. The widget channel is skipped.',
  };
}

export function selectionRecord(plan: Day0Plan): ChannelSelection {
  return {
    selected_channels: plan.channels.length === 0 ? null : plan.channels.join(','),
    channel_reason: plan.reason,
    fallback: plan.fallback,
  };
}
