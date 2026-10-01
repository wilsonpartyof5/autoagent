import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ShopperDealConflict,
  ShopperDealError,
  createShopperDeal,
  getShopperDeal,
  listShopperDeals,
  readCreateDealInput,
  toShopperDeal,
  type ShopperDealRepository,
  type ShopperDealRow,
} from './deals';
import { rejectSharedInventoryCredential } from './session';

const DEALER_NAME = 'Rick Hendrick Chevrolet';
const PHONE = '803-555-0199';
const EMAIL = 'sales@rick.com';
const WEBSITE = 'https://rickhendrick.com';
const STREET = '123 Hendrick Way';
const SALESPERSON = 'Pat Smith';
const PHOTO = 'https://images.marketcheck.com/tahoe.jpg';

const vehicle = {
  year: 2024,
  make: 'Chevrolet',
  model: 'Tahoe',
  trim: 'LT',
  price: 52900,
  miles: 12000,
  condition: 'used',
  vin: '1gnskckd5rr123456',
  city: 'Charlotte',
  state: 'NC',
  latitude: 35.2271,
  longitude: -80.8431,
  daysOnMarket: 18,
  thumbnailUrl: PHOTO,
  dealerName: DEALER_NAME,
  dealerPhone: PHONE,
  dealerWebsite: WEBSITE,
  dealerAddress: `${STREET}, Charlotte, NC 28202`,
  email: EMAIL,
  salesperson: SALESPERSON,
  dealerId: 'mc-dealer-99',
  dealer: { name: DEALER_NAME, phone: PHONE, city: 'Charlotte' },
};

