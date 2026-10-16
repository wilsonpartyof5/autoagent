import { WIDGET_VENDORS, vendorSignatures, type WidgetVendor } from './vendors';

export function detectWidgetVendor(html: string): WidgetVendor | null {
  for (const vendor of WIDGET_VENDORS) {
    if (vendorSignatures(vendor).some((pattern) => pattern.test(html))) return vendor;
  }
  return null;
}

export function vendorMentioned(html: string, vendor: WidgetVendor): boolean {
  return vendorSignatures(vendor).some((pattern) => pattern.test(html));
}
