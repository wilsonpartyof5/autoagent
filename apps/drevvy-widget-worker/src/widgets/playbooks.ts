import { WIDGET_ADAPTERS, type WidgetAdapter, type WidgetVendor } from './vendors';

export const WIDGET_PLAYBOOKS = ['gubagoo', 'carnow', 'generic'] as const;

export type WidgetPlaybook = (typeof WIDGET_PLAYBOOKS)[number];

export type PlaybookActions = {
  id: WidgetPlaybook;
  frameUrl: RegExp;
  launchSelectors: string[];
  composerSelectors: string[];
  sendSelectors: string[];
  messageSelectors: string[];
};

const GENERIC_ACTIONS: PlaybookActions = {
  id: 'generic',
  frameUrl: /chat|message|text-us|podium|gubagoo|carnow|impel|fullpath|smartpath|truvideo|aiva|kenect|matador|activengage/i,
  launchSelectors: [
    'button[aria-label*="chat" i]',
    'button[aria-label*="text us" i]',
    'button[aria-label*="message" i]',
    '[role="button"][aria-label*="chat" i]',
    '[class*="chat-launcher" i]',
    '[class*="chat-button" i]',
  ],
  composerSelectors: [
    'textarea[placeholder*="message" i]',
    'textarea[aria-label*="message" i]',
    '[contenteditable="true"][aria-label*="message" i]',
    '[contenteditable="true"][role="textbox"]',
  ],
  sendSelectors: ['button[aria-label="Send"]', 'button[aria-label="Send message"]'],
  messageSelectors: ['[data-role="dealer"]', '[class*="message-incoming"]'],
};

export function playbookForVendor(vendor: WidgetVendor | null): WidgetPlaybook {
  if (vendor === 'gubagoo') return 'gubagoo';
  if (vendor === 'carnow') return 'carnow';
  return 'generic';
}

export function isWidgetPlaybook(value: string | null | undefined): value is WidgetPlaybook {
  return value === 'gubagoo' || value === 'carnow' || value === 'generic';
}

export function actionsFor(vendor: WidgetVendor | null): PlaybookActions {
  const playbook = playbookForVendor(vendor);
  if (!vendor || playbook === 'generic') return GENERIC_ACTIONS;
  return fromAdapter(playbook, WIDGET_ADAPTERS[vendor]);
}

function fromAdapter(id: WidgetPlaybook, adapter: WidgetAdapter): PlaybookActions {
  return {
    id,
    frameUrl: adapter.frameUrl,
    launchSelectors: adapter.launchSelectors,
    composerSelectors: adapter.inputSelectors,
    sendSelectors: adapter.sendSelectors,
    messageSelectors: adapter.messageSelectors,
  };
}
