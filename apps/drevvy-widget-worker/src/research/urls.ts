const BLOCKED_HOST = /(^|\.)marketcheck\.com$/i;

export function assertDealerPageUrl(vehiclePageUrl: string): URL {
  let url: URL;
  try {
    url = new URL(vehiclePageUrl);
  } catch {
    throw new Error(`Not a URL: ${vehiclePageUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Vehicle page URL must be http or https.');
  }
  if (BLOCKED_HOST.test(url.hostname)) {
    throw new Error('MarketCheck URLs are not dealer pages. Pass the dealer vehicle page, and keep MarketCheck as a contact hint.');
  }
  return url;
}

export function siteUrlFromVehiclePage(vehiclePageUrl: string): string {
  return assertDealerPageUrl(vehiclePageUrl).origin;
}
