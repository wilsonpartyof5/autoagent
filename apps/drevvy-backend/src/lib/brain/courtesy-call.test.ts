import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_DREVVY_EMAIL,
  guardCourtesyCall,
  readVehicleCallFields,
  resolveCourtesyVariables,
  stockNumberForCall,
} from './courtesy-call';

const identity = {
  shopperFirstName: 'Maya',
  smsNumberE164: '+18035550101',
  emailAlias: 'maya.ab12@offers.drevvy.com',
};

test('the stock number falls back to the last 8 of the VIN', () => {
  assert.equal(stockNumberForCall('#17646', '1HGBH41JXMN109186'), '17646');
  assert.equal(stockNumberForCall('  ', '1hgbh41jxmn109186'), 'MN109186');
  assert.equal(stockNumberForCall(null, '1HGBH41JXMN109186'), 'MN109186');
  assert.equal(stockNumberForCall(null, null), '');
  assert.deepEqual(readVehicleCallFields({ stock_no: 'A1234', vin: '1HGBH41JXMN109186' }), {
    stock: 'A1234',
    vin: '1HGBH41JXMN109186',
  });
});

test('live and test courtesy calls use the same variables, with different reply sources', () => {
  const live = resolveCourtesyVariables({
    testMode: false,
    identity,
    vin: '1HGBH41JXMN109186',
    env: {
      DREVVY_TEST_TEXT_NUMBER: '+18035550148',
      DREVVY_EMAIL: 'deals@drevvy.test',
    },
  });
  assert.deepEqual(live, {
    shopperFirstName: 'Maya',
    stockNumber: 'MN109186',
    replyTextNumber: '+18035550101',
    replyEmail: 'maya.ab12@offers.drevvy.com',
  });

  const liveFallback = resolveCourtesyVariables({
    testMode: false,
    identity: { ...identity, emailAlias: null },
    stock: '17646',
    env: {},
  });
  assert.equal(liveFallback.replyEmail, DEFAULT_DREVVY_EMAIL);
  assert.equal(liveFallback.replyTextNumber, '+18035550101');

  const liveEnvEmail = resolveCourtesyVariables({
    testMode: false,
    identity: { shopperFirstName: 'Maya', smsNumberE164: '+18035550101', emailAlias: ' ' },
    env: { DREVVY_EMAIL: 'Dustin@Drevvy.com' },
  });
  assert.equal(liveEnvEmail.replyEmail, 'dustin@drevvy.com');

  const testCall = resolveCourtesyVariables({
    testMode: true,
    identity: { ...identity, smsNumberE164: '+18039878296' },
    stock: '#17646',
    vin: '1HGBH41JXMN109186',
    env: {
      DREVVY_TEXT_NUMBER: '+18039878296',
      DREVVY_TEST_TEXT_NUMBER: '803-555-0148',
      DREVVY_EMAIL: 'deals@drevvy.test',
    },
  });
  assert.deepEqual(testCall, {
    shopperFirstName: 'Maya',
    stockNumber: '17646',
    replyTextNumber: '+18035550148',
    replyEmail: 'deals@drevvy.test',
  });
  const passed = guardCourtesyCall({ from: '+18039878296', variables: testCall });
  assert.deepEqual(passed, {
    ok: true,
    variables: {
      shopper_first_name: 'Maya',
      stock_number: '17646',
      reply_text_number: '+18035550148',
      reply_email: 'deals@drevvy.test',
    },
  });

  const testFromTextEnv = resolveCourtesyVariables({
    testMode: true,
    shopperFirstName: 'Luis',
    env: { DREVVY_TEXT_NUMBER: '(803) 555-0148' },
  });
  assert.equal(testFromTextEnv.replyTextNumber, '+18035550148');
  assert.equal(testFromTextEnv.replyEmail, DEFAULT_DREVVY_EMAIL);
  assert.equal(testFromTextEnv.shopperFirstName, 'Luis');
});

test('courtesy calls are refused without a real reply number or email', () => {
  const missingText = guardCourtesyCall({
    from: '+18039878296',
    variables: resolveCourtesyVariables({
      testMode: true,
      shopperFirstName: 'Maya',
      stock: '17646',
      env: { DREVVY_EMAIL: 'deals@drevvy.test' },
    }),
  });
  assert.deepEqual(missingText, { ok: false, error: 'A courtesy call needs a reply text number.' });

  const missingEmail = guardCourtesyCall({
    from: '+18039878296',
    variables: resolveCourtesyVariables({
      testMode: true,
      env: { DREVVY_TEST_TEXT_NUMBER: '803-555-0148', DREVVY_EMAIL: 'not-an-email' },
    }),
  });
  assert.deepEqual(missingEmail, { ok: false, error: 'A courtesy call needs a reply email.' });

  const sameAsFrom = guardCourtesyCall({
    from: '+1 (803) 987-8296',
    variables: {
      shopperFirstName: 'Maya',
      stockNumber: '17646',
      replyTextNumber: '803-987-8296',
      replyEmail: 'deals@drevvy.test',
    },
  });
  assert.deepEqual(sameAsFrom, { ok: false, error: 'The reply text number cannot be the caller ID.' });

  const otherCaller = guardCourtesyCall({
    from: '+18035551000',
    variables: {
      shopperFirstName: 'Maya',
      stockNumber: '17646',
      replyTextNumber: '+18392748197',
      replyEmail: 'deals@drevvy.test',
    },
  });
  assert.deepEqual(otherCaller, { ok: false, error: 'The reply text number cannot be the caller ID.' });
});

test('courtesy values are checked for a leaked caller ID', () => {
  const leakedStock = guardCourtesyCall({
    from: '+18035551000',
    variables: {
      shopperFirstName: 'Maya',
      stockNumber: '803-555-1000',
      replyTextNumber: '+18035550148',
      replyEmail: 'deals@drevvy.test',
    },
  });
  assert.deepEqual(leakedStock, { ok: false, error: 'The voice agent must not give its caller ID out.' });

  const leakedEmail = guardCourtesyCall({
    from: '+18035551000',
    callerNumbers: ['+18035550199'],
    variables: {
      shopperFirstName: 'Maya',
      stockNumber: '17646',
      replyTextNumber: '+18035550148',
      replyEmail: 'desk8035550199@drevvy.test',
    },
  });
  assert.deepEqual(leakedEmail, { ok: false, error: 'The voice agent must not give its caller ID out.' });

  const allowed = guardCourtesyCall({
    from: '+18035551000',
    callerNumbers: ['+18039878296'],
    variables: {
      shopperFirstName: 'Maya',
      stockNumber: '17646',
      replyTextNumber: '803-555-0148',
      replyEmail: 'maya.ab12@offers.drevvy.com',
    },
  });
  assert.equal(allowed.ok, true);
  if (allowed.ok) {
    assert.equal(allowed.variables.reply_text_number, '+18035550148');
    assert.notEqual(allowed.variables.reply_text_number, '+18035551000');
    assert.notEqual(allowed.variables.reply_text_number, '+18039878296');
  }
});
