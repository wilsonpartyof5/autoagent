import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import DeleteAccountPage, { generateMetadata } from '@/app/(public)/delete-account/page';
import PrivacyPage from '@/app/(public)/privacy/page';
import { PrivacyPageLive } from '@/app/(public)/privacy/privacy-live';
import { legalDraftPublishEnabled } from '@/lib/legal-publish';

const DRAFT_SENTENCE = 'One email address we made for the dealer';
const LIVE_SENTENCE = 'within 30 days';

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as unknown as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest.endsWith(';404');
}

function withFlag(value: string | undefined, run: () => void): void {
  const previous = process.env.LEGAL_DRAFT_PUBLISH;
  if (value === undefined) delete process.env.LEGAL_DRAFT_PUBLISH;
  else process.env.LEGAL_DRAFT_PUBLISH = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.LEGAL_DRAFT_PUBLISH;
    else process.env.LEGAL_DRAFT_PUBLISH = previous;
  }
}

test('legalDraftPublishEnabled is on only for the exact string true', () => {
  assert.equal(legalDraftPublishEnabled({}), false);
  assert.equal(legalDraftPublishEnabled({ LEGAL_DRAFT_PUBLISH: '' }), false);
  assert.equal(legalDraftPublishEnabled({ LEGAL_DRAFT_PUBLISH: 'TRUE' }), false);
  assert.equal(legalDraftPublishEnabled({ LEGAL_DRAFT_PUBLISH: '1' }), false);
  assert.equal(legalDraftPublishEnabled({ LEGAL_DRAFT_PUBLISH: 'false' }), false);
  assert.equal(legalDraftPublishEnabled({ LEGAL_DRAFT_PUBLISH: 'true' }), true);
  assert.equal(legalDraftPublishEnabled({ NEXT_PUBLIC_LEGAL_DRAFT_PUBLISH: 'true' }), false);
});

test('flag off privacy matches the live page and hides draft copy', () => {
  withFlag(undefined, () => {
    const live = render(createElement(PrivacyPageLive));
    const off = render(createElement(PrivacyPage));
    assert.equal(off, live);
    assert.equal(off.includes('DRAFT_'), false);
    assert.equal(off.includes(DRAFT_SENTENCE), false);
    assert.equal(off.includes(LIVE_SENTENCE), true);
    assert.equal(off.includes('href="/delete-account"'), false);
    assert.equal(off.includes('[BUSINESS ADDRESS]'), live.includes('[BUSINESS ADDRESS]'));
    assert.equal(live.includes('[BUSINESS ADDRESS]'), true);
  });
});

test('flag on privacy renders the draft', () => {
  withFlag('true', () => {
    const html = render(createElement(PrivacyPage));
    assert.equal(html.includes(DRAFT_SENTENCE), true);
    assert.equal(html.includes('PostHog receives app usage events'), true);
    assert.equal(html.includes(LIVE_SENTENCE), false);
    assert.equal(html.includes('href="/delete-account"'), true);
  });
  withFlag('TRUE', () => {
    const html = render(createElement(PrivacyPage));
    assert.equal(html.includes(DRAFT_SENTENCE), false);
    assert.equal(html.includes(LIVE_SENTENCE), true);
  });
});

test('flag off delete-account is a 404', () => {
  withFlag(undefined, () => {
    assert.throws(() => DeleteAccountPage(), isNotFound);
    assert.throws(() => generateMetadata(), isNotFound);
  });
  withFlag('false', () => {
    assert.throws(() => DeleteAccountPage(), isNotFound);
  });
});

test('flag on delete-account renders the draft', () => {
  withFlag('true', () => {
    const html = render(createElement(DeleteAccountPage));
    assert.equal(html.includes(DRAFT_SENTENCE), true);
    assert.equal(html.includes('[BUSINESS ADDRESS]'), true);
    assert.equal(html.includes('<form'), false);
    const meta = generateMetadata();
    assert.equal(meta.title, 'Delete your account - Drevvy');
    const metaText = JSON.stringify(meta);
    assert.equal(metaText.includes('DRAFT_'), false);
    assert.equal(metaText.includes('[BUSINESS ADDRESS]'), false);
  });
});
