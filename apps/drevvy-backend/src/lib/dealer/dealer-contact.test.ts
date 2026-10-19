import assert from 'node:assert/strict';
import test from 'node:test';

import { ingestTelnyxPayload, sendOutboundSms, type CommunicationsStore } from '../brain/communications';
import type { BrainVendorEvent } from '../brain/repository';
import { presentDeal } from '../shopper/lifecycle';
import { createMemorySmsStore } from '../sms/store';
import { sendSms } from '../sms/telnyx-send-gateway';
import {
  inboundHitsContactPhone,
  matchContactPhoneDisclosure,
  outboundSmsHoldReason,
  tenDlcApproved,
} from './contact-phone';
import { checkVehicleTrim, extractVdpTrim } from './trim-check';

test('a trim mismatch is flagged and told to the shopper without changing the opener', () => {
  const html = '<dl><dt>Trim</dt><dd>XLE Premium</dd></dl>';
  assert.equal(extractVdpTrim(html), 'XLE Premium');
  const matched = checkVehicleTrim({ marketcheck: 'XLE Premium', vdp: 'xle premium', vinDecode: 'XLE Premium' });
  assert.equal(matched.mismatch, false);
  assert.equal(matched.verifiedTrim, 'XLE Premium');
  assert.equal(matched.shopperMessage, null);

  const flagged = checkVehicleTrim({ marketcheck: 'XLE', vdp: 'XLE Premium', vinDecode: 'XLE Premium' });
  assert.equal(flagged.mismatch, true);
  assert.equal(flagged.verifiedTrim, 'XLE Premium');
  assert.match(flagged.shopperMessage ?? '', /MarketCheck listed the trim as XLE/);
  assert.match(flagged.shopperMessage ?? '', /dealer's page lists XLE Premium/);

  const deal = presentDeal({
    id: 'deal-1',
    listingId: 'list1',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: { year: 2024, make: 'Toyota', model: 'RAV4', price: 34990, trim: 'XLE' },
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  }, null, flagged.shopperMessage);
  assert.equal(deal.trimNotice, flagged.shopperMessage);
  assert.equal(deal.vehicle.trim, 'XLE');
});

test('outbound texts stay off until 10DLC is approved', async () => {
  assert.equal(tenDlcApproved({}), false);
  assert.equal(tenDlcApproved({ TELNYX_10DLC_APPROVED: 'true' }), true);
  assert.equal(outboundSmsHoldReason({ testMode: true }), null);
  assert.match(outboundSmsHoldReason({}) ?? '', /10DLC/);

  let posted = 0;
  const blocked = await sendSms(
    { to: '+18435550100', body: 'Is the car still available?' },
    {
      store: createMemorySmsStore(),
      fromNumber: '+18435550199',
      apiKey: 'test-key',
      post: async () => {
        posted += 1;
        return { ok: true, id: 'nope' };
      },
    },
  );
  assert.deepEqual(blocked, { ok: false, blocked: 'ten_dlc_pending' });
  assert.equal(posted, 0);

  const live = await sendOutboundSms(memoryStore().store, {
    testMode: false,
    from: '+18039878296',
    to: '+18392748197',
    text: 'This text must not leave.',
    apiKey: 'secret',
    fetchImpl: async () => {
      throw new Error('Telnyx must not be called');
    },
  });
  assert.equal('held' in live && live.held, true);
  assert.match('error' in live ? live.error : '', /10DLC/);
});

test('an inbound call or text to the Telnyx number is logged on the deal', async () => {
  const contact = '+18435550191';
  assert.equal(inboundHitsContactPhone({
    to: '843-555-0191',
    from: '+18035550100',
    direction: 'inbound',
    eventType: 'message.received',
    channel: 'sms',
  }, contact), true);
  assert.equal(inboundHitsContactPhone({
    to: contact,
    from: '+18035550100',
    direction: 'outbound',
    eventType: 'message.sent',
    channel: 'sms',
  }, contact), false);

  const deal = matchContactPhoneDisclosure('+18035550100', [
    { dealId: 'deal-a', dealerId: 'dealer-a', dealerPhone: '+18035550100', disclosedAt: '2026-10-19T12:00:00.000Z' },
    { dealId: 'deal-b', dealerId: 'dealer-b', dealerPhone: '+18035550199', disclosedAt: '2026-10-19T13:00:00.000Z' },
  ]);
  assert.deepEqual(deal, { dealId: 'deal-a', dealerId: 'dealer-a' });

  const memory = memoryStore();
  const result = await ingestTelnyxPayload({
    data: {
      event_type: 'message.received',
      id: 'evt-in-1',
      occurred_at: '2026-10-19T18:00:00.000Z',
      payload: {
        direction: 'inbound',
        from: { phone_number: '+18035550100' },
        to: [{ phone_number: contact }],
        text: 'Yes, the XLE Premium is still here.',
      },
    },
  }, {
    store: memory.store,
    apiKey: null,
    matchContactPhone: async () => ({ dealId: 'deal-a', dealerId: 'dealer-a' }),
  });
  assert.equal(result.httpStatus, 200);
  assert.equal(memory.saved[0]?.deal_id, 'deal-a');
  assert.equal(memory.saved[0]?.dealer_id, 'dealer-a');
  assert.equal(memory.saved[0]?.direction, 'inbound');
  assert.equal(memory.saved[0]?.body, 'Yes, the XLE Premium is still here.');

  const call = await ingestTelnyxPayload({
    data: {
      event_type: 'call.initiated',
      id: 'evt-call-1',
      occurred_at: '2026-10-19T18:05:00.000Z',
      payload: {
        direction: 'inbound',
        from: '+18035550100',
        to: contact,
        call_control_id: 'call-1',
      },
    },
  }, {
    store: memory.store,
    apiKey: null,
    matchContactPhone: async (input) => {
      assert.equal(input.eventType, 'call.initiated');
      assert.equal(input.direction, 'inbound');
      return { dealId: 'deal-a', dealerId: 'dealer-a' };
    },
  });
  assert.equal(call.httpStatus, 200);
  assert.equal(memory.saved[1]?.deal_id, 'deal-a');
  assert.equal(memory.saved[1]?.channel, 'call');
});

function memoryStore(): { store: CommunicationsStore; saved: BrainVendorEvent[] } {
  const saved: BrainVendorEvent[] = [];
  const store: CommunicationsStore = {
    async testNumbers() {
      return new Set();
    },
    async findByVendorEvent() {
      return null;
    },
    async findCallContext() {
      return null;
    },
    async save(event) {
      saved.push(event);
      return { id: `id-${saved.length}` };
    },
    async attach() {},
    async uploadRecording() {
      return true;
    },
  };
  return { store, saved };
}
