import { detectWidgetVendor } from './detect';
import { NETWORK_SIGNATURES, WIDGET_VENDORS, type WidgetVendor } from './vendors';

export type VendorSource = 'network' | 'script' | 'iframe' | 'dom';

export type FrameSnapshot = {
  url: string;
  html: string;
};

export type VendorEvidence = {
  vendor: WidgetVendor | null;
  source: VendorSource | null;
};

export function scriptSources(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1] ?? '').filter(Boolean);
}

export function detectVendorEvidence(input: {
  html: string;
  frames: FrameSnapshot[];
  networkUrls: string[];
}): VendorEvidence {
  const networkVendor = matchUrls(input.networkUrls, 'network');
  if (networkVendor) return networkVendor;
  const scriptVendor = matchUrls(scriptSources(input.html), 'script');
  if (scriptVendor) return scriptVendor;
  const frameUrlVendor = matchUrls(
    input.frames.map((frame) => frame.url),
    'iframe',
  );
  if (frameUrlVendor) return frameUrlVendor;
  const frameDocumentVendor = detectWidgetVendor(input.frames.map((frame) => frame.html).join('\n'));
  if (frameDocumentVendor) return { vendor: frameDocumentVendor, source: 'iframe' };
  const domVendor = detectWidgetVendor(input.html);
  if (domVendor) return { vendor: domVendor, source: 'dom' };
  return { vendor: null, source: null };
}

function matchUrls(urls: string[], source: VendorSource): VendorEvidence | null {
  if (urls.length === 0) return null;
  for (const vendor of WIDGET_VENDORS) {
    if (NETWORK_SIGNATURES[vendor].some((pattern) => urls.some((url) => pattern.test(url)))) {
      return { vendor, source };
    }
  }
  return null;
}
