export const WIDGET_VENDORS = [
  'gubagoo',
  'activengage',
  'carnow',
  'podium',
  'kenect',
  'contactatonce',
  'fullpath',
  'impel',
  'matador',
  'smartpath',
  'aiva',
] as const;

export type WidgetVendor = (typeof WIDGET_VENDORS)[number];

export type WidgetAdapter = {
  vendor: WidgetVendor;
  frameUrl: RegExp;
  launchSelectors: string[];
  inputSelectors: string[];
  sendSelectors: string[];
  messageSelectors: string[];
  containerSelectors: string[];
};

const SIGNATURES: Record<WidgetVendor, RegExp[]> = {
  gubagoo: [/gubagoo\.com/i, /gubagoo\.io/i, /\bgubagoo\b/i, /gg-chat/i],
  activengage: [/activengage\.com/i, /ae-launcher/i, /\bactivengage\b/i],
  carnow: [/carnow\.com/i, /cn-chat/i, /\bcarnow\b/i],
  podium: [/widget\.podium\.com/i, /cdn\.podium\.com/i, /podium-website-widget/i, /id=["']podium-bubble/i],
  kenect: [/kenect\.com/i, /kenect-widget/i, /\bkenect\b/i],
  contactatonce: [/contactatonce\.com/i, /cao-widget/i, /contact\s*at\s*once/i],
  fullpath: [/fullpath\.com/i, /autoleadstar\.com/i, /als-widget/i, /\bfullpath\b/i],
  impel: [/impel\.ai/i, /spincar\.com/i, /impel-chat/i, /\bimpel\b/i],
  matador: [/matador\.ai/i, /matador-chat/i, /\bmatador\b/i],
  smartpath: [/smartpath\.toyota\.com/i, /smartpath\.com/i, /smartpath-chat/i, /\bsmartpath\b/i],
  aiva: [/truvideo\.com/i, /aiva\.truvideo/i, /truvideo-aiva/i, /\baiva\b/i],
};

export const NETWORK_SIGNATURES: Record<WidgetVendor, RegExp[]> = {
  gubagoo: [/gubagoo\.com/i, /gubagoo\.io/i],
  activengage: [/activengage\.com/i],
  carnow: [/carnow\.com/i],
  podium: [/podium\.com/i],
  kenect: [/kenect\.com/i],
  contactatonce: [/contactatonce\.com/i],
  fullpath: [/fullpath\.com/i, /autoleadstar\.com/i],
  impel: [/impel\.ai/i, /spincar\.com/i, /impel\.io/i],
  matador: [/matador\.ai/i],
  smartpath: [/smartpath\.toyota\.com/i, /smartpath\.com/i],
  aiva: [/truvideo\.com/i, /aiva\.truvideo/i],
};

const CONTAINER_PATTERNS: Record<WidgetVendor, RegExp> = {
  gubagoo: /<div\b[^>]*(?:gubagoo|gg-chat)[^>]*>[\s\S]*?<\/div>/i,
  activengage: /<div\b[^>]*(?:activengage|ae-launcher|ae-chat)[^>]*>[\s\S]*?<\/div>/i,
  carnow: /<div\b[^>]*(?:carnow|cn-chat)[^>]*>[\s\S]*?<\/div>/i,
  podium: /<div\b[^>]*(?:podium-website-widget|podium-bubble|podium)[^>]*>[\s\S]*?<\/div>/i,
  kenect: /<div\b[^>]*(?:kenect)[^>]*>[\s\S]*?<\/div>/i,
  contactatonce: /<div\b[^>]*(?:contactatonce|cao-widget)[^>]*>[\s\S]*?<\/div>/i,
  fullpath: /<div\b[^>]*(?:fullpath|autoleadstar|als-widget)[^>]*>[\s\S]*?<\/div>/i,
  impel: /<div\b[^>]*(?:impel|spincar)[^>]*>[\s\S]*?<\/div>/i,
  matador: /<div\b[^>]*(?:matador)[^>]*>[\s\S]*?<\/div>/i,
  smartpath: /<div\b[^>]*(?:smartpath)[^>]*>[\s\S]*?<\/div>/i,
  aiva: /<div\b[^>]*(?:truvideo|aiva)[^>]*>[\s\S]*?<\/div>/i,
};

export const WIDGET_ADAPTERS: Record<WidgetVendor, WidgetAdapter> = {
  gubagoo: adapter(
    'gubagoo',
    /gubagoo/i,
    ['iframe[src*="gubagoo"]', '#gubagoo-toolbar', '.gg-chat-launcher', '[data-gg-launcher]', 'button[aria-label*="chat" i]', '[data-gg-action="chat"]'],
    ['textarea.gg-chat-input', '#gg-chat-input', 'textarea[aria-label*="message" i]', '[contenteditable="true"]'],
    ['button.gg-chat-send', 'button[aria-label="Send"]', 'button[aria-label="Send message"]'],
    ['.gg-message-dealer', '.gg-chat-message.incoming', '[data-gg-message="dealer"]'],
    ['#gubagoo-chat', '#gubagoo-toolbar', '.gg-chat', 'iframe[src*="gubagoo"]'],
  ),
  activengage: adapter('activengage', /activengage/i, ['.ae-launcher', '#ae-chat-launcher', '[data-ae-launcher]'], ['textarea.ae-chat-input', '#ae-chat-input'], ['button.ae-chat-send', 'button[aria-label="Send message"]'], ['.ae-message-agent', '.ae-chat-message.incoming'], ['#ae-chat', '.ae-chat']),
  carnow: adapter(
    'carnow',
    /carnow/i,
    ['iframe[src*="carnow"]', '.cn-chat-plugin-btn', '#cn-chat-launcher', '.cn-chat-button', '[data-cn-launcher]', 'button[aria-label*="chat" i]'],
    ['textarea.cn-chat-input', '#cn-chat-input', 'textarea[aria-label*="message" i]', '[contenteditable="true"]'],
    ['button.cn-chat-send', 'button[aria-label="Send"]'],
    ['.cn-message-dealer', '.cn-chat-incoming'],
    ['#cn-chat', '.cn-chat', 'iframe[src*="carnow"]'],
  ),
  podium: adapter('podium', /podium/i, ['#podium-bubble', '.podium-website-widget button', '[data-podium-bubble]'], ['textarea.podium-composer', '#podium-chat-input'], ['button.podium-send', 'button[aria-label="Send"]'], ['.podium-message-incoming', '[data-podium-message="dealer"]'], ['#podium-website-widget', '.podium-website-widget']),
  kenect: adapter('kenect', /kenect/i, ['.kenect-widget-button', '#kenect-launcher'], ['textarea.kenect-composer', '#kenect-chat-input'], ['button.kenect-send', 'button[aria-label="Send"]'], ['.kenect-message-incoming'], ['#kenect-widget', '.kenect-widget']),
  contactatonce: adapter('contactatonce', /contactatonce/i, ['.cao-widget-button', '#cao-launcher'], ['textarea.cao-composer', '#cao-chat-input'], ['button.cao-send', 'button[aria-label="Send"]'], ['.cao-message-incoming'], ['#cao-widget', '.cao-widget']),
  fullpath: adapter('fullpath', /fullpath|autoleadstar/i, ['.als-widget-button', '#fullpath-launcher'], ['textarea.als-composer', '#fullpath-chat-input'], ['button.als-send', 'button[aria-label="Send"]'], ['.als-message-incoming'], ['#als-widget', '.als-widget']),
  impel: adapter('impel', /impel|spincar/i, ['.impel-chat-button', '#impel-launcher'], ['textarea.impel-composer', '#impel-chat-input'], ['button.impel-send', 'button[aria-label="Send"]'], ['.impel-message-incoming'], ['#impel-chat', '.impel-chat']),
  matador: adapter('matador', /matador/i, ['.matador-chat-button', '#matador-launcher'], ['textarea.matador-composer', '#matador-chat-input'], ['button.matador-send', 'button[aria-label="Send"]'], ['.matador-message-incoming'], ['#matador-chat', '.matador-chat']),
  smartpath: adapter('smartpath', /smartpath/i, ['#smartpath-chat-launcher', '.smartpath-chat-button', 'button[aria-label*="chat" i]'], ['textarea.smartpath-composer', '#smartpath-chat-input'], ['button[aria-label="Send"]'], ['.smartpath-message-incoming'], ['#smartpath-chat', '.smartpath-chat']),
  aiva: adapter('aiva', /truvideo|aiva/i, ['#aiva-launcher', '.truvideo-chat-button', 'button[aria-label*="chat" i]'], ['textarea.aiva-composer', '#aiva-chat-input'], ['button[aria-label="Send"]'], ['.aiva-message-incoming'], ['#aiva-chat', '.truvideo-chat']),
};

export function vendorSignatures(vendor: WidgetVendor): RegExp[] {
  return SIGNATURES[vendor];
}

export function extractWidgetScope(html: string, vendor: WidgetVendor | null): string {
  if (!vendor) return '';
  return html.match(CONTAINER_PATTERNS[vendor])?.[0] ?? '';
}

export function vendorFromModel(value: string | null | undefined): WidgetVendor | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '');
  const aliases: Record<string, WidgetVendor> = {
    gubagoo: 'gubagoo',
    activengage: 'activengage',
    carnow: 'carnow',
    podium: 'podium',
    kenect: 'kenect',
    contactatonce: 'contactatonce',
    fullpath: 'fullpath',
    autoleadstar: 'fullpath',
    impel: 'impel',
    spincar: 'impel',
    matador: 'matador',
    smartpath: 'smartpath',
    toyotasmartpath: 'smartpath',
    aiva: 'aiva',
    truvideo: 'aiva',
    truvideoaiva: 'aiva',
  };
  return aliases[normalized] ?? null;
}

function adapter(
  vendor: WidgetVendor,
  frameUrl: RegExp,
  launchSelectors: string[],
  inputSelectors: string[],
  sendSelectors: string[],
  messageSelectors: string[],
  containerSelectors: string[],
): WidgetAdapter {
  return {
    vendor,
    frameUrl,
    launchSelectors,
    inputSelectors,
    sendSelectors,
    messageSelectors,
    containerSelectors,
  };
}
