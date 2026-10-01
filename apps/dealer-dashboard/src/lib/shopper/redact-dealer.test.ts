import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { redactShopperDealerIdentity } from './redact-dealer';

const DEALER_NAME = 'Rick Hendrick Chevrolet';
const PHONE = '803-555-0199';
const EMAIL = 'sales@rick.com';
const WEBSITE = 'https://www.rickhendrick.com/inventory';
const STREET = '123 Hendrick Way';
const SALESPERSON = 'Pat Smith';
const PHOTO = 'https://images.marketcheck.com/vehicles/tahoe.jpg';

function shopperPayload() {
  return {
    success: true,
    data: {
      assistantMessage: `The 2024 Chevrolet Tahoe at ${DEALER_NAME} is $52,900. Call ${PHONE} or email ${EMAIL}. See ${WEBSITE}. Ask for ${SALESPERSON}.`,
      vehicles: [
        {
          id: 'mc-listing-1',
          vin: '1GNSKCKD5RR123456',
          year: 2024,
          make: 'Chevrolet',
          model: 'Tahoe',
          trim: 'LT',
          condition: 'used',
          price: 52900,
          miles: 12000,
          thumbnailUrl: PHOTO,
          photoUrls: [PHOTO],
          location: {
            latitude: 35.2271,
            longitude: -80.8431,
            dealerName: DEALER_NAME,
            dealerCity: 'Charlotte',
            dealerState: 'NC',
          },
        },
      ],
      detail: {
        id: 'mc-listing-1',
        year: 2024,
        make: 'Chevrolet',
        model: 'Tahoe',
        trim: 'LT',
        price: 52900,
        miles: 12000,
        daysOnMarket: 18,
        photoUrls: [PHOTO],
        videoUrl: 'https://rickhendrick.com/video/tahoe',
        sellerComments: `Ask for ${SALESPERSON} at ${EMAIL} or (803) 555-0199. Visit rickhendrick.com. Located at ${STREET}.`,
        description: `${DEALER_NAME} has this Tahoe in stock.`,
        features: [`Call ${DEALER_NAME} at 8035550199`],
        location: {
          latitude: 35.2271,
          longitude: -80.8431,
          dealerName: DEALER_NAME,
          dealerCity: 'Charlotte',
          dealerState: 'NC',
          dealerPhone: PHONE,
          dealerWebsite: WEBSITE,
          dealerAddress: `${STREET}, Charlotte, NC 28202`,
          dealerRating: 4.7,
          dealerReviewCount: 312,
          dealerHours: { monday: '9-7' },
          email: EMAIL,
          salesperson: SALESPERSON,
          dealerId: 'mc-dealer-99',
        },
        dealer: {
          name: DEALER_NAME,
          phone: PHONE,
          city: 'Charlotte',
          latitude: 35.2271,
        },
      },
    },
  };
}

function assertIdentityAbsent(serialized: string): void {
  assert.equal(serialized.includes(DEALER_NAME), false);
  assert.equal(serialized.toLowerCase().includes('rick hendrick'), false);
  assert.equal(serialized.includes(PHONE), false);
  assert.equal(serialized.includes('(803) 555-0199'), false);
  assert.equal(serialized.includes('8035550199'), false);
  assert.equal(serialized.includes(EMAIL), false);
  assert.equal(serialized.toLowerCase().includes('rickhendrick.com'), false);
  assert.equal(serialized.includes(STREET), false);
  assert.equal(serialized.includes(SALESPERSON), false);
  assert.equal(serialized.includes('mc-dealer-99'), false);
  assert.equal(serialized.includes('9-7'), false);
}

