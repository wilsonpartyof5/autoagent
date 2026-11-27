/**
 * Legal constants for Drevvy compliance pages.
 *
 * TODO(DW and counsel): DO NOT SHIP the placeholder below.
 * DW replaces LEGAL_DRAFT_DO_NOT_SHIP after the EIN and business registration
 * are complete. Counsel reviews /privacy, /terms, /sms, /dealers, and
 * /delete-account before launch. The draft sentences in this file are not
 * final legal wording.
 */

/** Placeholder for DW. Not a mailing address. Do not ship this value. */
export const LEGAL_DRAFT_DO_NOT_SHIP = '[BUSINESS ADDRESS]' as const;

export const LEGAL = {
  /** The legal entity name for contracts and privacy policy */
  ENTITY_NAME: 'Drevvy, a South Carolina LLC',

  /** Placeholder for DW. Same value as LEGAL_DRAFT_DO_NOT_SHIP. Not a mailing address. */
  BUSINESS_ADDRESS: LEGAL_DRAFT_DO_NOT_SHIP,

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
   * One-time generic key packs. Spend kind is assigned at use.
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

/**
 * Draft privacy and account-deletion sentences for counsel.
 * The public pages render these strings. They match DELETE /api/consumer/profile.
 * Counsel replaces them before launch. See the TODO at the top of this file.
 */
export const DRAFT_PRIVACY_USAGE =
  'PostHog processes app usage events for us so we can see which screens and buttons people use. Those events are described under Third-Party Services. They are not supposed to include your name, email, phone, or anything you type.';

export const DRAFT_PRIVACY_POSTHOG =
  'PostHog receives app usage events after you sign in, such as screens you open and buttons you tap. The id on those events is your account id. The app is set up so those events do not include your name, email, phone, address, or anything you type. Session replay and surveys are off. You can turn this off in Profile.';

export const DRAFT_PRIVACY_SUPERWALL =
  'Superwall shows key-pack paywalls inside the app when it is configured. The app does not send your name, email, or phone to Superwall. Apple or Google still handles the purchase.';

export const DRAFT_PRIVACY_FIREBASE =
  'Firebase Cloud Messaging delivers alert notifications to your phone. We store a device token so an alert can arrive, and we delete that token when you delete your account. We do not use Firebase to sign you in, and we do not store your cars or chats in Firebase.';

export const DRAFT_PRIVACY_RETENTION =
  'We keep your information while your account is open so the app can work. When you delete your account, we delete your sign-in then. We do not wait 30 days. What we delete and what we keep is described under Data Deletion.';

export const DRAFT_DELETE_ACCOUNT_INTRO =
  'You can delete your Drevvy account yourself. This page tells you how. It does not ask for a password.';

export const DRAFT_DELETE_ACCOUNT_IN_APP =
  'Open the Drevvy app. Open Profile. Tap Delete account. Then tap Delete my account. That confirms it. We delete the account then.';

export const DRAFT_DELETE_ACCOUNT_EMAIL_BEFORE = 'Or email';

export const DRAFT_DELETE_ACCOUNT_EMAIL_AFTER =
  'and ask us to delete your account. Tell us the email on the account so we know it is you. Do not send a password. We will not ask for one. After we confirm the request is yours, we delete the account the same way the app does.';

export const DRAFT_DELETE_ACCOUNT_DELETED =
  'We delete these right away: the cars you saved, the ZIP code on your profile, the saved place we use to ping your phone, and your sign-in. The email you use to sign in goes away with the sign-in.';

export const DRAFT_DELETE_ACCOUNT_KEPT =
  'We keep dealer chats so the dealer still has the conversation. We take your first name out of those chats. We also take out the ZIP code that was on your profile. One email address we made for the dealer still starts with your first name, so a reply can find the chat. That address is not your real email. A saved phone call can still say your first name or ZIP code. We do not change that sound file. We keep the list of keys you bought or used so we can fix a purchase. We keep notes the law tells us to keep. We keep them for as long as the dealer, the purchase, or the law needs them. A lawyer still has to pick the exact number of days.';

export const DRAFT_DELETE_ACCOUNT_MESSAGES =
  'Words you typed in a dealer chat are replaced with a short note that the message was removed. The dealer\'s own words can stay.';

export const DRAFT_DELETE_ACCOUNT_ALREADY_SENT =
  'Calls and emails we already sent to a dealer can stay in that dealer\'s record. Those used your first name only.';

export const DRAFT_DELETE_ACCOUNT_PAYMENTS =
  'Apple, Google, and the purchase system can keep the payment record. We do not keep your card number.';
