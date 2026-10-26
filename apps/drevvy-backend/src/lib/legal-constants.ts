/**
 * Legal constants for Drevvy compliance pages.
 *
 * TODO: Have legal counsel review all compliance pages (/privacy, /terms, /sms, /dealers)
 * before launch. These placeholders must be filled in with actual business details once
 * the EIN and business registration are complete.
 */

export const LEGAL = {
  /** The legal entity name for contracts and privacy policy */
  ENTITY_NAME: 'Drevvy, a South Carolina LLC',

  /** Business mailing address for legal notices */
  BUSINESS_ADDRESS: '[BUSINESS ADDRESS]',

  /** Effective date for privacy policy and terms of service */
  EFFECTIVE_DATE: 'October 17, 2026',

  /** Support email */
  SUPPORT_EMAIL: 'support@drevvy.com',

  /** General inquiries email */
  HELLO_EMAIL: 'hello@drevvy.com',

  /** Privacy-specific contact email */
  PRIVACY_EMAIL: 'privacy@drevvy.com',

  /** Opt-out requests email */
  OPTOUT_EMAIL: 'optout@drevvy.com',

  /** Website URL */
  WEBSITE_URL: 'https://www.drevvy.com',

  /** App name as shown to users */
  APP_NAME: 'Drevvy',

  /** SMS program name for carrier registration */
  SMS_PROGRAM_NAME: 'Drevvy Vehicle Inquiry Alerts',

  /**
   * One-time key packs. Keys never expire.
   * Store product ids: drevvy_keys_1, drevvy_keys_5, drevvy_keys_10, drevvy_keys_25.
   * The 10-key pack is the recommended pack.
   */
  KEY_PACKS: [
    { keys: 1, price: '$4.99', perKey: '$4.99', name: 'Try Drevvy' },
    { keys: 5, price: '$19.99', perKey: '$4.00', name: 'Getting started' },
    { keys: 10, price: '$34.99', perKey: '$3.50', name: 'Recommended' },
    { keys: 25, price: '$74.99', perKey: '$3.00', name: 'Lowest price per key' },
  ],
} as const;
