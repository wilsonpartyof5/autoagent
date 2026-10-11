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
  EFFECTIVE_DATE: '[EFFECTIVE DATE]',

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

  /** Subscription price */
  SUBSCRIPTION_PRICE: '$97',

  /** Subscription period */
  SUBSCRIPTION_PERIOD: 'month',

  /** Vehicle limit per subscription */
  VEHICLE_LIMIT: 10,
} as const;
