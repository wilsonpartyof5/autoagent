/**
 * ADF (AutoLead Data Format) XML Generator
 * Generates industry-standard ADF XML for automotive CRM integration
 * Reference: https://www.autoleaddataformat.org/
 */

export interface LeadData {
  leadId: string;
  user: {
    name: string;
    email: string;
    phone?: string;
    preferredTime?: string;
  };
  vehicle: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    stockNumber?: string;
    price?: number;
    miles?: number;
    condition?: string;
  };
  dealer: {
    id?: string;
    name?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };
  source?: string;
  timestamp: string; // ISO 8601 datetime
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate ADF XML payload from lead data
 */
export function generateAdfXml(data: LeadData): string {
  const {
    leadId,
    user,
    vehicle,
    dealer,
    source = 'Drevvy',
    timestamp,
  } = data;

  // Split name into first/last (simple heuristic)
  const nameParts = user.name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Format phone number (remove non-digits, add formatting)
  const phoneDigits = user.phone?.replace(/\D/g, '') || '';
  const formattedPhone =
    phoneDigits.length === 10
      ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`
      : phoneDigits;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect>
    <id source="${escapeXml(source)}">${escapeXml(leadId)}</id>
    <requestdate>${escapeXml(timestamp)}</requestdate>
    <customer>
      <contact>
        <name part="first">${escapeXml(firstName)}</name>
        <name part="last">${escapeXml(lastName)}</name>
        <email>${escapeXml(user.email)}</email>
        ${user.phone ? `<phone type="voice" time="day">${escapeXml(formattedPhone)}</phone>` : ''}
        ${user.preferredTime ? `<preferredcontact>${escapeXml(user.preferredTime)}</preferredcontact>` : ''}
      </contact>
    </customer>
    <vehicle>
      ${vehicle.vin ? `<vin>${escapeXml(vehicle.vin)}</vin>` : ''}
      ${vehicle.year ? `<year>${vehicle.year}</year>` : ''}
      ${vehicle.make ? `<make>${escapeXml(vehicle.make)}</make>` : ''}
      ${vehicle.model ? `<model>${escapeXml(vehicle.model)}</model>` : ''}
      ${vehicle.trim ? `<trim>${escapeXml(vehicle.trim)}</trim>` : ''}
      ${vehicle.stockNumber ? `<stock>${escapeXml(vehicle.stockNumber)}</stock>` : ''}
      ${vehicle.price ? `<price type="selling">${vehicle.price}</price>` : ''}
      ${vehicle.miles !== undefined ? `<odometer status="unknown">${vehicle.miles}</odometer>` : ''}
      ${vehicle.condition ? `<condition>${escapeXml(vehicle.condition)}</condition>` : ''}
    </vehicle>
    <vendor>
      <id source="${escapeXml(source)}">${escapeXml(leadId)}</id>
      <vendorname>${escapeXml(source)}</vendorname>
      ${dealer.name ? `<contact>
        <name part="full">${escapeXml(dealer.name)}</name>
        ${dealer.phone ? `<phone type="voice">${escapeXml(dealer.phone)}</phone>` : ''}
        ${dealer.city || dealer.state || dealer.zip ? `<address>
          ${dealer.city ? `<city>${escapeXml(dealer.city)}</city>` : ''}
          ${dealer.state ? `<regioncode>${escapeXml(dealer.state)}</regioncode>` : ''}
          ${dealer.zip ? `<postalcode>${escapeXml(dealer.zip)}</postalcode>` : ''}
        </address>` : ''}
      </contact>` : ''}
    </vendor>
    <provider>
      <id source="${escapeXml(source)}">${escapeXml(leadId)}</id>
      <name part="full">${escapeXml(source)}</name>
      <service>${escapeXml(source)} Lead Generation</service>
      <url>https://www.drevvy.com</url>
    </provider>
  </prospect>
</adf>`;

  return xml;
}

