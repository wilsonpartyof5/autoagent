import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ShopperDealError } from './deals';
import {
  LISTING_DATA_MESSAGE,
  deleteSavedCar,
  listSavedCars,
  readSaveCarInput,
  saveSavedCar,
  savedCarColumns,
  storedColumnNames,
  toLiveListing,
  type SavedCarRepository,
  type SavedCarRow,
} from './saved-cars';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEALER = 'Rick Hendrick Chevrolet';
const PHONE = '803-555-0199';
const PHOTO = 'https://images.marketcheck.com/tahoe.jpg';
const DEAL_ID = '11111111-1111-4111-8111-111111111111';

function memoryRepo(): SavedCarRepository & { rows: SavedCarRow[] } {
  const rows: SavedCarRow[] = [];
  return {
    rows,
    async list(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async find(userId, listingId) {
      return rows.find((row) => row.userId === userId && row.listingId === listingId) ?? null;
    },
    async save(row) {
      const index = rows.findIndex((item) => item.userId === row.userId && item.listingId === row.listingId);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return row;
    },
    async remove(userId, listingId) {
      const index = rows.findIndex((item) => item.userId === userId && item.listingId === listingId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}

function liveDetail() {
  return {
    id: 'mc-listing-1',
    vin: '1GNSKCKD5RR123456',
    year: 2024,
    make: 'Chevrolet',
    model: 'Tahoe',
    trim: 'LT',
    condition: 'used',
    price: 52900,
    miles: 12000,
    photoUrls: [PHOTO],
    daysOnMarket: 18,
    location: {
      latitude: 35.2271,
      longitude: -80.8431,
      dealerName: DEALER,
      dealerCity: 'Charlotte',
      dealerState: 'NC',
      dealerPhone: PHONE,
      dealerWebsite: 'https://rickhendrick.com',
      dealerAddress: '123 Hendrick Way',
    },
    sellerComments: `Call ${DEALER} at ${PHONE}`,
  };
}

test('a save rejects listing price, photos, dealer, and specs', () => {
  assert.throws(
    () => readSaveCarInput({ listingId: 'mc-listing-1', price: 52900, photoUrls: [PHOTO], dealerName: DEALER }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'listing_data_rejected',
  );
  assert.equal(LISTING_DATA_MESSAGE.includes('transparency'), true);
  assert.equal(/negotiat/i.test(LISTING_DATA_MESSAGE), false);
  const input = readSaveCarInput({ listingId: 'mc-listing-1', vin: '1gnskckd5rr123456' });
  assert.equal(input.vin, '1GNSKCKD5RR123456');
  assert.deepEqual(storedColumnNames(), ['user_id', 'listing_id', 'vin', 'saved_at', 'moved_to_deal_id']);
});

test('saving a car keeps the id and VIN and fetches the listing live', async () => {
  const repo = memoryRepo();
  const lookups: string[] = [];
  const saved = await saveSavedCar('shopper-1', {
    listingId: 'mc-listing-1',
    vin: '1GNSKCKD5RR123456',
  }, {
    repo,
    ownsDeal: async () => false,
    lookup: async (listingId) => {
      lookups.push(listingId);
      return liveDetail();
    },
    now: new Date('2026-10-14T12:00:00.000Z'),
  });

  assert.deepEqual(savedCarColumns(repo.rows[0]), {
    user_id: 'shopper-1',
    listing_id: 'mc-listing-1',
    vin: '1GNSKCKD5RR123456',
    saved_at: '2026-10-14T12:00:00.000Z',
    moved_to_deal_id: null,
  });
  assert.equal('price' in repo.rows[0], false);
  assert.equal(saved.listing?.price, 52900);
  assert.deepEqual(saved.listing?.photoUrls, [PHOTO]);
  assert.equal(saved.listing?.city, 'Charlotte');
  const serialized = JSON.stringify(saved);
  assert.equal(serialized.includes(DEALER), false);
  assert.equal(serialized.includes(PHONE), false);
  assert.equal(serialized.includes('Hendrick Way'), false);
  assert.equal(serialized.includes('rickhendrick.com'), false);

  const again = await saveSavedCar('shopper-1', { listingId: 'mc-listing-1', movedToDealId: DEAL_ID }, {
    repo,
    ownsDeal: async (userId, dealId) => userId === 'shopper-1' && dealId === DEAL_ID,
    lookup: async () => null,
    now: new Date('2026-10-15T12:00:00.000Z'),
  });
  assert.equal(again.savedAt, '2026-10-14T12:00:00.000Z');
  assert.equal(again.vin, '1GNSKCKD5RR123456');
  assert.equal(again.movedToDealId, DEAL_ID);
  assert.equal(again.listing, null);
  assert.equal(repo.rows.length, 1);

  const listed = await listSavedCars('shopper-1', {
    repo,
    ownsDeal: async () => false,
    lookup: async () => liveDetail(),
    now: new Date('2026-10-15T12:00:00.000Z'),
  });
  assert.equal(listed.length, 1);
  assert.equal('price' in repo.rows[0], false);
  assert.equal(lookups.length, 1);

  await deleteSavedCar('shopper-1', 'mc-listing-1', {
    repo,
    ownsDeal: async () => false,
    lookup: async () => null,
    now: new Date(),
  });
  assert.equal(repo.rows.length, 0);
});

test('a saved car cannot point at someone else\'s deal', async () => {
  const repo = memoryRepo();
  await assert.rejects(
    () => saveSavedCar('shopper-1', { listingId: 'mc-listing-1', movedToDealId: DEAL_ID }, {
      repo,
      ownsDeal: async () => false,
      lookup: async () => null,
      now: new Date(),
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'not_found',
  );
  assert.equal(repo.rows.length, 0);
});

test('live listing drops dealer identity and keeps the car', () => {
  const listing = toLiveListing({
    id: 'mc-listing-1',
    year: 2024,
    make: 'Chevrolet',
    model: 'Tahoe',
    price: 100,
    dealerName: DEALER,
    dealerPhone: PHONE,
    location: { dealerName: DEALER, dealerPhone: PHONE, dealerCity: 'Charlotte' },
  });
  assert.equal(listing?.price, 100);
  assert.equal(JSON.stringify(listing).includes(DEALER), false);
  assert.equal(JSON.stringify(listing).includes(PHONE), false);
});

test('saved car routes and the migration stay on the shopper\'s own rows', () => {
  for (const route of [
    '../../app/api/consumer/saved-cars/route.ts',
    '../../app/api/consumer/saved-cars/[listingId]/route.ts',
  ]) {
    const source = readFileSync(join(HERE, route), 'utf8');
    assert.match(source, /requireShopperAuth\(/);
    assert.equal(/negotiat/i.test(source), false);
  }

  const store = readFileSync(join(HERE, 'saved-car-store.ts'), 'utf8');
  assert.match(store, /savedCarColumns/);
  assert.match(store, /user_id, listing_id, vin, saved_at, moved_to_deal_id/);
  assert.equal(store.includes('price'), false);
  assert.equal(store.includes('photo'), false);
  assert.equal(/negotiat/i.test(store), false);

  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261017130000_saved_cars.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /Shoppers read own saved cars/);
  assert.match(sql, /Shoppers insert own saved cars/);
  assert.match(sql, /Shoppers update own saved cars/);
  assert.match(sql, /with check/);
  assert.match(sql, /Shoppers delete own saved cars/);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(sql, /grant select, insert, update, delete on public\.saved_cars to authenticated/);
  assert.equal(sql.includes('shopper_credits'), false);
  assert.equal(sql.includes('to anon'), false);
  const create = sql.slice(sql.indexOf('create table'), sql.indexOf(');') + 2).toLowerCase();
  for (const word of ['price', 'photo', 'dealer', 'spec', 'msrp']) {
    assert.equal(create.includes(word), false, word);
  }
});
