import assert from 'node:assert/strict';
import test from 'node:test';

import { marketCheckStoredKeyCount, resetMarketCheckCacheForTests } from './cache-policy';
import { resetMarketCheckUsageForTests } from './usage';
import {
  BASIC_DECODER_MISSING_SPECS_FIELDS,
  SPECS_CARD_FROM_BASIC,
  decodeVinBasic,
  mapBasicVinDecode,
} from './vin-decode';

const VIN = '1HGCM82633A004352';

test('basic decoder fills every specs-card field it can and lists the ones it cannot', () => {
  const specs = mapBasicVinDecode({
    is_valid: true,
    decode_mode: 'full',
    year: 2021,
    make: 'Honda',
    model: 'Accord',
    trim: 'EX',
    engine: '2.0L I4',
    drivetrain: 'FWD',
    city_mpg: 30,
    highway_mpg: 38,
    std_seating: '5',
    transmission: 'Automatic',
    fuel_type: 'Unleaded',
    powertrain_type: 'Combustion',
    horsepower: 192,
    combined_mpg: 34,
  });

  assert.equal(SPECS_CARD_FROM_BASIC.powertrain, 'engine');
  assert.equal(SPECS_CARD_FROM_BASIC.drivetrain, 'drivetrain');
  assert.equal(SPECS_CARD_FROM_BASIC.fuelEconomyCity, 'city_mpg');
  assert.equal(SPECS_CARD_FROM_BASIC.fuelEconomyHighway, 'highway_mpg');
  assert.equal(SPECS_CARD_FROM_BASIC.seats, 'std_seating');
  assert.equal(SPECS_CARD_FROM_BASIC.transmission, 'transmission');
  assert.deepEqual(BASIC_DECODER_MISSING_SPECS_FIELDS, ['horsepower', 'combinedMpg']);

  assert.equal(specs?.engine, '2.0L I4');
  assert.equal(specs?.drivetrain, 'FWD');
  assert.equal(specs?.cityMpg, 30);
  assert.equal(specs?.highwayMpg, 38);
  assert.equal(specs?.seatingCapacity, 5);
  assert.equal(specs?.transmission, 'Automatic');
  assert.equal(specs?.fuelType, 'Unleaded');
  assert.equal(specs?.powertrainType, 'Combustion');
  assert.equal('horsepower' in (specs ?? {}), false);
  assert.equal('combinedMpg' in (specs ?? {}), false);
  assert.equal('combined_mpg' in (specs ?? {}), false);
});

test('std_seating accepts a bare count and an invalid VIN decode is dropped', () => {
  assert.equal(mapBasicVinDecode({ std_seating: '5 seats', engine: '2.0L' })?.seatingCapacity, 5);
  assert.equal(mapBasicVinDecode({ is_valid: false, engine: '2.0L' }), null);
  assert.equal(mapBasicVinDecode({ data: { engine: '1.5L', std_seating: 5 } })?.engine, '1.5L');
});

test('basic decode is not cached and each call is counted', async () => {
  process.env.MARKETCHECK_API_KEY = 'test-marketcheck-key-do-not-ship';
  resetMarketCheckCacheForTests();
  resetMarketCheckUsageForTests();
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  let calls = 0;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ is_valid: true, engine: '2.0L', city_mpg: 30, highway_mpg: 38, std_seating: '5' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const first = await decodeVinBasic(VIN);
    const second = await decodeVinBasic(VIN.toLowerCase());
    assert.equal(first?.engine, '2.0L');
    assert.equal(second?.seatingCapacity, 5);
    assert.equal(calls, 2);
    assert.equal(marketCheckStoredKeyCount(), 0);
    const joined = logs.join('\n');
    assert.equal(joined.includes('"endpoint":"decode_vin_basic"'), true);
    assert.equal(joined.includes('"count":1'), true);
    assert.equal(joined.includes(VIN), false);
    assert.equal(joined.includes('test-marketcheck-key-do-not-ship'), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});
