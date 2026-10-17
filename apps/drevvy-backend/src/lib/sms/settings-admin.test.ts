import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  persistSmsOptOutLineSetting,
  readSmsOptOutLineAdminState,
  resetPreviewSmsOptOutLineSetting,
} from './settings-admin';

const HERE = dirname(fileURLToPath(import.meta.url));

test('operator copy for the opt-out line does not use a banned word', () => {
  const files = [
    join(HERE, 'opt-out-line.ts'),
    join(HERE, 'opt-out.ts'),
    join(HERE, 'telnyx-send-gateway.ts'),
    join(HERE, 'inbound.ts'),
    join(HERE, 'settings-admin.ts'),
    join(HERE, '../../components/admin/sms-opt-out-setting.tsx'),
    join(HERE, '../../app/admin/outreach/actions.ts'),
    join(HERE, '../../app/admin/outreach/page.tsx'),
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.equal(/negotiat/i.test(source), false, file);
  }
  const page = readFileSync(join(HERE, '../../app/admin/outreach/page.tsx'), 'utf8');
  const control = readFileSync(join(HERE, '../../components/admin/sms-opt-out-setting.tsx'), 'utf8');
  const dashboard = readFileSync(join(HERE, '../../components/admin/outreach-dashboard.tsx'), 'utf8');
  assert.equal(page.includes('readSmsOptOutLineAdminState'), true);
  assert.equal(dashboard.includes('SmsOptOutLineSettingControl'), true);
  assert.equal(control.includes('When to add the line'), true);
  assert.equal(control.includes('After hours of silence'), true);
  assert.equal(control.includes('SMS_OPT_OUT_LINE'), true);
  assert.equal(control.includes("don't text me") || control.includes('don’t text me'), true);
});

test('preview mode keeps the opt-out line choice without a database', async () => {
  const previousPreview = process.env.ADMIN_PREVIEW;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.ADMIN_PREVIEW = '1';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  resetPreviewSmsOptOutLineSetting();

  try {
    const initial = await readSmsOptOutLineAdminState();
    assert.equal(initial.persistence, 'preview');
    assert.equal(initial.setting.mode, 'first_message_per_thread');
    assert.equal(initial.setting.silenceHours, null);

    const saved = await persistSmsOptOutLineSetting(
      { mode: 'every_message', silenceHours: 12 },
      'preview@local',
    );
    assert.deepEqual(saved, { ok: true, persistence: 'preview' });

    const next = await readSmsOptOutLineAdminState();
    assert.equal(next.setting.mode, 'every_message');
    assert.equal(next.setting.silenceHours, 12);
  } finally {
    resetPreviewSmsOptOutLineSetting();
    if (previousPreview === undefined) delete process.env.ADMIN_PREVIEW;
    else process.env.ADMIN_PREVIEW = previousPreview;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test('without preview or a database the choice stays on the safe default', async () => {
  const previousPreview = process.env.ADMIN_PREVIEW;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.ADMIN_PREVIEW;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const state = await readSmsOptOutLineAdminState();
    assert.equal(state.persistence, 'default');
    assert.equal(state.setting.mode, 'first_message_per_thread');
    const saved = await persistSmsOptOutLineSetting({ mode: 'never', silenceHours: null }, 'preview@local');
    assert.equal(saved.ok, false);
  } finally {
    if (previousPreview === undefined) delete process.env.ADMIN_PREVIEW;
    else process.env.ADMIN_PREVIEW = previousPreview;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
