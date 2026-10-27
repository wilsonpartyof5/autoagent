/** Demo dealer group for the #102 desk scaffold. Not the live rooftop registry. */

export const TERMS_VERSION = 'v2026.10';

export const DEMO_GROUP = {
  name: 'Lakeside Auto Group',
  billingContact: 'accounting@lakesideauto.com',
} as const;

export const DEMO_ROOFTOPS = [
  {
    id: 'lakeside',
    name: 'Lakeside Honda',
    city: 'Atlanta',
    hours: 'Mon–Sat 9–8, Sun closed',
    docFee: '$699',
    vehicles: 214,
  },
  {
    id: 'midtown',
    name: 'Midtown Toyota',
    city: 'Atlanta',
    hours: 'Mon–Sat 9–8, Sun 12–6',
    docFee: '$699',
    vehicles: 188,
  },
  {
    id: 'airport',
    name: 'Airport Kia',
    city: 'College Park',
    hours: 'Mon–Sat 9–7, Sun closed',
    docFee: '$649',
    vehicles: 131,
  },
] as const;

export type DemoRooftopId = (typeof DEMO_ROOFTOPS)[number]['id'] | 'all';

export const DEALER_ROLES = [
  {
    id: 'salesperson',
    label: 'Salesperson',
    scope: 'Own conversations',
  },
  {
    id: 'bdc',
    label: 'BDC',
    scope: 'All rooftop chats',
  },
  {
    id: 'sales_manager',
    label: 'Sales Manager',
    scope: 'Rooftop + team',
  },
  {
    id: 'owner_gm',
    label: 'Owner/GM',
    scope: 'Cross-rooftop + billing + team',
  },
] as const;

export const DEMO_TEAM = [
  {
    name: 'Maya R.',
    role: 'Owner/GM',
    rooftops: 'All 3 rooftops',
    status: 'Active',
  },
  {
    name: 'Derek P.',
    role: 'Sales Manager',
    rooftops: 'Lakeside Honda',
    status: 'Active',
  },
  {
    name: 'Lena S.',
    role: 'BDC',
    rooftops: 'Lakeside Honda, Midtown Toyota',
    status: 'Active',
  },
  {
    name: 'Chris O.',
    role: 'Salesperson',
    rooftops: 'Lakeside Honda',
    status: 'Active',
  },
  {
    name: 'Tasha W.',
    role: 'Salesperson',
    rooftops: 'Midtown Toyota',
    status: 'Invited · 1d',
  },
  {
    name: 'Omar B.',
    role: 'Sales Manager',
    rooftops: 'Airport Kia',
    status: 'Active',
  },
] as const;

export const TERMS_BOXES = [
  {
    id: 'first-name',
    title: 'You will see the shopper’s name in dashboard messages',
    body: 'First name + conversation ref only; phone, email and address stay private.',
  },
  {
    id: 'message-only',
    title: 'Message-only; no pushy “come in” sales',
    body: 'Answer in chat. No unsolicited visit or test-drive pushes.',
  },
  {
    id: 'itemized-otd',
    title: 'You agree to provide an itemized best out-the-door when asked',
    body: 'Vehicle, doc fee, tax, tag/title and any add-ons listed line by line.',
  },
  {
    id: 'transparency',
    title: 'Chat is for transparency and answering questions',
    body: 'Availability, price, fees and vehicle details.',
  },
  {
    id: 'close-fee',
    title: '$300 close fee when you mark sold to this shopper',
    body: 'Day-to-day use is free.',
  },
] as const;

export const ONBOARDING_STEPS = [
  { id: 'invite', label: 'Invite', href: '/dealer/invite/demo' },
  { id: 'verify', label: 'Verify', href: '/dealer/verify' },
  { id: 'org', label: 'Dealer group', href: '/dealer/onboarding/org' },
  { id: 'rooftops', label: 'Rooftops', href: '/dealer/onboarding/rooftops' },
  { id: 'team', label: 'Team', href: '/dealer/onboarding/team' },
  { id: 'routing', label: 'Routing', href: '/dealer/onboarding/routing' },
  { id: 'terms', label: 'Terms', href: '/dealer/onboarding/terms' },
  { id: 'done', label: 'Inbox', href: '/dealer/onboarding/done' },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export const TERMS_LOG = [
  {
    whenEt: 'Oct 27, 2026 12:41 PM',
    user: 'Derek Patel',
    role: 'Owner/GM',
    rooftops: 'Lakeside Honda, Midtown Toyota, Airport Kia',
    version: TERMS_VERSION,
    method: 'Onboarding',
  },
  {
    whenEt: 'Oct 27, 2026 1:05 PM',
    user: 'Omar B.',
    role: 'Sales Manager',
    rooftops: 'Airport Kia',
    version: TERMS_VERSION,
    method: 'Invite accept',
  },
  {
    whenEt: 'Oct 27, 2026 1:12 PM',
    user: 'Lena S.',
    role: 'BDC',
    rooftops: 'Lakeside Honda, Midtown Toyota',
    version: TERMS_VERSION,
    method: 'Invite accept',
  },
  {
    whenEt: 'Oct 12, 2026 9:30 AM',
    user: 'Maya R.',
    role: 'Owner/GM',
    rooftops: 'Lakeside Honda',
    version: 'v2026.09',
    method: 'Superseded',
  },
] as const;

export function rooftopName(id: string): string {
  return DEMO_ROOFTOPS.find(item => item.id === id)?.name ?? 'Lakeside Honda';
}

export function shopperDeskLabel(firstName: string, shopperRef: string): string {
  return `${firstName} · ${shopperRef}`;
}
