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
   * One-time car packs. Credits never expire.
   * Store product ids: drevvy_pack_1, drevvy_pack_3, drevvy_pack_5, drevvy_pack_10.
   */
  CAR_PACKS: [
    { cars: 1, price: '$35', perCar: '$35.00', name: 'Single' },
    { cars: 3, price: '$55', perCar: '$18.33', name: 'Starter' },
    { cars: 5, price: '$75', perCar: '$15.00', name: 'Plus' },
    { cars: 10, price: '$95', perCar: '$9.50', name: 'Best Value' },
  ],
} as const;