function memoryRepo(): ShopperDealRepository & { rows: ShopperDealRow[] } {
  const rows: ShopperDealRow[] = [];
  return {
    rows,
    async findOpen(consumerUserId, listingId) {
      return rows.find((row) =>
        row.consumerUserId === consumerUserId
        && row.listingId === listingId
        && (row.status === 'interested' || row.status === 'negotiating'),
      ) ?? null;
    },
    async insert(deal) {
      const open = rows.find((row) =>
        row.consumerUserId === deal.consumerUserId
        && row.listingId === deal.listingId
        && (row.status === 'interested' || row.status === 'negotiating'),
      );
      if (open) throw new ShopperDealConflict();
      const now = '2026-10-01T16:00:00.000Z';
      const row: ShopperDealRow = {
        id: randomUUID(),
        consumerUserId: deal.consumerUserId,
        listingId: deal.listingId,
        status: 'interested',
        outreachLockedUntilPaid: true,
        vehicle: deal.vehicle,
        createdAt: now,
        updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    async list(consumerUserId) {
      return rows.filter((row) => row.consumerUserId === consumerUserId);
    },
    async get(consumerUserId, dealId) {
      return rows.find((row) => row.consumerUserId === consumerUserId && row.id === dealId) ?? null;
    },
  };
}

function assertIdentityAbsent(serialized: string): void {
  assert.equal(serialized.includes(DEALER_NAME), false);
  assert.equal(serialized.toLowerCase().includes('rick hendrick'), false);
  assert.equal(serialized.includes(PHONE), false);
  assert.equal(serialized.includes(EMAIL), false);
  assert.equal(serialized.toLowerCase().includes('rickhendrick.com'), false);
  assert.equal(serialized.includes(STREET), false);
  assert.equal(serialized.includes(SALESPERSON), false);
  assert.equal(serialized.includes('mc-dealer-99'), false);
}

test('creating a deal keeps the car and drops dealer identity', async () => {
  const repo = memoryRepo();
  const deal = await createShopperDeal(repo, {
    consumerUserId: 'shopper-1',
    listingId: 'mc-listing-1',
    vehicle,
  });

  assert.equal(deal.status, 'interested');
  assert.equal(deal.outreachLockedUntilPaid, true);
  assert.equal(deal.listingId, 'mc-listing-1');
  assert.equal(deal.vehicle.year, 2024);
  assert.equal(deal.vehicle.make, 'Chevrolet');
  assert.equal(deal.vehicle.model, 'Tahoe');
  assert.equal(deal.vehicle.trim, 'LT');
  assert.equal(deal.vehicle.price, 52900);
  assert.equal(deal.vehicle.miles, 12000);
  assert.equal(deal.vehicle.city, 'Charlotte');
  assert.equal(deal.vehicle.state, 'NC');
  assert.equal(deal.vehicle.latitude, 35.2271);
  assert.equal(deal.vehicle.daysOnMarket, 18);
  assert.equal(deal.vehicle.vin, '1GNSKCKD5RR123456');
  assert.equal(deal.vehicle.thumbnailUrl, PHOTO);
  assertIdentityAbsent(JSON.stringify(deal));
  assertIdentityAbsent(JSON.stringify(repo.rows[0].vehicle));
  assert.equal('dealerName' in (repo.rows[0].vehicle as object), false);
});

test('saving the same listing again returns the open deal', async () => {
  const repo = memoryRepo();
  const first = await createShopperDeal(repo, {
    consumerUserId: 'shopper-1',
    listingId: 'mc-listing-1',
    vehicle,
  });
  const second = await createShopperDeal(repo, {
    consumerUserId: 'shopper-1',
    listingId: 'mc-listing-1',
    vehicle,
  });
  assert.equal(second.id, first.id);
  assert.equal(repo.rows.length, 1);
});

test('a shopper only sees their own deals', async () => {
  const repo = memoryRepo();
  const mine = await createShopperDeal(repo, {
    consumerUserId: 'shopper-1',
    listingId: 'mc-listing-1',
    vehicle,
  });
  await createShopperDeal(repo, {
    consumerUserId: 'shopper-2',
    listingId: 'mc-listing-2',
    vehicle,
  });

  const listed = await listShopperDeals(repo, 'shopper-1');
  assert.deepEqual(listed.map((deal) => deal.id), [mine.id]);
  assert.equal(await getShopperDeal(repo, 'shopper-2', mine.id), null);
  assert.equal((await getShopperDeal(repo, 'shopper-1', mine.id))?.id, mine.id);
});

test('a stored pay flag cannot unlock outreach in the response', () => {
  const deal = toShopperDeal({
    id: '11111111-1111-4111-8111-111111111111',
    consumerUserId: 'shopper-1',
    listingId: 'mc-listing-1',
    status: 'interested',
    outreachLockedUntilPaid: false,
    vehicle: {
      year: 2024,
      make: 'Chevrolet',
      model: 'Tahoe',
      price: 52900,
      dealerName: DEALER_NAME,
      dealerPhone: PHONE,
    },
    createdAt: '2026-10-01T16:00:00.000Z',
    updatedAt: '2026-10-01T16:00:00.000Z',
  });
  assert.equal(deal.outreachLockedUntilPaid, true);
  assertIdentityAbsent(JSON.stringify(deal));
});

test('create input ignores status and dealer fields outside the vehicle', () => {
  const input = readCreateDealInput({
    listingId: 'mc-listing-1',
    status: 'accepted',
    dealerName: DEALER_NAME,
    dealerPhone: PHONE,
    vehicle,
  });
  assert.deepEqual(Object.keys(input).sort(), ['listingId', 'vehicle']);
  assert.equal(input.listingId, 'mc-listing-1');
});

test('a deal requires a listing id and a vehicle price', async () => {
  const repo = memoryRepo();
  await assert.rejects(
    () => createShopperDeal(repo, { consumerUserId: 'shopper-1', listingId: 'bad id', vehicle }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'invalid_listing',
  );
  await assert.rejects(
    () => createShopperDeal(repo, {
      consumerUserId: 'shopper-1',
      listingId: 'mc-listing-1',
      vehicle: { year: 2024, make: 'Chevrolet', model: 'Tahoe' },
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'invalid_vehicle',
  );
});

test('the shared inventory key is rejected for deals', () => {
  const fromBearer = rejectSharedInventoryCredential('Bearer search-key', null, 'search-key');
  assert.equal(fromBearer?.status, 401);
  assert.equal(fromBearer?.code, 'shared_key_rejected');

  const fromHeader = rejectSharedInventoryCredential(null, 'search-key', 'search-key');
  assert.equal(fromHeader?.code, 'shared_key_rejected');

  const session = rejectSharedInventoryCredential('Bearer shopper-jwt', null, 'search-key');
  assert.equal(session, null);
});

test('deal routes require a shopper session', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const route of [
    '../../app/api/consumer/deals/route.ts',
    '../../app/api/consumer/deals/[id]/route.ts',
  ]) {
    const source = readFileSync(join(here, route), 'utf8');
    assert.match(source, /requireShopperAuth\(/);
  }
});

test('the shopper deal migration does not depend on dealer inventory tables', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(here, '../../../supabase/migrations/20261001_shopper_deals.sql'), 'utf8');
  assert.match(sql, /outreach_locked_until_paid/);
  assert.match(sql, /Shoppers read own deals/);
  assert.equal(sql.includes('uvs_vehicles'), false);
  assert.equal(sql.includes('dealerships'), false);
  assert.equal(sql.includes('negotiation_cases'), false);
});