test('shopper JSON keeps the car and drops dealer identity', () => {
  const redacted = redactShopperDealerIdentity(shopperPayload());
  const serialized = JSON.stringify(redacted);

  assertIdentityAbsent(serialized);
  assert.equal(redacted.data.vehicles[0].price, 52900);
  assert.equal(redacted.data.vehicles[0].year, 2024);
  assert.equal(redacted.data.vehicles[0].make, 'Chevrolet');
  assert.equal(redacted.data.vehicles[0].model, 'Tahoe');
  assert.equal(redacted.data.vehicles[0].trim, 'LT');
  assert.equal(redacted.data.vehicles[0].miles, 12000);
  assert.equal(redacted.data.vehicles[0].location.dealerCity, 'Charlotte');
  assert.equal(redacted.data.vehicles[0].location.dealerState, 'NC');
  assert.equal(redacted.data.vehicles[0].location.latitude, 35.2271);
  assert.equal(redacted.data.vehicles[0].location.longitude, -80.8431);
  assert.equal(redacted.data.vehicles[0].location.dealerName, '');
  assert.equal(redacted.data.vehicles[0].photoUrls[0], PHOTO);
  assert.equal(redacted.data.detail.daysOnMarket, 18);
  assert.equal(redacted.data.detail.photoUrls[0], PHOTO);
  assert.equal(redacted.data.detail.location.dealerName, '');
  assert.equal(redacted.data.detail.location.dealerCity, 'Charlotte');
  assert.equal('dealerPhone' in redacted.data.detail.location, false);
  assert.equal('dealerWebsite' in redacted.data.detail.location, false);
  assert.equal('dealerAddress' in redacted.data.detail.location, false);
  assert.equal('dealerHours' in redacted.data.detail.location, false);
  assert.equal('email' in redacted.data.detail.location, false);
  assert.equal('salesperson' in redacted.data.detail.location, false);
  assert.equal('dealerId' in redacted.data.detail.location, false);
  assert.equal('dealerRating' in redacted.data.detail.location, false);
  assert.equal(redacted.data.detail.dealer.city, 'Charlotte');
  assert.equal(redacted.data.detail.dealer.latitude, 35.2271);
  assert.equal('name' in redacted.data.detail.dealer, false);
  assert.equal('phone' in redacted.data.detail.dealer, false);
  assert.equal('videoUrl' in redacted.data.detail, false);
  assert.match(redacted.data.assistantMessage, /Chevrolet Tahoe/);
  assert.match(redacted.data.assistantMessage, /52,900/);
  assert.equal(redacted.data.detail.sellerComments.toLowerCase().includes('located at'), true);
});

test('placeholder dealer names do not wipe ordinary words', () => {
  const redacted = redactShopperDealerIdentity({
    location: { dealerName: 'Unknown Dealer', dealerCity: 'Charlotte' },
    sellerComments: 'Dealer fees may apply in Charlotte.',
  });

  assert.equal(redacted.location.dealerName, '');
  assert.equal(redacted.sellerComments, 'Dealer fees may apply in Charlotte.');
});

test('youtube videos stay and dealer-hosted videos do not', () => {
  const redacted = redactShopperDealerIdentity({
    dealerWebsite: 'https://rickhendrick.com',
    videoUrl: 'https://www.youtube.com/watch?v=abc123',
    sellerComments: 'Watch the walkaround.',
  });

  assert.equal(redacted.videoUrl, 'https://www.youtube.com/watch?v=abc123');
  assert.equal('dealerWebsite' in redacted, false);
});

test('redaction does not mutate the cached listing', () => {
  const original = shopperPayload();
  const snapshot = JSON.stringify(original);
  redactShopperDealerIdentity(original);
  assert.equal(JSON.stringify(original), snapshot);
});

test('shopper inventory routes call the sanitizer', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const routes = [
    '../../app/api/inventory/search/route.ts',
    '../../app/api/inventory/detail/[id]/route.ts',
    '../../app/api/query/chat-search/route.ts',
  ];

  for (const route of routes) {
    const source = readFileSync(join(here, route), 'utf8');
    assert.match(source, /redactShopperDealerIdentity\(/);
  }
});
