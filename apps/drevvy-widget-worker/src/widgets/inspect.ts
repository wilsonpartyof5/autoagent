import type { ChatClient } from '../ai/types';
import type { ChatPage } from '../chat/types';
import { detectPrechat } from '../forms/detect';
import { isBotBlockedPage } from '../forms/outreach';
import { hasCaptchaChallenge } from './guards';
import { actionsFor, playbookForVendor, type WidgetPlaybook } from './playbooks';
import { detectVendorEvidence, type VendorSource } from './evidence';
import { extractWidgetScope, type WidgetVendor } from './vendors';
import { locateLauncher } from './vision';

export type WidgetInspection = {
  vendor: WidgetVendor | null;
  playbook: WidgetPlaybook;
  source: VendorSource | null;
  launcherFound: boolean;
  composerFound: boolean;
  gateFound: boolean;
  captcha: boolean;
  blocked: boolean;
  overlaysDismissed: string[];
  visionClicked: boolean;
};

export async function prepareInspection(
  page: ChatPage,
  ai: ChatClient,
  log: (line: string) => void = () => undefined,
): Promise<WidgetInspection> {
  const initial = await page.content();
  if (isBotBlockedPage(initial)) return emptyInspection({ blocked: true });

  await page.settle();
  const overlaysDismissed = await page.dismissOverlays();
  if (overlaysDismissed.length > 0) log(`[overlays] dismissed ${overlaysDismissed.join(', ')}`);

  let html = await page.content();
  if (isBotBlockedPage(html)) return emptyInspection({ blocked: true, overlaysDismissed });

  let frames = await page.frames();
  let evidence = detectVendorEvidence({ html, frames, networkUrls: page.networkUrls() });
  let actions = actionsFor(evidence.vendor);
  let launcherFound = await page.launcherVisible(actions.launchSelectors, actions.frameUrl);
  let composerFound = await page.composerVisible(actions.composerSelectors, evidence.vendor ? actions.frameUrl : null);
  const scope = evidence.vendor ? (await page.widgetHtml(evidence.vendor)) || extractWidgetScope(html, evidence.vendor) : '';
  const gateFound = Boolean(detectPrechat(scope || frames.map((frame) => frame.html).join('\n')));
  const captcha =
    (await page.captchaVisible(evidence.vendor)) || hasCaptchaChallenge(scope) || hasCaptchaChallenge(html);
  let visionClicked = false;

  if (!captcha && !launcherFound && !gateFound) {
    const point = await locateLauncher(ai, await page.screenshot());
    if (point) {
      visionClicked = await page.clickPoint(point.x, point.y);
      if (visionClicked) {
        log(`[vision] chat launcher at ${point.x},${point.y}`);
        html = await page.content();
        frames = await page.frames();
        const again = detectVendorEvidence({ html, frames, networkUrls: page.networkUrls() });
        if (!evidence.vendor && again.vendor) evidence = again;
        actions = actionsFor(evidence.vendor);
        launcherFound = true;
        composerFound =
          (await page.composerVisible(actions.composerSelectors, evidence.vendor ? actions.frameUrl : null)) ||
          (await page.composerVisible(actionsFor(null).composerSelectors, null));
      }
    }
  }

  return {
    vendor: evidence.vendor,
    playbook: playbookForVendor(evidence.vendor),
    source: evidence.source,
    launcherFound,
    composerFound,
    gateFound,
    captcha,
    blocked: false,
    overlaysDismissed,
    visionClicked,
  };
}

function emptyInspection(input: { blocked: boolean; overlaysDismissed?: string[] }): WidgetInspection {
  return {
    vendor: null,
    playbook: 'generic',
    source: null,
    launcherFound: false,
    composerFound: false,
    gateFound: false,
    captcha: false,
    blocked: input.blocked,
    overlaysDismissed: input.overlaysDismissed ?? [],
    visionClicked: false,
  };
}
