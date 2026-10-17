import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAnalytics } from './analytics';
import { adminPreviewEnabled, isAllowlistedAdmin, parseAdminEmails, safeAdminNextPath } from './access';
import { DEMO_VEHICLES, getMockShoppers, shopperFacingJson } from './mock-source';

const DEALER_MARKERS = ['Piedmont Auto Group', 'Catawba Motor Co', 'York Road Motors', 'Lake Wylie Cars', '803-555-0142', 'desk@piedmont.example'];

test('admin emails are an allowlist, not a hardcoded owner', () => {
  assert.deepEqual(parseAdminEmails(' Owner@Drevvy.com, ops@drevvy.com '), ['owner@drevvy.com', 'ops@drevvy.com']);
  assert.deepEqual(parseAdminEmails(''), []);
  assert.equal(isAllowlistedAdmin('owner@drevvy.com', 'owner@drevvy.com'), true);
  assert.equal(isAllowlistedAdmin('someone@else.com', 'owner@drevvy.com'), false);
  assert.equal(isAllowlistedAdmin(null, 'owner@drevvy.com'), false);
  assert.equal(isAllowlistedAdmin('owner@drevvy.com', ''), false);
});

test('preview bypass cannot run in production', () => {
  assert.equal(adminPreviewEnabled({ NODE_ENV: 'production', ADMIN_PREVIEW: '1' }), false);
  assert.equal(adminPreviewEnabled({ NODE_ENV: 'development', ADMIN_PREVIEW: '1' }), true);
  assert.equal(adminPreviewEnabled({ NODE_ENV: 'development', ADMIN_PREVIEW: '0' }), false);
});

test('admin next paths stay inside /admin', () => {
  assert.equal(safeAdminNextPath('/admin/shoppers/shopper-maya'), '/admin/shoppers/shopper-maya');
  assert.equal(safeAdminNextPath('https://evil.example/admin'), null);
  assert.equal(safeAdminNextPath('//evil.example'), null);
  assert.equal(safeAdminNextPath('/app/leads'), null);
});

test('mock book matches the 19 exported vehicles and the 10-car cap', () => {
  const shoppers = getMockShoppers();
  assert.equal(DEMO_VEHICLES.length, 19);
  assert.equal(shoppers.length >= 5 && shoppers.length <= 8, true);
  const vins = shoppers.flatMap((shopper) => shopper.deals.map((deal) => deal.vehicle.vin));
  assert.equal(new Set(vins).size, 19);
  assert.equal(vins.length, 19);
  const chris = shoppers.find((shopper) => shopper.id === 'shopper-chris');
  assert.equal(chris?.deals.length, 10);
  assert.equal(shoppers.every((shopper) => shopper.deals.length <= 10), true);
});

test('shopper-facing deal JSON never includes dealer identity', () => {
  for (const shopper of getMockShoppers()) {
    for (const deal of shopper.deals) {
      const shopperJson = shopperFacingJson(deal);
      const adminJson = JSON.stringify(deal);
      for (const marker of DEALER_MARKERS) {
        assert.equal(shopperJson.includes(marker), false, marker);
      }
      if (deal.dealers.length > 0) {
        assert.equal(adminJson.includes(deal.dealers[0].name), true);
        assert.equal(adminJson.includes(deal.dealers[0].phone), true);
      }
    }
  }
});

test('analytics funnel counts only move forward', () => {
  const analytics = buildAnalytics();
  for (let index = 1; index < analytics.funnel.length; index += 1) {
    assert.equal(analytics.funnel[index].count <= analytics.funnel[index - 1].count, true);
  }
  const email = analytics.responseRateByChannel.find((row) => row.channel === 'email');
  assert.equal((email?.replies ?? 0) > 0, true);
  assert.equal(analytics.mrrUsd, analytics.activeSubscribers * 97);
  assert.deepEqual(analytics.packMix.map((row) => row.size), [1, 3, 5, 10]);
  assert.equal(analytics.packMix.find((row) => row.size === 1)?.purchases, 1);
  assert.equal(analytics.dealsByStage.reduce((sum, row) => sum + row.count, 0), 19);
  const ready = getMockShoppers().flatMap((shopper) => shopper.deals).filter((deal) => deal.stage === 'best_price_ready');
  assert.equal(ready.every((deal) => deal.bestOtd != null && (deal.savings ?? 0) > 0), true);
});
